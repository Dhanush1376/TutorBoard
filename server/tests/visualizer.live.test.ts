import { describe, it, expect } from 'vitest';
import { traceCompiled } from '../visualizer/traceService.js';

/**
 * Real runs in the Judge0 sandbox: does the instrumented program still compile,
 * run, and report the values the program really had? Off by default (it needs
 * the network and a Judge0 instance):  VISUALIZER_LIVE=1 npx vitest run tests/visualizer.live.test.ts
 */
const live = !!process.env.VISUALIZER_LIVE;

const lastOf = (t: any, line: number) => [...t.steps].reverse().find((s: any) => s.line === line);
const local = (step: any, name: string) => step.frames[step.frames.length - 1].locals.find((l: any) => l.name === name)?.value;
const nums = (v: any) => v.items.map((x: any) => x.v);
const traced = (t: any) => {
  if (t.error && !['runtime', 'limit', 'timeout'].includes(t.error.kind)) throw new Error(`${t.error.kind}: ${t.error.message}`);
  expect(t.steps.length).toBeGreaterThan(0);
  return t;
};

describe.skipIf(!live)('C in the sandbox', () => {
  it('structs, arrays of structs, 2D array parameters, globals, stdin and do-while', async () => {
    const src = `#include <stdio.h>
#include <string.h>
typedef struct { int x, y; } Point;
struct Student { char name[16]; int score; };
int counter = 7;
int total(int g[][3], int n) {
    int t = 0;
    for (int r = 0; r < n; r++) for (int c = 0; c < 3; c++) t += g[r][c];
    return t;
}
int main() {
    Point p = {2, 3};
    struct Student s[2];
    strcpy(s[0].name, "Ada"); s[0].score = 90;
    strcpy(s[1].name, "Lin"); s[1].score = 85;
    int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};
    int k;
    scanf("%d", &k);
    int sum = total(grid, 2);
    do { k--; } while (k > 0);
    const char *msg = "done";
    printf("%d %d %s %d\\n", sum, p.x + p.y, msg, counter);
    return 0;
}
`;
    const t = traced(await traceCompiled('c', src, '3\n'));
    expect(t.stdout).toBe('21 5 done 7\n');
    const call = t.steps.find((s: any) => s.event === 'call' && s.frames.at(-1).name === 'total');
    expect(local(call, 'g').items.map((row: any) => nums(row))).toEqual([[1, 2, 3], [4, 5, 6]]);
    const end = lastOf(t, 22); // about to print: everything is set
    expect(local(end, 'p')).toMatchObject({ t: 'obj', cls: 'Point' });
    expect(local(end, 's').items[1].fields.find((f: any) => f.name === 'name').value.v).toBe('Lin');
    expect(local(end, 'k').v).toBe(0);
    expect(local(end, 'msg').v).toBe('done');
    expect(end.frames[0]).toMatchObject({ name: 'global' });
  }, 60000);

  it('a crash ends the trace at the line that crashed', async () => {
    const t = await traceCompiled('c', '#include <stdio.h>\nint main() {\n    int *p = NULL;\n    printf("before\\n");\n    *p = 5;\n    return 0;\n}\n');
    expect(t.error).toMatchObject({ kind: 'runtime', line: 5 });
    expect(t.stdout).toBe('before\n');
  }, 60000);

  it('an endless loop stops at the step limit', async () => {
    const t = await traceCompiled('c', 'int main() {\n    int i = 0;\n    while (1) { i++; }\n}\n');
    expect(t.truncated).toBe(true);
    expect(t.error?.kind).toBe('limit');
    expect(t.steps.length).toBe(500);
  }, 60000);

  it('bad pointers show as addresses instead of crashing the program', async () => {
    const src = '#include <stdlib.h>\nstruct N { int v; struct N *next; };\nint main() {\n    struct N *a = malloc(sizeof(struct N));\n    a->v = 1;\n    a->next = (struct N *)0x10;\n    int x = a->v;\n    return x;\n}\n';
    const t = traced(await traceCompiled('c', src));
    expect(t.error?.kind).toBe('runtime'); // exit code 1 from `return x`, not a crash
    const s = lastOf(t, 8);
    expect(local(s, 'a').to.fields[1].value).toMatchObject({ t: 'ptr', v: expect.stringMatching(/^0x10$/) });
  }, 60000);
});

describe.skipIf(!live)('C++ in the sandbox', () => {
  it('classes, templates, containers, smart pointers, lambdas and range-for', async () => {
    const src = `#include <bits/stdc++.h>
using namespace std;
template <typename T> T biggest(const vector<T>& v) { T b = v[0]; for (const T& x : v) if (x > b) b = x; return b; }
class Account {
    string owner; double balance;
public:
    Account(string o, double b) : owner(o), balance(b) {}
    void deposit(double a) { balance += a; }
    double get() const { return balance; }
};
struct Tree { int val; Tree *left = nullptr, *right = nullptr; Tree(int v) : val(v) {} };
int main() {
    ios::sync_with_stdio(false);
    vector<int> v = {4, 9, 2};
    map<string, int> m{{"a", 1}};
    set<int> s{3, 1};
    pair<int, string> pr{1, "x"};
    unique_ptr<Tree> root = make_unique<Tree>(5);
    root->left = new Tree(3);
    Account acc("Ana", 10);
    acc.deposit(5);
    auto twice = [](int x) { return 2 * x; };
    int best = biggest(v);
    queue<int> q; q.push(7);
    cout << best << " " << acc.get() << " " << twice(best) << "\\n";
    return 0;
}
`;
    const t = traced(await traceCompiled('cpp', src));
    expect(t.stdout).toBe('9 15 18\n');
    const end = lastOf(t, 26);
    expect(nums(local(end, 'v'))).toEqual([4, 9, 2]);
    expect(local(end, 'm')).toMatchObject({ t: 'map', len: 1 });
    expect(nums(local(end, 's'))).toEqual([1, 3]);
    expect(local(end, 'acc').fields.map((f: any) => f.name)).toEqual(['owner', 'balance']);
    expect(local(end, 'root').to.fields.find((f: any) => f.name === 'left').value.to.fields[0].value.v).toBe(3);
    expect(nums(local(end, 'q'))).toEqual([7]);
    const ret = t.steps.find((s: any) => s.event === 'return' && s.frames.at(-1).name === 'biggest');
    expect(ret.ret.v).toBe(9);
  }, 60000);

  it('competitive-programming style: #define int long long, signed main, deep recursion', async () => {
    const src = `#include <bits/stdc++.h>
#define int long long
using namespace std;
int depth(int n) { if (n == 0) return 0; return 1 + depth(n - 1); }
signed main() {
    int n = 70;
    cout << depth(n) << endl;
    return 0;
}
`;
    const t = traced(await traceCompiled('cpp', src));
    expect(t.stdout).toBe('70\n');
    expect(Math.max(...t.steps.map((s: any) => s.frames.length))).toBeLessThanOrEqual(65);
  }, 60000);

  it('an uncaught exception is reported with its message', async () => {
    const t = await traceCompiled('cpp', '#include <vector>\nint main() {\n    std::vector<int> v(2);\n    return v.at(5);\n}\n');
    expect(t.error?.kind).toBe('runtime');
    expect(t.error?.message).toMatch(/out_of_range/);
  }, 60000);
});

describe.skipIf(!live)('Java in the sandbox', () => {
  it('inheritance, interfaces, anonymous classes, lambdas, generics, switch and Scanner', async () => {
    const src = `import java.util.*;
import java.util.function.*;

public class Main {
    interface Shape { double area(); default String label() { return "shape"; } }
    static class Square implements Shape {
        double s;
        Square(double s) { this.s = s; }
        public double area() { return s * s; }
    }
    static class Cube extends Square {
        Cube(double s) { super(s); }
        @Override public String label() { return "cube"; }
    }
    static <T extends Comparable<T>> T max(List<T> xs) {
        T best = xs.get(0);
        for (T x : xs) if (x.compareTo(best) > 0) best = x;
        return best;
    }
    static String grade(int score) {
        switch (score / 10) {
            case 10: case 9: return "A";
            case 8: return "B";
            default: return "C";
        }
    }
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        Shape sq = new Cube(n);
        Comparator<Integer> rev = new Comparator<Integer>() {
            public int compare(Integer a, Integer b) { return b - a; }
        };
        List<Integer> xs = new ArrayList<>(List.of(3, 8, 1));
        xs.sort(rev);
        Function<Integer, Integer> inc = x -> x + 1;
        StringBuilder sb = new StringBuilder("hi");
        int m;
        try { m = Integer.parseInt("x"); } catch (NumberFormatException e) { m = -1; } finally { sb.append("!"); }
        System.out.println(sq.label() + " " + sq.area() + " " + max(xs) + " " + inc.apply(1) + " " + grade(85) + " " + m + " " + sb);
    }
}
`;
    const t = traced(await traceCompiled('java', src, '2\n'));
    expect(t.stdout).toBe('cube 4.0 8 2 B -1 hi!\n');
    const end = lastOf(t, 40);
    expect(nums(local(end, 'xs'))).toEqual([8, 3, 1]);
    expect(local(end, 'sq')).toMatchObject({ t: 'obj', cls: 'Cube' });
    const gradeRet = t.steps.find((s: any) => s.event === 'return' && s.frames.at(-1).name === 'grade');
    expect(gradeRet.ret.v).toBe('B');
    expect(t.steps.some((s: any) => s.frames.at(-1).name === 'compare')).toBe(true);
    // Thrown inside parseInt and caught in main: the catch block's `e` shows it.
    expect(t.steps.some((s: any) => /NumberFormatException/.test(local(s, 'e')?.v || ''))).toBe(true);
  }, 60000);

  it('an uncaught exception points at its line', async () => {
    const t = await traceCompiled('java', 'public class Main {\n    public static void main(String[] args) {\n        int[] a = new int[2];\n        a[3] = 1;\n    }\n}\n');
    expect(t.error).toMatchObject({ kind: 'runtime', line: 4 });
    expect(t.error?.message).toMatch(/ArrayIndexOutOfBounds/);
  }, 60000);

  it('a learner\'s compile error comes back as the compiler wrote it', async () => {
    const t = await traceCompiled('java', 'public class Main {\n    public static void main(String[] args) {\n        int x = "a";\n    }\n}\n');
    expect(t.error).toMatchObject({ kind: 'compile', line: 3 });
    expect(t.error?.message).toMatch(/incompatible types/);
  }, 60000);
});
