/**
 * The C step recorder, placed in front of the learner's program before it is
 * sent to Judge0. Each step is printed to stdout between \x1e and \x1f as JSON
 * (see parseTrace.ts); everything else on stdout is the program's own output.
 *
 * Variables are registered by address at every step, so the values printed for
 * every frame on the stack are read live when the step is printed. Pointers are
 * only followed after checking the memory can be read (a write() into a pipe
 * fails with EFAULT instead of crashing), so a bad pointer shows as an address.
 */
export const C_PRELUDE = String.raw`/* ---- TutorBoard step recorder (not part of your program) ---- */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <math.h>
#define TB_I 1
#define TB_U 2
#define TB_F 3
#define TB_B 4
#define TB_C 5
#define TB_S 6
#define TB_CA 7
#define TB_P 8
#define TB_ST 9
#define TB_SP 10
#define TB_VIAPTR 1
#define TB_LINE 0
#define TB_CALL 1
#define TB_RET 2
#define TB_MAXF 64
#define TB_MAXV 48
typedef struct { const char *n; int k; const void *p; int sz; long n1; long n2; int st; int fl; } __tb_var_t;
typedef struct { int id; const char *n; int l; int nv; __tb_var_t v[TB_MAXV]; } __tb_fr_t;
static __tb_fr_t __tb_fs[TB_MAXF + 1];
static int __tb_d = 0, __tb_next = 1, __tb_steps = 0, __tb_inited = 0, __tb_has_ret = 0, __tb_over = 0, __tb_novals = 0;
static int __tb_pfd[2] = {-1, -1};
static long __tb_bytes = 0;
static __tb_var_t __tb_rv;
static char __tb_buf[1 << 16];
static int __tb_len = 0;
static const void *__tb_seen[512];
static int __tb_nseen = 0;
static void __tb_put_struct(int st, const void *p, int depth);
static const char *__tb_struct_name(int st);
static int __tb_struct_size(int st);
static void __tb_globals(void);
static void __tb_w(const char *s) {
  size_t n = strlen(s);
  if (__tb_len + n >= sizeof(__tb_buf) - 8) { __tb_over = 1; return; }
  memcpy(__tb_buf + __tb_len, s, n); __tb_len += (int)n;
}
static void __tb_wf(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
#include <stdarg.h>
static void __tb_wf(const char *fmt, ...) {
  char t[96]; va_list a; va_start(a, fmt); vsnprintf(t, sizeof t, fmt, a); va_end(a); __tb_w(t);
}
static int __tb_ok(const void *p, long n) {
  char tmp[512];
  if (!p || n <= 0) return 0;
  if (__tb_pfd[0] == -1 && pipe(__tb_pfd) != 0) __tb_pfd[0] = -2;
  if (__tb_pfd[0] < 0) return 0;
  while (n > 0) {
    long c = n > (long)sizeof tmp ? (long)sizeof tmp : n;
    if (write(__tb_pfd[1], p, (size_t)c) != c) return 0;
    if (read(__tb_pfd[0], tmp, (size_t)c) != c) return 0;
    p = (const char *)p + c; n -= c;
  }
  return 1;
}
static void __tb_jstr(const char *s, long max, int stop_at_nul) {
  char t[8]; long i;
  __tb_w("\"");
  for (i = 0; i < max; i++) {
    unsigned char c = (unsigned char)s[i];
    if (c == 0 && stop_at_nul) break;
    if (c == '"' || c == '\\') { t[0] = '\\'; t[1] = (char)c; t[2] = 0; __tb_w(t); }
    else if (c == '\n') __tb_w("\\n");
    else if (c == '\t') __tb_w("\\t");
    else if (c < 0x20 || c == 0x7f) { snprintf(t, sizeof t, "\\u%04x", c); __tb_w(t); }
    else { t[0] = (char)c; t[1] = 0; __tb_w(t); }
  }
  __tb_w("\"");
}
static void __tb_val(int k, const void *p, int sz, long n1, long n2, int st, int fl, int depth);
static void __tb_obj(int st, const void *p, int depth) {
  int i;
  for (i = 0; i < __tb_nseen; i++) if (__tb_seen[i] == p) { __tb_wf("{\"t\":\"ref\",\"id\":%lu}", (unsigned long)p); return; }
  if (depth > 6) { __tb_w("{\"t\":\"other\",\"v\":\"...\"}"); return; }
  if (__tb_nseen < 512) __tb_seen[__tb_nseen++] = p;
  __tb_w("{\"t\":\"obj\",\"cls\":"); __tb_jstr(__tb_struct_name(st), 64, 1);
  __tb_wf(",\"id\":%lu,\"fields\":[", (unsigned long)p);
  __tb_put_struct(st, p, depth + 1);
  __tb_w("]}");
}
static void __tb_scalar(int k, const void *p, int sz, int st, int depth) {
  switch (k) {
    case TB_I: {
      long long v = sz == 1 ? *(const signed char *)p : sz == 2 ? *(const short *)p : sz == 4 ? *(const int *)p : *(const long long *)p;
      if (v > 9007199254740991LL || v < -9007199254740991LL) __tb_wf("{\"t\":\"num\",\"v\":\"%lld\"}", v);
      else __tb_wf("{\"t\":\"num\",\"v\":%lld}", v);
      return;
    }
    case TB_U: {
      unsigned long long v = sz == 1 ? *(const unsigned char *)p : sz == 2 ? *(const unsigned short *)p : sz == 4 ? *(const unsigned *)p : *(const unsigned long long *)p;
      if (v > 9007199254740991ULL) __tb_wf("{\"t\":\"num\",\"v\":\"%llu\"}", v);
      else __tb_wf("{\"t\":\"num\",\"v\":%llu}", v);
      return;
    }
    case TB_F: {
      double v = sz == 4 ? *(const float *)p : sz == 8 ? *(const double *)p : (double)*(const long double *)p;
      if (isnan(v)) __tb_w("{\"t\":\"num\",\"v\":\"nan\"}");
      else if (isinf(v)) __tb_w(v > 0 ? "{\"t\":\"num\",\"v\":\"inf\"}" : "{\"t\":\"num\",\"v\":\"-inf\"}");
      else __tb_wf("{\"t\":\"num\",\"v\":%.15g}", v);
      return;
    }
    case TB_B: __tb_w(*(const unsigned char *)p ? "{\"t\":\"bool\",\"v\":true}" : "{\"t\":\"bool\",\"v\":false}"); return;
    case TB_C: __tb_w("{\"t\":\"str\",\"kind\":\"char\",\"v\":"); __tb_jstr((const char *)p, 1, 0); __tb_w("}"); return;
    case TB_S: {
      const char *s = *(const char *const *)p; long n = 0;
      if (!s) { __tb_w("{\"t\":\"none\",\"v\":\"NULL\"}"); return; }
      while (n < 200 && __tb_ok(s + n, 1) && s[n]) n++;
      if (n == 0 && !__tb_ok(s, 1)) { __tb_wf("{\"t\":\"ptr\",\"v\":\"%p\"}", (const void *)s); return; }
      __tb_w("{\"t\":\"str\",\"v\":"); __tb_jstr(s, n, 1); __tb_w("}");
      return;
    }
    case TB_P: {
      const void *q = *(const void *const *)p;
      if (!q) { __tb_w("{\"t\":\"none\",\"v\":\"NULL\"}"); return; }
      __tb_wf("{\"t\":\"ptr\",\"v\":\"%p\"", q);
      if (st > 0 && st < TB_S && sz > 0 && __tb_ok(q, sz)) { __tb_w(",\"to\":"); __tb_scalar(st, q, sz, 0, depth + 1); }
      __tb_w("}");
      return;
    }
    case TB_ST: __tb_obj(st, p, depth); return;
    case TB_SP: {
      const void *q = *(const void *const *)p;
      if (!q) { __tb_w("{\"t\":\"none\",\"v\":\"NULL\"}"); return; }
      __tb_wf("{\"t\":\"ptr\",\"v\":\"%p\"", q);
      if (__tb_ok(q, __tb_struct_size(st))) { __tb_w(",\"to\":"); __tb_obj(st, q, depth + 1); }
      __tb_w("}");
      return;
    }
    default: __tb_w("{\"t\":\"other\",\"v\":\"?\"}");
  }
}
static void __tb_val(int k, const void *p, int sz, long n1, long n2, int st, int fl, int depth) {
  long i, shown;
  if (fl & TB_VIAPTR) {
    /* An array parameter: p is the pointer itself, n1 its length (from a size parameter). */
    if (n1 < 0) n1 = 0;
    if (n1 > 0 && !__tb_ok(p, (n1 < 50 ? n1 : 50) * (n2 > 0 ? n2 : 1) * (long)sz)) { __tb_wf("{\"t\":\"ptr\",\"v\":\"%p\"}", p); return; }
  }
  if (k == TB_CA) { __tb_w("{\"t\":\"str\",\"v\":"); __tb_jstr((const char *)p, n1, 1); __tb_w("}"); return; }
  if (n1 <= 0 && !(fl & TB_VIAPTR)) { __tb_scalar(k, p, sz, st, depth); return; }
  shown = n1 < 50 ? n1 : 50;
  __tb_wf("{\"t\":\"list\",\"kind\":\"array\",\"len\":%ld,\"items\":[", n1);
  for (i = 0; i < shown; i++) {
    if (i) __tb_w(",");
    if (n2 > 0) __tb_val(k, (const char *)p + i * n2 * sz, sz, n2, 0, st, 0, depth + 1);
    else __tb_scalar(k, (const char *)p + i * sz, sz, st, depth + 1);
  }
  __tb_w("]}");
}
/* Used by the generated struct printers. */
static void __tb_field(int i, const char *n, int k, const void *p, int sz, long n1, long n2, int st, int depth) {
  if (i) __tb_w(",");
  __tb_w("{\"name\":\""); __tb_w(n); __tb_w("\",\"value\":");
  __tb_val(k, p, sz, n1, n2, st, 0, depth);
  __tb_w("}");
}
static void __tb_init(void) {
  __tb_inited = 1;
  __tb_fs[0].id = 1; __tb_fs[0].n = "global"; __tb_fs[0].l = 0; __tb_fs[0].nv = 0;
  __tb_globals();
}
static __tb_fr_t *__tb_top(void) { return &__tb_fs[__tb_d > TB_MAXF ? TB_MAXF : __tb_d]; }
static int __tb_b(int line) {
  if (!__tb_inited) __tb_init();
  if (__tb_d <= TB_MAXF) { __tb_top()->l = line; __tb_top()->nv = 0; }
  return 0;
}
static int __tb_v(const char *n, int k, const void *p, int sz, long n1, long n2, int st, int fl) {
  __tb_fr_t *f = __tb_top();
  if (__tb_d > TB_MAXF || f->nv >= TB_MAXV) return 0;
  f->v[f->nv].n = n; f->v[f->nv].k = k; f->v[f->nv].p = p; f->v[f->nv].sz = sz;
  f->v[f->nv].n1 = n1; f->v[f->nv].n2 = n2; f->v[f->nv].st = st; f->v[f->nv].fl = fl;
  f->nv++;
  return 0;
}
static int __tb_gv(const char *n, int k, const void *p, int sz, long n1, long n2, int st, int fl) {
  __tb_fr_t *f = &__tb_fs[0];
  if (f->nv >= TB_MAXV) return 0;
  f->v[f->nv].n = n; f->v[f->nv].k = k; f->v[f->nv].p = p; f->v[f->nv].sz = sz;
  f->v[f->nv].n1 = n1; f->v[f->nv].n2 = n2; f->v[f->nv].st = st; f->v[f->nv].fl = fl;
  f->nv++;
  return 0;
}
static int __tb_ret(int k, const void *p, int sz, int st) {
  __tb_rv.k = k; __tb_rv.p = p; __tb_rv.sz = sz; __tb_rv.n1 = 0; __tb_rv.n2 = 0; __tb_rv.st = st; __tb_rv.fl = 0;
  __tb_has_ret = 1;
  return 0;
}
static void __tb_frames(void) {
  int i, j, first = 1, top = __tb_d > TB_MAXF ? TB_MAXF : __tb_d;
  for (i = __tb_fs[0].nv ? 0 : 1; i <= top; i++) {
    __tb_fr_t *f = &__tb_fs[i];
    if (!first) __tb_w(",");
    first = 0;
    __tb_wf("{\"i\":%d,\"n\":\"", f->id); __tb_w(f->n); __tb_wf("\",\"l\":%d,\"v\":[", f->l);
    if (!__tb_novals)
      for (j = 0; j < f->nv; j++) {
        __tb_var_t *v = &f->v[j];
        if (j) __tb_w(",");
        __tb_w("[\""); __tb_w(v->n); __tb_w("\",");
        __tb_val(v->k, (v->fl & TB_VIAPTR) ? *(const void *const *)v->p : v->p, v->sz, v->n1, v->n2, v->st, v->fl, 0);
        __tb_w("]");
      }
    __tb_w("]}");
  }
}
static void __tb_limit(const char *why) {
  printf("\x1e{\"e\":\"limit\",\"why\":\"%s\"}\x1f", why);
  fflush(stdout);
  exit(0);
}
static int __tb_e(int ev) {
  static const char *names[] = {"line", "call", "return"};
  if (!__tb_inited) __tb_init();
  if (__tb_d > TB_MAXF) { __tb_has_ret = 0; return 0; }
  if (__tb_steps >= TB_MAX_STEPS) __tb_limit("steps");
  if (__tb_bytes > TB_MAX_BYTES) __tb_limit("size");
  __tb_steps++;
  for (__tb_novals = 0; __tb_novals < 2; __tb_novals++) {
    __tb_len = 0; __tb_over = 0; __tb_nseen = 0;
    __tb_w("\x1e{\"e\":\""); __tb_w(names[ev]); __tb_wf("\",\"l\":%d,\"f\":[", __tb_top()->l);
    __tb_frames();
    __tb_w("]");
    if (ev == TB_RET && __tb_has_ret && !__tb_novals) { __tb_w(",\"r\":"); __tb_val(__tb_rv.k, __tb_rv.p, __tb_rv.sz, 0, 0, __tb_rv.st, 0, 0); }
    if (__tb_novals) __tb_w(",\"x\":1");
    __tb_w("}\x1f");
    if (!__tb_over) break;
  }
  __tb_novals = 0;
  __tb_has_ret = 0;
  fflush(stdout);
  fwrite(__tb_buf, 1, (size_t)__tb_len, stdout);
  fflush(stdout);
  __tb_bytes += __tb_len;
  return 0;
}
static int __tb_enter(const char *n, int line) {
  if (!__tb_inited) __tb_init();
  __tb_d++;
  if (__tb_d <= TB_MAXF) { __tb_fr_t *f = &__tb_fs[__tb_d]; f->id = ++__tb_next; f->n = n; f->l = line; f->nv = 0; }
  return 0;
}
static void __tb_leave(int *unused) { (void)unused; __tb_d--; }
/* ---- your program ---- */
`;
