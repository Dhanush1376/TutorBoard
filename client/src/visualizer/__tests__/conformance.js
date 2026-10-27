/**
 * The same checks for every language the walkthrough runs (not a test file itself:
 * conformance.test.js runs Python and JavaScript; server/tests/visualizer.live.test.ts
 * runs C, C++ and Java in the Judge0 sandbox).
 *
 * Each language runs the same bubble sort (with a swap counter) and a program that
 * fails. From the recorded trace alone, a run must show:
 *   1 variables being assigned        5 an array changing over time
 *   2 a condition going both ways     6 the sort's correct result
 *   3 a loop running                  7 a runtime error, at the line that failed
 *   4 a call and its return value     8 the program ending, with its real output
 */
import { variableHistory, nextHint, buildCallTree } from '../analysis';

const SORT_OUTPUT = '1 2 3 4 5 6';

export const PROGRAMS = {
  python: {
    fn: 'bubble_sort',
    sort: `def bubble_sort(arr):
    swaps = 0
    n = len(arr)
    for i in range(n):
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swaps += 1
    return swaps

data = [5, 1, 4, 2, 3]
count = bubble_sort(data)
print(*data, count)
`,
    error: { source: 'def get(items, k):\n    return items[k]\n\nnums = [1, 2, 3]\nprint(get(nums, 5))\n', line: 2, message: /IndexError/ },
  },
  javascript: {
    fn: 'bubbleSort',
    sort: `function bubbleSort(arr) {
  let swaps = 0;
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      if (arr[j] > arr[j + 1]) {
        const t = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = t;
        swaps++;
      }
    }
  }
  return swaps;
}

const data = [5, 1, 4, 2, 3];
const count = bubbleSort(data);
console.log(data.join(' '), count);
`,
    error: { source: 'function get(items, k) {\n  return items[k].value;\n}\nconst nums = [1, 2, 3];\nconsole.log(get(nums, 5));\n', line: 2, message: /TypeError/ },
  },
  c: {
    fn: 'bubble_sort',
    sort: `#include <stdio.h>

int bubble_sort(int arr[], int n) {
    int swaps = 0;
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                int t = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = t;
                swaps++;
            }
        }
    }
    return swaps;
}

int main(void) {
    int data[] = {5, 1, 4, 2, 3};
    int count = bubble_sort(data, 5);
    printf("%d %d %d %d %d %d\\n", data[0], data[1], data[2], data[3], data[4], count);
    return 0;
}
`,
    error: { source: '#include <stdio.h>\n\nint divide(int a, int b) {\n    return a / b;\n}\n\nint main(void) {\n    int zero = 0;\n    printf("%d\\n", divide(10, zero));\n    return 0;\n}\n', line: 4, message: /arithmetic error|dividing by zero/i },
  },
  cpp: {
    fn: 'bubbleSort',
    sort: `#include <iostream>
#include <vector>

int bubbleSort(std::vector<int>& arr) {
    int swaps = 0;
    int n = (int)arr.size();
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                int t = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = t;
                swaps++;
            }
        }
    }
    return swaps;
}

int main() {
    std::vector<int> data = {5, 1, 4, 2, 3};
    int count = bubbleSort(data);
    for (int x : data) std::cout << x << ' ';
    std::cout << count << std::endl;
    return 0;
}
`,
    error: { source: '#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> v = {1, 2, 3};\n    int total = 0;\n    total += v.at(5);\n    std::cout << total << std::endl;\n    return 0;\n}\n', line: 7, message: /out_of_range/ },
  },
  java: {
    fn: 'bubbleSort',
    sort: `public class Main {
    static int bubbleSort(int[] arr) {
        int swaps = 0;
        int n = arr.length;
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n - 1 - i; j++) {
                if (arr[j] > arr[j + 1]) {
                    int t = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = t;
                    swaps++;
                }
            }
        }
        return swaps;
    }

    public static void main(String[] args) {
        int[] data = {5, 1, 4, 2, 3};
        int count = bubbleSort(data);
        StringBuilder out = new StringBuilder();
        for (int x : data) out.append(x).append(' ');
        System.out.println(out.toString() + count);
    }
}
`,
    error: { source: 'public class Main {\n    public static void main(String[] args) {\n        int[] nums = {1, 2, 3};\n        int i = 5;\n        System.out.println(nums[i]);\n    }\n}\n', line: 5, message: /ArrayIndexOutOfBounds/ },
  },
};

const numbers = (v) => (v && v.t === 'list' ? v.items.map((x) => x.v) : null);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Problems with a bubble-sort run, as plain sentences; [] when all eight checks hold. */
export function checkSortRun(trace, language) {
  const { fn } = PROGRAMS[language];
  const problems = [];
  const fail = (m) => problems.push(`${language}: ${m}`);
  if (!trace.steps.length) return [`${language}: no steps (${trace.error?.message || 'no error either'})`];
  const lines = trace.source.split('\n');

  // 8 — it ends, with the program's real output, and the trace knows it ended
  if (trace.error) fail(`stopped with an error: ${trace.error.message}`);
  if (trace.truncated) fail('the trace was cut off');
  if (!trace.stdout.trim().startsWith(SORT_OUTPUT)) fail(`printed ${JSON.stringify(trace.stdout)}`);
  if (trace.steps[trace.steps.length - 1].event !== 'return') fail('the last step is not the program finishing');
  if (trace.steps.some((s) => s.line < 1 || s.line > lines.length)) fail('a step points outside the program');

  // 1 — variables: `count` is assigned the number of swaps in the outermost frame
  const outer = trace.steps[trace.steps.length - 1].frames[0].id;
  const count = variableHistory(trace, outer, 'count');
  if (count[count.length - 1]?.value?.v !== 6) fail(`count ended as ${JSON.stringify(count[count.length - 1]?.value)}`);

  // 5, 6 — the array is seen changing, from the input to the sorted result
  const data = variableHistory(trace, outer, 'data').map((h) => numbers(h.value)).filter(Boolean);
  if (!same(data[0], [5, 1, 4, 2, 3])) fail(`data started as ${JSON.stringify(data[0])}`);
  if (!same(data[data.length - 1], [1, 2, 3, 4, 5])) fail(`data ended as ${JSON.stringify(data[data.length - 1])}`);
  if (data.length < 4) fail(`data was seen with only ${data.length} values`);

  // 4 — one call to the sort, returning 6
  const calls = [...buildCallTree(trace).nodes.values()].filter((n) => n.name.includes(fn));
  if (calls.length !== 1) fail(`${calls.length} calls to ${fn}`);
  else if (calls[0].ret?.v !== 6) fail(`${fn} returned ${JSON.stringify(calls[0].ret)}`);

  // 3 — the inner loop runs again and again
  const loopLine = lines.findIndex((l) => /\bfor\b.*\bj\b/.test(l)) + 1;
  const loopRuns = trace.steps.filter((s) => s.line === loopLine).length;
  if (loopRuns < 10) fail(`the inner loop's line ran ${loopRuns} times`);

  // 2 — the comparison goes both ways, read from where the next step lands
  const ifLine = lines.findIndex((l) => /\bif\b.*>/.test(l)) + 1;
  const ways = new Set(trace.steps.map((s, i) => (s.line === ifLine ? nextHint(trace, i)?.branch : null)).filter(Boolean));
  if (!ways.has('in') || !ways.has('out')) fail(`the if went ${[...ways].join(' and ') || 'nowhere'}`);
  return problems;
}

/** Problems with a run that should fail at a known line; [] when it does. */
export function checkErrorRun(trace, language) {
  const { line, message } = PROGRAMS[language].error;
  const problems = [];
  const fail = (m) => problems.push(`${language} error: ${m}`);
  if (!trace.error) fail('no error was reported');
  else {
    if (trace.error.kind !== 'runtime') fail(`error kind ${trace.error.kind}: ${trace.error.message}`);
    if (!message.test(trace.error.message)) fail(`message "${trace.error.message}"`);
    if (trace.error.line !== line) fail(`reported at line ${trace.error.line}, not ${line}`);
  }
  if (!trace.steps.some((s) => s.line === line)) fail(`no step ran line ${line}`);
  return problems;
}
