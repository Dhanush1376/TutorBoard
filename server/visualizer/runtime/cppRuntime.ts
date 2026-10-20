/**
 * The C++ step recorder, placed in front of the learner's program before it is
 * sent to Judge0. Same output protocol as the C recorder (see cRuntime.ts).
 *
 * Variables are registered by reference together with a printer chosen by
 * their type at compile time, so any type prints: numbers, strings, C arrays,
 * the standard containers, pointers, and the learner's own structs and classes
 * (the instrumenter gives each of those a small __tb_put member that lists its
 * fields). Steps go to std::cout so they stay in order with the program's own
 * output even when it turns off sync_with_stdio.
 */
export const CPP_PRELUDE = String.raw`/* ---- TutorBoard step recorder (not part of your program) ---- */
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <string>
#include <vector>
#include <array>
#include <deque>
#include <list>
#include <forward_list>
#include <set>
#include <unordered_set>
#include <map>
#include <unordered_map>
#include <stack>
#include <queue>
#include <utility>
#include <memory>
#include <type_traits>
#include <iostream>
#include <unistd.h>
namespace __tb {
struct Ctx { const void *seen[512]; int nseen = 0; int depth = 0; };
typedef void (*Printer)(std::string &, const void *, long, Ctx &);
struct Var { const char *n; const void *p; long n1; Printer f; };
struct Fr { int id; const char *n; int l; int nv; Var v[48]; };
static Fr fs[65];
static int d = 0, nextId = 1, steps = 0, inited = 0, pfd[2] = {-1, -1};
static long bytes = 0;
static Var rv; static bool hasRet = false;
static const int MAXF = 64;
inline bool ok(const void *p, long n) {
  char tmp[512];
  if (!p || n <= 0) return false;
  if (pfd[0] == -1 && pipe(pfd) != 0) pfd[0] = -2;
  if (pfd[0] < 0) return false;
  while (n > 0) {
    long c = n > (long)sizeof tmp ? (long)sizeof tmp : n;
    if (write(pfd[1], p, (size_t)c) != c) return false;
    if (read(pfd[0], tmp, (size_t)c) != c) return false;
    p = (const char *)p + c; n -= c;
  }
  return true;
}
inline void jstr(std::string &o, const char *s, size_t n) {
  char t[8];
  o += '"';
  for (size_t i = 0; i < n && i < 200; i++) {
    unsigned char c = (unsigned char)s[i];
    if (c == '"' || c == '\\') { o += '\\'; o += (char)c; }
    else if (c == '\n') o += "\\n";
    else if (c == '\t') o += "\\t";
    else if (c < 0x20 || c == 0x7f) { snprintf(t, sizeof t, "\\u%04x", c); o += t; }
    else o += (char)c;
  }
  o += '"';
}
inline void num(std::string &o, long long v) {
  char t[48];
  if (v > 9007199254740991LL || v < -9007199254740991LL) snprintf(t, sizeof t, "{\"t\":\"num\",\"v\":\"%lld\"}", v);
  else snprintf(t, sizeof t, "{\"t\":\"num\",\"v\":%lld}", v);
  o += t;
}
inline void unum(std::string &o, unsigned long long v) {
  char t[48];
  if (v > 9007199254740991ULL) snprintf(t, sizeof t, "{\"t\":\"num\",\"v\":\"%llu\"}", v);
  else snprintf(t, sizeof t, "{\"t\":\"num\",\"v\":%llu}", v);
  o += t;
}
inline void fnum(std::string &o, double v) {
  char t[48];
  if (std::isnan(v)) o += "{\"t\":\"num\",\"v\":\"nan\"}";
  else if (std::isinf(v)) o += v > 0 ? "{\"t\":\"num\",\"v\":\"inf\"}" : "{\"t\":\"num\",\"v\":\"-inf\"}";
  else { snprintf(t, sizeof t, "{\"t\":\"num\",\"v\":%.15g}", v); o += t; }
}
inline void addr(std::string &o, const void *p) { char t[40]; snprintf(t, sizeof t, "\"%p\"", p); o += t; }
inline bool seen(Ctx &c, const void *p) {
  for (int i = 0; i < c.nseen; i++) if (c.seen[i] == p) return true;
  if (c.nseen < 512) c.seen[c.nseen++] = p;
  return false;
}
inline void idOf(std::string &o, const void *p) { char t[32]; snprintf(t, sizeof t, "%lu", (unsigned long)p); o += t; }

/* Declarations first, so containers of containers find each other. */
inline void put(std::string &o, bool v, Ctx &) { o += v ? "{\"t\":\"bool\",\"v\":true}" : "{\"t\":\"bool\",\"v\":false}"; }
inline void put(std::string &o, char v, Ctx &) { o += "{\"t\":\"str\",\"kind\":\"char\",\"v\":"; jstr(o, &v, 1); o += "}"; }
inline void put(std::string &o, signed char v, Ctx &) { num(o, v); }
inline void put(std::string &o, unsigned char v, Ctx &) { num(o, v); }
inline void put(std::string &o, short v, Ctx &) { num(o, v); }
inline void put(std::string &o, unsigned short v, Ctx &) { num(o, v); }
inline void put(std::string &o, int v, Ctx &) { num(o, v); }
inline void put(std::string &o, unsigned v, Ctx &) { unum(o, v); }
inline void put(std::string &o, long v, Ctx &) { num(o, v); }
inline void put(std::string &o, unsigned long v, Ctx &) { unum(o, v); }
inline void put(std::string &o, long long v, Ctx &) { num(o, v); }
inline void put(std::string &o, unsigned long long v, Ctx &) { unum(o, v); }
inline void put(std::string &o, float v, Ctx &) { fnum(o, v); }
inline void put(std::string &o, double v, Ctx &) { fnum(o, v); }
inline void put(std::string &o, long double v, Ctx &) { fnum(o, (double)v); }
inline void put(std::string &o, std::nullptr_t, Ctx &) { o += "{\"t\":\"none\",\"v\":\"nullptr\"}"; }
inline void put(std::string &o, const std::string &s, Ctx &) {
  o += "{\"t\":\"str\",\"v\":"; jstr(o, s.data(), s.size());
  if (s.size() > 200) { o += ",\"more\":"; o += std::to_string(s.size() - 200); }
  o += "}";
}
template <class T> void put(std::string &o, const T &x, Ctx &c);
template <class T> void put(std::string &o, T *const &p, Ctx &c);
template <class T, size_t N> void put(std::string &o, const T (&a)[N], Ctx &c);
template <class T, class A> void put(std::string &o, const std::vector<T, A> &v, Ctx &c);
template <class T, size_t N> void put(std::string &o, const std::array<T, N> &v, Ctx &c);
template <class T, class A> void put(std::string &o, const std::deque<T, A> &v, Ctx &c);
template <class T, class A> void put(std::string &o, const std::list<T, A> &v, Ctx &c);
template <class T, class A> void put(std::string &o, const std::forward_list<T, A> &v, Ctx &c);
template <class T, class C, class A> void put(std::string &o, const std::set<T, C, A> &v, Ctx &c);
template <class T, class C, class A> void put(std::string &o, const std::multiset<T, C, A> &v, Ctx &c);
template <class T, class H, class E, class A> void put(std::string &o, const std::unordered_set<T, H, E, A> &v, Ctx &c);
template <class K, class V, class C, class A> void put(std::string &o, const std::map<K, V, C, A> &v, Ctx &c);
template <class K, class V, class C, class A> void put(std::string &o, const std::multimap<K, V, C, A> &v, Ctx &c);
template <class K, class V, class H, class E, class A> void put(std::string &o, const std::unordered_map<K, V, H, E, A> &v, Ctx &c);
template <class A, class B> void put(std::string &o, const std::pair<A, B> &v, Ctx &c);
template <class T, class S> void put(std::string &o, const std::stack<T, S> &v, Ctx &c);
template <class T, class S> void put(std::string &o, const std::queue<T, S> &v, Ctx &c);
template <class T, class S, class C> void put(std::string &o, const std::priority_queue<T, S, C> &v, Ctx &c);
template <class T, class D> void put(std::string &o, const std::unique_ptr<T, D> &v, Ctx &c);
template <class T> void put(std::string &o, const std::shared_ptr<T> &v, Ctx &c);

template <class It> void seq(std::string &o, const char *kind, It b, It e, long len, Ctx &c) {
  o += "{\"t\":\"list\",\"kind\":\""; o += kind; o += "\",\"len\":"; o += std::to_string(len); o += ",\"items\":[";
  int i = 0;
  for (; b != e && i < 50; ++b, ++i) { if (i) o += ","; c.depth++; put(o, *b, c); c.depth--; }
  o += "]}";
}
template <class It> void kv(std::string &o, const char *kind, It b, It e, long len, Ctx &c) {
  o += "{\"t\":\"map\",\"kind\":\""; o += kind; o += "\",\"len\":"; o += std::to_string(len); o += ",\"entries\":[";
  int i = 0;
  for (; b != e && i < 50; ++b, ++i) {
    if (i) o += ",";
    o += "["; c.depth++; put(o, b->first, c); o += ","; put(o, b->second, c); c.depth--; o += "]";
  }
  o += "]}";
}
/* The protected container inside stack/queue/priority_queue. */
template <class Ad> struct Inner : Ad { static const typename Ad::container_type &of(const Ad &a) { return a.*(&Inner::c); } };

template <class T> auto obj(std::string &o, const T &x, Ctx &c, int) -> decltype(T::__tb_put(o, x, c), void()) {
  const void *p = (const void *)std::addressof(x);
  if (seen(c, p)) { o += "{\"t\":\"ref\",\"id\":"; idOf(o, p); o += "}"; return; }
  if (c.depth > 6) { o += "{\"t\":\"other\",\"v\":\"...\"}"; return; }
  o += "{\"t\":\"obj\",\"cls\":\""; o += T::__tb_name(); o += "\",\"id\":"; idOf(o, p); o += ",\"fields\":[";
  c.depth++; T::__tb_put(o, x, c); c.depth--;
  o += "]}";
}
template <class T> void obj(std::string &o, const T &, Ctx &, long) { o += "{\"t\":\"other\",\"v\":\"object\"}"; }
template <class T> typename std::enable_if<std::is_enum<T>::value>::type any(std::string &o, const T &x, Ctx &) { num(o, (long long)x); }
template <class T> typename std::enable_if<!std::is_enum<T>::value>::type any(std::string &o, const T &x, Ctx &c) { obj(o, x, c, 0); }
template <class T> void put(std::string &o, const T &x, Ctx &c) { any(o, x, c); }

template <class T> typename std::enable_if<std::is_same<typename std::remove_cv<T>::type, char>::value>::type ptr(std::string &o, T *p, Ctx &) {
  size_t n = 0;
  while (n < 200 && ok(p + n, 1) && p[n]) n++;
  if (n == 0 && !ok(p, 1)) { o += "{\"t\":\"ptr\",\"v\":"; addr(o, p); o += "}"; return; }
  o += "{\"t\":\"str\",\"v\":"; jstr(o, p, n); o += "}";
}
template <class T> typename std::enable_if<std::is_void<T>::value || std::is_function<T>::value>::type ptr(std::string &o, T *p, Ctx &) {
  o += "{\"t\":\"ptr\",\"v\":"; addr(o, (const void *)p); o += "}";
}
template <class T> typename std::enable_if<!std::is_void<T>::value && !std::is_function<T>::value && !std::is_same<typename std::remove_cv<T>::type, char>::value>::type ptr(std::string &o, T *p, Ctx &c) {
  o += "{\"t\":\"ptr\",\"v\":"; addr(o, (const void *)p);
  if (c.depth < 6 && ok((const void *)p, (long)sizeof(T))) { o += ",\"to\":"; c.depth++; put(o, *p, c); c.depth--; }
  o += "}";
}
template <class T> void put(std::string &o, T *const &p, Ctx &c) {
  if (!p) { o += "{\"t\":\"none\",\"v\":\"nullptr\"}"; return; }
  ptr(o, p, c);
}
template <class T, size_t N> void put(std::string &o, const T (&a)[N], Ctx &c) {
  if (std::is_same<typename std::remove_cv<T>::type, char>::value) {
    size_t n = 0;
    while (n < N && ((const char *)a)[n]) n++;
    o += "{\"t\":\"str\",\"v\":"; jstr(o, (const char *)a, n); o += "}";
    return;
  }
  seq(o, "array", a, a + N, (long)N, c);
}
template <class T, class A> void put(std::string &o, const std::vector<T, A> &v, Ctx &c) { seq(o, "vector", v.begin(), v.end(), (long)v.size(), c); }
template <class T, size_t N> void put(std::string &o, const std::array<T, N> &v, Ctx &c) { seq(o, "array", v.begin(), v.end(), (long)N, c); }
template <class T, class A> void put(std::string &o, const std::deque<T, A> &v, Ctx &c) { seq(o, "deque", v.begin(), v.end(), (long)v.size(), c); }
template <class T, class A> void put(std::string &o, const std::list<T, A> &v, Ctx &c) { seq(o, "list", v.begin(), v.end(), (long)v.size(), c); }
template <class T, class A> void put(std::string &o, const std::forward_list<T, A> &v, Ctx &c) { seq(o, "forward_list", v.begin(), v.end(), (long)std::distance(v.begin(), v.end()), c); }
template <class T, class C, class A> void put(std::string &o, const std::set<T, C, A> &v, Ctx &c) { seq(o, "set", v.begin(), v.end(), (long)v.size(), c); }
template <class T, class C, class A> void put(std::string &o, const std::multiset<T, C, A> &v, Ctx &c) { seq(o, "multiset", v.begin(), v.end(), (long)v.size(), c); }
template <class T, class H, class E, class A> void put(std::string &o, const std::unordered_set<T, H, E, A> &v, Ctx &c) { seq(o, "unordered_set", v.begin(), v.end(), (long)v.size(), c); }
template <class K, class V, class C, class A> void put(std::string &o, const std::map<K, V, C, A> &v, Ctx &c) { kv(o, "map", v.begin(), v.end(), (long)v.size(), c); }
template <class K, class V, class C, class A> void put(std::string &o, const std::multimap<K, V, C, A> &v, Ctx &c) { kv(o, "multimap", v.begin(), v.end(), (long)v.size(), c); }
template <class K, class V, class H, class E, class A> void put(std::string &o, const std::unordered_map<K, V, H, E, A> &v, Ctx &c) { kv(o, "unordered_map", v.begin(), v.end(), (long)v.size(), c); }
template <class A, class B> void put(std::string &o, const std::pair<A, B> &v, Ctx &c) {
  o += "{\"t\":\"list\",\"kind\":\"pair\",\"len\":2,\"items\":["; put(o, v.first, c); o += ","; put(o, v.second, c); o += "]}";
}
template <class T, class S> void put(std::string &o, const std::stack<T, S> &v, Ctx &c) { const S &in = Inner<std::stack<T, S>>::of(v); seq(o, "stack", in.begin(), in.end(), (long)in.size(), c); }
template <class T, class S> void put(std::string &o, const std::queue<T, S> &v, Ctx &c) { const S &in = Inner<std::queue<T, S>>::of(v); seq(o, "queue", in.begin(), in.end(), (long)in.size(), c); }
template <class T, class S, class C> void put(std::string &o, const std::priority_queue<T, S, C> &v, Ctx &c) { const S &in = Inner<std::priority_queue<T, S, C>>::of(v); seq(o, "priority_queue", in.begin(), in.end(), (long)in.size(), c); }
template <class T, class D> void put(std::string &o, const std::unique_ptr<T, D> &v, Ctx &c) { T *p = v.get(); put(o, p, c); }
template <class T> void put(std::string &o, const std::shared_ptr<T> &v, Ctx &c) { T *p = v.get(); put(o, p, c); }

/* Field helper used by the generated __tb_put members. */
template <class T> void field(std::string &o, int i, const char *n, const T &x, Ctx &c) {
  if (i) o += ",";
  o += "{\"name\":\""; o += n; o += "\",\"value\":"; put(o, x, c); o += "}";
}

template <class T> void printer(std::string &o, const void *p, long, Ctx &c) { put(o, *(const T *)p, c); }
template <class T> void arrPrinter(std::string &o, const void *p, long n, Ctx &c) {
  T *const *pp = (T *const *)p;
  T *a = *pp;
  if (n < 0) n = 0;
  if (!a) { o += "{\"t\":\"none\",\"v\":\"nullptr\"}"; return; }
  if (n > 0 && !ok((const void *)a, (n < 50 ? n : 50) * (long)sizeof(T))) { o += "{\"t\":\"ptr\",\"v\":"; addr(o, (const void *)a); o += "}"; return; }
  seq(o, "array", a, a + (n < 50 ? n : 50), n, c);
}
inline void globals();
inline void init() { inited = 1; fs[0].id = 1; fs[0].n = "global"; fs[0].l = 0; fs[0].nv = 0; globals(); }
inline Fr &top() { return fs[d > MAXF ? MAXF : d]; }
inline int b(int line) { if (!inited) init(); if (d <= MAXF) { top().l = line; top().nv = 0; } return 0; }
inline void add(Fr &f, const char *n, const void *p, long n1, Printer pr) {
  if (f.nv >= 48) return;
  f.v[f.nv].n = n; f.v[f.nv].p = p; f.v[f.nv].n1 = n1; f.v[f.nv].f = pr; f.nv++;
}
template <class T> int var(const char *n, const T &x) { if (d <= MAXF) add(top(), n, (const void *)std::addressof(x), 0, &printer<T>); return 0; }
template <class T> int arr(const char *n, T *const &p, long len) { if (d <= MAXF) add(top(), n, (const void *)&p, len, &arrPrinter<T>); return 0; }
template <class T> int gvar(const char *n, const T &x) { add(fs[0], n, (const void *)std::addressof(x), 0, &printer<T>); return 0; }
template <class T> int ret(const T &x) { rv.p = (const void *)std::addressof(x); rv.f = &printer<T>; hasRet = true; return 0; }
[[noreturn]] inline void limit(const char *why) {
  std::cout << "\x1e{\"e\":\"limit\",\"why\":\"" << why << "\"}\x1f" << std::flush;
  std::exit(0);
}
inline int e(int ev) {
  static const char *names[] = {"line", "call", "return"};
  if (!inited) init();
  if (d > MAXF) { hasRet = false; return 0; }
  if (steps >= TB_MAX_STEPS) limit("steps");
  if (bytes > TB_MAX_BYTES) limit("size");
  steps++;
  std::string o;
  o.reserve(2048);
  o += "\x1e{\"e\":\""; o += names[ev]; o += "\",\"l\":"; o += std::to_string(top().l); o += ",\"f\":[";
  Ctx c;
  bool first = true;
  int last = d > MAXF ? MAXF : d;
  for (int i = fs[0].nv ? 0 : 1; i <= last; i++) {
    Fr &f = fs[i];
    if (!first) o += ",";
    first = false;
    o += "{\"i\":"; o += std::to_string(f.id); o += ",\"n\":"; jstr(o, f.n, std::strlen(f.n)); o += ",\"l\":"; o += std::to_string(f.l); o += ",\"v\":[";
    for (int j = 0; j < f.nv; j++) {
      if (j) o += ",";
      o += "[\""; o += f.v[j].n; o += "\","; f.v[j].f(o, f.v[j].p, f.v[j].n1, c); o += "]";
      if (o.size() > 60000) break;
    }
    o += "]}";
  }
  o += "]";
  if (ev == 2 && hasRet) { o += ",\"r\":"; rv.f(o, rv.p, 0, c); }
  o += "}\x1f";
  hasRet = false;
  bytes += (long)o.size();
  std::cout << o << std::flush;
  return 0;
}
struct Frame {
  Frame(const char *n, int line) {
    if (!inited) init();
    d++;
    if (d <= MAXF) { Fr &f = fs[d]; f.id = ++nextId; f.n = n; f.l = line; f.nv = 0; }
  }
  ~Frame() { d--; }
};
/* The names the instrumented program calls (unusual on purpose, so the program's own macros can't clash). */
inline int tbLine(int line) { return b(line); }
inline int tbEv(int ev) { return e(ev); }
template <class T> int tbVar(const char *n, const T &x) { return var(n, x); }
template <class T> int tbArr(const char *n, T *const &p, long len) { return arr(n, p, len); }
template <class T> int tbRet(const T &x) { return ret(x); }
template <class T> int tbGlobal(const char *n, const T &x) { return gvar(n, x); }
template <class T> void tbField(std::string &o, int i, const char *n, const T &x, Ctx &c) { field(o, i, n, x, c); }
typedef Frame TbFrame;
} // namespace __tb
/* ---- your program ---- */
`;
