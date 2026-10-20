/**
 * The Java step recorder: one extra top-level class appended after the
 * learner's code (so their line numbers don't move) before it goes to Judge0.
 * Same output protocol as the C recorder (see cRuntime.ts).
 *
 * Each step hands over the frame's variables as an Object[]. Primitives can't
 * change behind a frame's back, and objects and arrays are held by reference
 * and read when the step is printed, so every frame's values are current.
 */
export const javaRuntime = (maxSteps: number, maxBytes: number) => String.raw`
/* ---- TutorBoard step recorder (not part of your program) ---- */
final class __TB {
    static final class Fr { int id; String n; int l; String[] names = new String[0]; Object[] vals = new Object[0]; boolean returned, threw; }
    static final java.util.ArrayList<Fr> st = new java.util.ArrayList<>();
    static int nextId = 1, steps = 0;
    static Throwable lastExc;
    static long bytes = 0;
    static final Fr global = new Fr();
    static { global.id = 1; global.n = "global"; }
    static void out(String s) { System.out.print(s); System.out.flush(); }
    static void limit(String why) { out("\u001e{\"e\":\"limit\",\"why\":\"" + why + "\"}\u001f"); System.exit(0); }
    static Fr top() { return st.isEmpty() ? global : st.get(st.size() - 1); }
    static void set(int line, String[] names, Object[] vals) { Fr f = top(); f.l = line; f.names = names; f.vals = vals; }
    public static void s(int line, String[] names, Object[] vals) { set(line, names, vals); emit("line", null, false, null); }
    public static boolean t(int line, String[] names, Object[] vals) { s(line, names, vals); return true; }
    public static Fr enter(String name, int line, String[] names, Object[] vals) {
        Fr f = new Fr(); f.id = ++nextId; f.n = name; f.l = line; f.names = names; f.vals = vals;
        st.add(f);
        emit("call", null, false, null);
        return f;
    }
    public static <T> T ret(T v, int line, String[] names, Object[] vals) { set(line, names, vals); emit("return", v, true, null); top().returned = true; return v; }
    public static void retVoid(int line, String[] names, Object[] vals) { set(line, names, vals); emit("return", null, false, null); top().returned = true; }
    public static void exc(Fr f, Throwable e) {
        f.threw = true;
        if (e == lastExc) return; // one step per throw, not one per frame it passes through
        lastExc = e;
        emit("exception", null, false, e.toString());
    }
    public static void exit(Fr f, int endLine) {
        if (!f.returned && !f.threw && top() == f) { f.l = endLine; emit("return", null, false, null); }
        st.remove(f);
    }
    static void emit(String ev, Object ret, boolean hasRet, String exc) {
        if (steps >= ${maxSteps}) limit("steps");
        if (bytes > ${maxBytes}L) limit("size");
        steps++;
        StringBuilder o = new StringBuilder(1024);
        o.append("\u001e{\"e\":\"").append(ev).append("\",\"l\":").append(top().l).append(",\"f\":[");
        java.util.IdentityHashMap<Object, Boolean> seen = new java.util.IdentityHashMap<>();
        boolean first = true;
        java.util.ArrayList<Fr> frames = new java.util.ArrayList<>();
        if (global.names.length > 0) frames.add(global);
        frames.addAll(st);
        for (Fr f : frames) {
            if (!first) o.append(',');
            first = false;
            o.append("{\"i\":").append(f.id).append(",\"n\":");
            str(o, f.n);
            o.append(",\"l\":").append(f.l).append(",\"v\":[");
            for (int i = 0; i < f.names.length && i < f.vals.length; i++) {
                if (i > 0) o.append(',');
                o.append("[\"").append(f.names[i]).append("\",");
                val(o, f.vals[i], seen, 0);
                o.append(']');
            }
            o.append("]}");
        }
        o.append(']');
        if (hasRet) { o.append(",\"r\":"); val(o, ret, seen, 0); }
        if (exc != null) { o.append(",\"m\":"); str(o, exc); }
        o.append("}\u001f");
        bytes += o.length();
        out(o.toString());
    }
    static void str(StringBuilder o, String s) {
        o.append('"');
        int n = Math.min(s.length(), 200);
        for (int i = 0; i < n; i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') o.append('\\').append(c);
            else if (c == '\n') o.append("\\n");
            else if (c == '\t') o.append("\\t");
            else if (c < 0x20 || c == 0x7f || c == 0x1e || c == 0x1f) o.append(String.format("\\u%04x", (int) c));
            else o.append(c);
        }
        o.append('"');
    }
    static void num(StringBuilder o, Number n) {
        if (n instanceof Double || n instanceof Float) {
            double d = n.doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) { o.append("{\"t\":\"num\",\"v\":\"").append(d).append("\"}"); return; }
            o.append("{\"t\":\"num\",\"v\":").append(d).append('}');
            return;
        }
        long v = n.longValue();
        if (Math.abs(v) > 9007199254740991L) o.append("{\"t\":\"num\",\"v\":\"").append(v).append("\"}");
        else o.append("{\"t\":\"num\",\"v\":").append(v).append('}');
    }
    static void val(StringBuilder o, Object v, java.util.IdentityHashMap<Object, Boolean> seen, int depth) {
        if (v == null) { o.append("{\"t\":\"none\",\"v\":\"null\"}"); return; }
        if (v instanceof Boolean) { o.append("{\"t\":\"bool\",\"v\":").append(v).append('}'); return; }
        if (v instanceof Character) { o.append("{\"t\":\"str\",\"kind\":\"char\",\"v\":"); str(o, v.toString()); o.append('}'); return; }
        if (v instanceof Number && (v instanceof Integer || v instanceof Long || v instanceof Short || v instanceof Byte || v instanceof Double || v instanceof Float)) { num(o, (Number) v); return; }
        if (v instanceof String) {
            String s = (String) v;
            o.append("{\"t\":\"str\",\"v\":"); str(o, s);
            if (s.length() > 200) o.append(",\"more\":").append(s.length() - 200);
            o.append('}');
            return;
        }
        if (v instanceof java.math.BigInteger || v instanceof java.math.BigDecimal) { o.append("{\"t\":\"num\",\"v\":"); str(o, v.toString()); o.append('}'); return; }
        if (v instanceof Enum) { o.append("{\"t\":\"other\",\"v\":"); str(o, v.toString()); o.append('}'); return; }
        int id = System.identityHashCode(v);
        if (seen.containsKey(v)) { o.append("{\"t\":\"ref\",\"id\":").append(id).append('}'); return; }
        if (depth > 6) { o.append("{\"t\":\"other\",\"v\":\"...\"}"); return; }
        seen.put(v, Boolean.TRUE);
        Class<?> c = v.getClass();
        if (c.isArray()) {
            int len = java.lang.reflect.Array.getLength(v);
            o.append("{\"t\":\"list\",\"kind\":\"array\",\"id\":").append(id).append(",\"len\":").append(len).append(",\"items\":[");
            for (int i = 0; i < len && i < 50; i++) { if (i > 0) o.append(','); val(o, java.lang.reflect.Array.get(v, i), seen, depth + 1); }
            o.append("]}");
            return;
        }
        if (v instanceof java.util.Map) {
            java.util.Map<?, ?> m = (java.util.Map<?, ?>) v;
            o.append("{\"t\":\"map\",\"kind\":\"").append(c.getSimpleName()).append("\",\"id\":").append(id).append(",\"len\":").append(m.size()).append(",\"entries\":[");
            int i = 0;
            for (java.util.Map.Entry<?, ?> en : m.entrySet()) {
                if (i >= 50) break;
                if (i++ > 0) o.append(',');
                o.append('['); val(o, en.getKey(), seen, depth + 1); o.append(','); val(o, en.getValue(), seen, depth + 1); o.append(']');
            }
            o.append("]}");
            return;
        }
        if (v instanceof java.util.Collection) {
            java.util.Collection<?> col = (java.util.Collection<?>) v;
            o.append("{\"t\":\"list\",\"kind\":\"").append(c.getSimpleName()).append("\",\"id\":").append(id).append(",\"len\":").append(col.size()).append(",\"items\":[");
            int i = 0;
            for (Object x : col) {
                if (i >= 50) break;
                if (i++ > 0) o.append(',');
                val(o, x, seen, depth + 1);
            }
            o.append("]}");
            return;
        }
        String pkg = c.getName();
        if (pkg.startsWith("java.") || pkg.startsWith("javax.") || pkg.startsWith("sun.") || pkg.startsWith("jdk.")) {
            o.append("{\"t\":\"other\",\"v\":"); str(o, String.valueOf(v)); o.append('}');
            return;
        }
        o.append("{\"t\":\"obj\",\"cls\":"); str(o, c.getSimpleName().isEmpty() ? c.getName() : c.getSimpleName());
        o.append(",\"id\":").append(id).append(",\"fields\":[");
        int i = 0;
        for (Class<?> k = c; k != null && k != Object.class; k = k.getSuperclass()) {
            for (java.lang.reflect.Field f : k.getDeclaredFields()) {
                if (java.lang.reflect.Modifier.isStatic(f.getModifiers()) || f.isSynthetic() || i >= 50) continue;
                Object x;
                try { f.setAccessible(true); x = f.get(v); } catch (Throwable e) { continue; }
                if (i++ > 0) o.append(',');
                o.append("{\"name\":"); str(o, f.getName()); o.append(",\"value\":"); val(o, x, seen, depth + 1); o.append('}');
            }
        }
        o.append("]}");
    }
}
`;
