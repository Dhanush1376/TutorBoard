export const DOMAIN_KEYWORDS = {
  dsa: [
    ['bubble sort', 3], ['merge sort', 3], ['quick sort', 3], ['insertion sort', 3],
    ['selection sort', 3], ['heap sort', 3], ['radix sort', 3], ['counting sort', 3],
    ['binary search', 3], ['depth first search', 3], ['breadth first search', 3],
    ['dynamic programming', 3], ['dijkstra', 3], ['bellman ford', 3], ['floyd warshall', 3],
    ['kruskal', 3], ["prim's algorithm", 3], ['topological sort', 3], ['union find', 3],
    ['sliding window', 3], ['two pointer', 3], ['fast slow pointer', 3],
    ['linked list', 2], ['binary tree', 2], ['binary search tree', 3], ['avl tree', 3],
    ['red black tree', 3], ['segment tree', 3], ['fenwick tree', 3], ['suffix array', 3],
    ['trie', 2], ['hash map', 2], ['hash table', 2], ['priority queue', 2],
    ['monotonic stack', 3], ['deque', 2], ['disjoint set', 3],
    ['big o', 2], ['time complexity', 2], ['space complexity', 2],
    ['array', 1], ['graph', 1], ['tree', 1], ['heap', 1], ['stack', 1], ['queue', 1],
    ['algorithm', 1], ['recursion', 1], ['bfs', 2], ['dfs', 2],
    ['dp', 1], ['memoization', 2], ['tabulation', 2],
    ['edge', 1], ['vertex', 1], ['pointer', 1], ['node', 1],
    ['sorting', 1], ['searching', 1], ['traversal', 1],
  ],
};

export const DOMAIN_NODE_TEMPLATES = {
  dsa: [
    'hook', 'prior_knowledge_bridge', 'concept', 'intuition',
    'complexity_analysis', 'step_by_step', 'worked_example',
    'visual', 'edge_case', 'common_mistake', 'real_world_application', 'result',
  ],
};

export const DOMAIN_ANIMATION_GUIDE = {
  dsa: `
ANIMATION STRATEGY — DSA / ALGORITHMS:
  Primitives: array, pointer, swapbridge, comparator, codeline, highlightbox
  Layout rules:
    - Array Sorting/Searching: STRICTLY use a SINGLE 'array' shape with a 'values' property (e.g. "values": [5,2,9,1]). Do NOT draw an array as multiple disconnected rectangles or flowcharts.
    - Swapping: Use 'swapbridge' to show swaps between indices.
    - Pointers: Use 'pointer' shape pointing to array indices.
    - Trees/graphs: root at (0.5, 0.2), children below. circle=node, type: "line"=edge.
  Step rhythm:
    - One comparison = one step. One swap = one step. One pointer move = one step.
    - codeline (x=0.2) shows pseudocode; highlight current executing line each step.
  MINIMUM STEPS: sorting=12 | searching=8 | trees=12 | graph traversal=14 | dp=16
`,
};
export const DOMAIN_MIN_STEPS = {
  dsa: { sort: 18, search: 10, tree: 12, graph: 14, dp: 16, default: 10 },
};

export const DOMAIN_SCENE_SCAFFOLDS = {
  dsa: [
    { id: 'cell_0', shape: 'rect', x: 140, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: '0', appearsAtStep: 0 },
    { id: 'cell_1', shape: 'rect', x: 210, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: '1', appearsAtStep: 0 },
    { id: 'cell_2', shape: 'rect', x: 280, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: '2', appearsAtStep: 0 },
  ],
};
