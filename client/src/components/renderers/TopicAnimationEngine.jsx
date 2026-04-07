/**
 * TutorBoard — Topic-specific Animation Engine
 *
 * DROP-IN FIX for the "same animation every time" bug.
 *
 * Usage:
 *   import { TopicAnimationEngine, detectTopic, generateSlides } from './TopicAnimationEngine';
 *
 *   // In your chat handler:
 *   const topic = detectTopic(userMessage);
 *   const slides = generateSlides(topic, userMessage);
 *
 *   // In your canvas:
 *   <TopicAnimationEngine topic={topic} slideIndex={currentSlide} />
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ─────────────────────────────────────────────
// 1. TOPIC DETECTION
// ─────────────────────────────────────────────
const TOPIC_PATTERNS = [
  // ── DSA ──
  { key: "binary-search",        patterns: ["binary search", "binary-search", "bsearch"] },
  { key: "linear-search",        patterns: ["linear search"] },
  { key: "bubble-sort",          patterns: ["bubble sort", "bubblesort"] },
  { key: "merge-sort",           patterns: ["merge sort", "mergesort"] },
  { key: "quick-sort",           patterns: ["quick sort", "quicksort"] },
  { key: "insertion-sort",       patterns: ["insertion sort"] },
  { key: "selection-sort",       patterns: ["selection sort"] },
  { key: "sorting",              patterns: ["sorting", "sort algorithm"] },
  { key: "bfs",                  patterns: ["bfs", "breadth first", "breadth-first"] },
  { key: "dfs",                  patterns: ["dfs", "depth first", "depth-first"] },
  { key: "dijkstra",             patterns: ["dijkstra", "shortest path"] },
  { key: "graph",                patterns: ["graph", "adjacency", "vertex", "edge"] },
  { key: "binary-tree",          patterns: ["binary tree", "bst", "binary search tree"] },
  { key: "avl-tree",             patterns: ["avl", "balanced tree"] },
  { key: "heap",                 patterns: ["heap", "priority queue", "heapify"] },
  { key: "tree",                 patterns: ["tree", "trie", "n-ary"] },
  { key: "stack",                patterns: ["stack", "lifo", "push pop"] },
  { key: "queue",                patterns: ["queue", "fifo", "dequeue", "enqueue"] },
  { key: "linked-list",          patterns: ["linked list", "linkedlist", "singly linked", "doubly linked"] },
  { key: "hash-table",           patterns: ["hash table", "hashmap", "hash map", "hashing", "collision"] },
  { key: "dynamic-programming",  patterns: ["dynamic programming", "dp ", "memoization", "tabulation", "knapsack", "fibonacci dp"] },
  { key: "recursion",            patterns: ["recursion", "recursive", "base case"] },
  { key: "two-pointers",         patterns: ["two pointer", "two-pointer", "sliding window"] },
  { key: "backtracking",         patterns: ["backtracking", "n-queen", "sudoku solver"] },
  { key: "big-o",                patterns: ["big o", "time complexity", "space complexity", "o(n)"] },
  // ── Mathematics ──
  { key: "quadratic-equation",   patterns: ["quadratic", "ax²", "ax^2", "parabola", "discriminant"] },
  { key: "linear-equation",      patterns: ["linear equation", "y=mx+b", "slope intercept", "straight line"] },
  { key: "trigonometry",          patterns: ["trigonometry", "sin cos", "sine", "cosine", "tangent", "unit circle"] },
  { key: "matrices",             patterns: ["matrix", "matrices", "determinant", "matrix multiplication"] },
  { key: "calculus-derivative",  patterns: ["derivative", "differentiation", "tangent line", "dy/dx", "calculus"] },
  { key: "calculus-integral",    patterns: ["integral", "integration", "area under", "antiderivative"] },
  { key: "probability",          patterns: ["probability", "dice", "coin flip", "random", "chance", "bayes"] },
  { key: "statistics",           patterns: ["statistics", "mean median", "standard deviation", "histogram", "variance"] },
  { key: "sets-venn",            patterns: ["venn diagram", "set theory", "union", "intersection", "subset"] },
  { key: "number-theory",        patterns: ["prime number", "gcd", "lcm", "factors", "modular arithmetic"] },
  // ── Physics ──
  { key: "newtons-laws",         patterns: ["newton", "force", "f=ma", "inertia", "action reaction"] },
  { key: "projectile-motion",    patterns: ["projectile", "trajectory", "ballistic", "launch angle"] },
  { key: "circuit",              patterns: ["circuit", "ohm", "resistor", "capacitor", "voltage", "current"] },
  { key: "waves",                patterns: ["wave", "frequency", "amplitude", "wavelength", "oscillation"] },
  { key: "optics",               patterns: ["optics", "refraction", "reflection", "lens", "mirror", "snell"] },
  { key: "thermodynamics",       patterns: ["thermodynamics", "entropy", "heat transfer", "thermal", "temperature"] },
  { key: "gravity",              patterns: ["gravity", "gravitational", "free fall", "g=9.8", "weight"] },
  // ── Chemistry ──
  { key: "atomic-structure",     patterns: ["atom", "atomic", "electron", "proton", "neutron", "bohr model", "orbital"] },
  { key: "periodic-table",       patterns: ["periodic table", "element", "atomic number", "chemical element"] },
  { key: "chemical-bonding",     patterns: ["chemical bond", "covalent", "ionic bond", "bonding", "electronegativity"] },
  { key: "reaction-balancing",   patterns: ["balance equation", "stoichiometry", "chemical reaction", "reactant", "product"] },
  { key: "ph-scale",             patterns: ["ph scale", "acid", "base", "alkaline", "litmus", "ph value"] },
  { key: "gas-laws",             patterns: ["gas law", "boyle", "charles", "ideal gas", "pv=nrt"] },
  // ── Biology ──
  { key: "cell-structure",       patterns: ["cell structure", "organelle", "mitochondria", "nucleus", "cell membrane"] },
  { key: "dna-replication",      patterns: ["dna", "replication", "double helix", "nucleotide", "base pair"] },
  { key: "photosynthesis",       patterns: ["photosynthesis", "chlorophyll", "light reaction", "calvin cycle"] },
  { key: "mitosis",              patterns: ["mitosis", "cell division", "prophase", "metaphase", "anaphase"] },
  { key: "ecosystem",            patterns: ["ecosystem", "food chain", "food web", "producer", "consumer", "decomposer"] },
  { key: "human-heart",          patterns: ["heart", "cardiac", "blood circulation", "atrium", "ventricle"] },
  // ── CS (non-DSA) ──
  { key: "oop",                  patterns: ["oop", "object oriented", "class", "inheritance", "polymorphism", "encapsulation"] },
  { key: "database",             patterns: ["database", "sql", "join", "normalization", "relational"] },
  { key: "networking",           patterns: ["networking", "tcp", "osi model", "ip address", "http", "dns"] },
  { key: "os-scheduling",        patterns: ["scheduling", "round robin", "process", "fcfs", "sjf", "operating system"] },
  { key: "binary-number",        patterns: ["binary number", "binary to decimal", "base 2", "bit", "byte"] },
];

export function detectTopic(userMessage) {
  const lower = (userMessage || "").toLowerCase();
  for (const { key, patterns } of TOPIC_PATTERNS) {
    if (patterns.some((p) => lower.includes(p))) return key;
  }
  return "generic";
}

// ─────────────────────────────────────────────
// 2. SLIDE TEMPLATE GENERATOR
// Each topic returns 4 slides: Intro, Concept, Walkthrough, Practice
// ─────────────────────────────────────────────
export function generateSlides(topic, userMessage) {
  const templates = {
    "binary-search": [
      { title: "Intro", subtitle: "Let's begin", animation: "binary-search-intro" },
      { title: "The Idea", subtitle: "Divide and conquer", animation: "binary-search-concept" },
      { title: "Step-by-Step", subtitle: "Watch it run", animation: "binary-search-walkthrough" },
      { title: "Complexity", subtitle: "O(log n) — why?", animation: "binary-search-complexity" },
    ],
    "bubble-sort": [
      { title: "Intro", subtitle: "Let's begin", animation: "bubble-sort-intro" },
      { title: "The Idea", subtitle: "Swap neighbors", animation: "bubble-sort-concept" },
      { title: "Step-by-Step", subtitle: "Watch it bubble", animation: "bubble-sort-walkthrough" },
      { title: "Complexity", subtitle: "O(n²) — why?", animation: "bubble-sort-complexity" },
    ],
    "merge-sort": [
      { title: "Intro", subtitle: "Let's begin", animation: "merge-sort-intro" },
      { title: "The Idea", subtitle: "Divide, sort, merge", animation: "merge-sort-concept" },
      { title: "Step-by-Step", subtitle: "Watch it merge", animation: "merge-sort-walkthrough" },
      { title: "Complexity", subtitle: "O(n log n)", animation: "merge-sort-complexity" },
    ],
    stack: [
      { title: "Intro", subtitle: "Let's begin", animation: "stack-intro" },
      { title: "The Idea", subtitle: "Last In, First Out", animation: "stack-concept" },
      { title: "Push & Pop", subtitle: "See it in action", animation: "stack-walkthrough" },
      { title: "Use Cases", subtitle: "Where stacks shine", animation: "stack-usecases" },
    ],
    "linked-list": [
      { title: "Intro", subtitle: "Let's begin", animation: "linked-list-intro" },
      { title: "The Idea", subtitle: "Nodes & pointers", animation: "linked-list-concept" },
      { title: "Traversal", subtitle: "Walk the chain", animation: "linked-list-walkthrough" },
      { title: "Insert & Delete", subtitle: "O(1) at head", animation: "linked-list-ops" },
    ],
    recursion: [
      { title: "Intro", subtitle: "Let's begin", animation: "recursion-intro" },
      { title: "The Idea", subtitle: "A function calls itself", animation: "recursion-concept" },
      { title: "Call Stack", subtitle: "Watch the stack grow", animation: "recursion-walkthrough" },
      { title: "Base Case", subtitle: "When to stop", animation: "recursion-basecase" },
    ],
    "dynamic-programming": [
      { title: "Intro", subtitle: "Let's begin", animation: "dp-intro" },
      { title: "The Idea", subtitle: "Overlapping subproblems", animation: "dp-concept" },
      { title: "Memoization", subtitle: "Cache the results", animation: "dp-walkthrough" },
      { title: "Tabulation", subtitle: "Bottom-up approach", animation: "dp-tabulation" },
    ],
    "hash-table": [
      { title: "Intro", subtitle: "Let's begin", animation: "hash-intro" },
      { title: "Hash Function", subtitle: "Key → index", animation: "hash-concept" },
      { title: "Collision", subtitle: "What if two map to same?", animation: "hash-collision" },
      { title: "Complexity", subtitle: "O(1) average", animation: "hash-complexity" },
    ],
    bfs: [
      { title: "Intro", subtitle: "Let's begin", animation: "bfs-intro" },
      { title: "The Idea", subtitle: "Level by level", animation: "bfs-concept" },
      { title: "Step-by-Step", subtitle: "Watch it spread", animation: "bfs-walkthrough" },
      { title: "Use Cases", subtitle: "Shortest path, etc.", animation: "bfs-usecases" },
    ],
    dfs: [
      { title: "Intro", subtitle: "Let's begin", animation: "dfs-intro" },
      { title: "The Idea", subtitle: "Go deep first", animation: "dfs-concept" },
      { title: "Step-by-Step", subtitle: "Watch it dive", animation: "dfs-walkthrough" },
      { title: "Backtracking", subtitle: "Come back up", animation: "dfs-backtrack" },
    ],
    // ── Mathematics ──
    "quadratic-equation": [
      { title: "Intro", subtitle: "ax² + bx + c = 0", animation: "quadratic-intro" },
      { title: "The Parabola", subtitle: "Graphing the curve", animation: "quadratic-concept" },
      { title: "Discriminant", subtitle: "Real vs complex roots", animation: "quadratic-walkthrough" },
      { title: "Quadratic Formula", subtitle: "Solve any quadratic", animation: "quadratic-formula" },
    ],
    "linear-equation": [
      { title: "Intro", subtitle: "y = mx + b", animation: "linear-eq-intro" },
      { title: "Slope", subtitle: "Rise over run", animation: "linear-eq-concept" },
      { title: "Graphing", subtitle: "Plot the line", animation: "linear-eq-walkthrough" },
      { title: "Intercepts", subtitle: "Where it crosses", animation: "linear-eq-intercepts" },
    ],
    trigonometry: [
      { title: "Intro", subtitle: "Triangles & angles", animation: "trig-intro" },
      { title: "Unit Circle", subtitle: "Sin, Cos, Tan", animation: "trig-concept" },
      { title: "Graphs", subtitle: "Wave patterns", animation: "trig-walkthrough" },
      { title: "Identities", subtitle: "Key relationships", animation: "trig-identities" },
    ],
    matrices: [
      { title: "Intro", subtitle: "Rows & columns", animation: "matrix-intro" },
      { title: "Operations", subtitle: "Add, multiply", animation: "matrix-concept" },
      { title: "Multiplication", subtitle: "Dot products", animation: "matrix-walkthrough" },
      { title: "Determinant", subtitle: "Scaling factor", animation: "matrix-determinant" },
    ],
    "calculus-derivative": [
      { title: "Intro", subtitle: "Rates of change", animation: "derivative-intro" },
      { title: "Tangent Line", subtitle: "Slope at a point", animation: "derivative-concept" },
      { title: "Rules", subtitle: "Power, chain, product", animation: "derivative-walkthrough" },
      { title: "Applications", subtitle: "Max, min, velocity", animation: "derivative-apps" },
    ],
    "calculus-integral": [
      { title: "Intro", subtitle: "Area under curves", animation: "integral-intro" },
      { title: "Riemann Sums", subtitle: "Rectangle method", animation: "integral-concept" },
      { title: "Fundamental Theorem", subtitle: "Integration rules", animation: "integral-walkthrough" },
      { title: "Applications", subtitle: "Volume, work", animation: "integral-apps" },
    ],
    probability: [
      { title: "Intro", subtitle: "Chance & events", animation: "probability-intro" },
      { title: "Basic Rules", subtitle: "Addition & multiplication", animation: "probability-concept" },
      { title: "Simulation", subtitle: "Dice & coins", animation: "probability-walkthrough" },
      { title: "Distributions", subtitle: "Patterns of randomness", animation: "probability-dist" },
    ],
    statistics: [
      { title: "Intro", subtitle: "Data analysis", animation: "statistics-intro" },
      { title: "Central Tendency", subtitle: "Mean, median, mode", animation: "statistics-concept" },
      { title: "Spread", subtitle: "Variance & std dev", animation: "statistics-walkthrough" },
      { title: "Visualization", subtitle: "Charts & histograms", animation: "statistics-viz" },
    ],
    "sets-venn": [
      { title: "Intro", subtitle: "Collections of objects", animation: "sets-intro" },
      { title: "Operations", subtitle: "Union & intersection", animation: "sets-concept" },
      { title: "Venn Diagrams", subtitle: "Visualize overlaps", animation: "sets-walkthrough" },
      { title: "Applications", subtitle: "Logic & counting", animation: "sets-apps" },
    ],
    "number-theory": [
      { title: "Intro", subtitle: "Properties of integers", animation: "numtheory-intro" },
      { title: "Primes", subtitle: "Building blocks", animation: "numtheory-concept" },
      { title: "GCD & LCM", subtitle: "Greatest & least", animation: "numtheory-walkthrough" },
      { title: "Applications", subtitle: "Cryptography", animation: "numtheory-apps" },
    ],
    // ── Physics ──
    "newtons-laws": [
      { title: "Intro", subtitle: "Foundation of mechanics", animation: "newton-intro" },
      { title: "First Law", subtitle: "Inertia", animation: "newton-concept" },
      { title: "Second Law", subtitle: "F = ma", animation: "newton-walkthrough" },
      { title: "Third Law", subtitle: "Action & reaction", animation: "newton-third" },
    ],
    "projectile-motion": [
      { title: "Intro", subtitle: "Objects in flight", animation: "projectile-intro" },
      { title: "Components", subtitle: "Horizontal & vertical", animation: "projectile-concept" },
      { title: "Trajectory", subtitle: "Watch it fly", animation: "projectile-walkthrough" },
      { title: "Equations", subtitle: "Range & height", animation: "projectile-equations" },
    ],
    circuit: [
      { title: "Intro", subtitle: "Electrical circuits", animation: "circuit-intro" },
      { title: "Ohm's Law", subtitle: "V = IR", animation: "circuit-concept" },
      { title: "Series & Parallel", subtitle: "Circuit configurations", animation: "circuit-walkthrough" },
      { title: "Power", subtitle: "Energy consumption", animation: "circuit-power" },
    ],
    waves: [
      { title: "Intro", subtitle: "Energy in motion", animation: "waves-intro" },
      { title: "Properties", subtitle: "Amplitude & frequency", animation: "waves-concept" },
      { title: "Types", subtitle: "Transverse & longitudinal", animation: "waves-walkthrough" },
      { title: "Interference", subtitle: "Wave interactions", animation: "waves-interference" },
    ],
    optics: [
      { title: "Intro", subtitle: "The behavior of light", animation: "optics-intro" },
      { title: "Reflection", subtitle: "Mirror physics", animation: "optics-concept" },
      { title: "Refraction", subtitle: "Bending light", animation: "optics-walkthrough" },
      { title: "Lenses", subtitle: "Focusing light", animation: "optics-lenses" },
    ],
    thermodynamics: [
      { title: "Intro", subtitle: "Heat & energy", animation: "thermo-intro" },
      { title: "Laws", subtitle: "Energy conservation", animation: "thermo-concept" },
      { title: "Heat Transfer", subtitle: "Conduction, convection", animation: "thermo-walkthrough" },
      { title: "Entropy", subtitle: "Disorder increases", animation: "thermo-entropy" },
    ],
    gravity: [
      { title: "Intro", subtitle: "Universal attraction", animation: "gravity-intro" },
      { title: "Free Fall", subtitle: "g = 9.8 m/s²", animation: "gravity-concept" },
      { title: "Orbits", subtitle: "Planetary motion", animation: "gravity-walkthrough" },
      { title: "Weight vs Mass", subtitle: "Key difference", animation: "gravity-weight" },
    ],
    // ── Chemistry ──
    "atomic-structure": [
      { title: "Intro", subtitle: "Building blocks", animation: "atom-intro" },
      { title: "Bohr Model", subtitle: "Electron shells", animation: "atom-concept" },
      { title: "Quantum Model", subtitle: "Orbitals", animation: "atom-walkthrough" },
      { title: "Configuration", subtitle: "Filling electrons", animation: "atom-config" },
    ],
    "periodic-table": [
      { title: "Intro", subtitle: "Organizing elements", animation: "periodic-intro" },
      { title: "Groups", subtitle: "Columns & families", animation: "periodic-concept" },
      { title: "Trends", subtitle: "Patterns across periods", animation: "periodic-walkthrough" },
      { title: "Properties", subtitle: "Metals vs nonmetals", animation: "periodic-properties" },
    ],
    "chemical-bonding": [
      { title: "Intro", subtitle: "Atoms joining", animation: "bonding-intro" },
      { title: "Ionic Bonds", subtitle: "Transfer electrons", animation: "bonding-concept" },
      { title: "Covalent Bonds", subtitle: "Share electrons", animation: "bonding-walkthrough" },
      { title: "Structures", subtitle: "Lewis dot diagrams", animation: "bonding-structures" },
    ],
    "reaction-balancing": [
      { title: "Intro", subtitle: "Chemical equations", animation: "reaction-intro" },
      { title: "Conservation", subtitle: "Atoms must balance", animation: "reaction-concept" },
      { title: "Step-by-Step", subtitle: "Balance it", animation: "reaction-walkthrough" },
      { title: "Types", subtitle: "Synthesis, decomposition", animation: "reaction-types" },
    ],
    "ph-scale": [
      { title: "Intro", subtitle: "Acids & bases", animation: "ph-intro" },
      { title: "The Scale", subtitle: "0 to 14", animation: "ph-concept" },
      { title: "Indicators", subtitle: "Color changes", animation: "ph-walkthrough" },
      { title: "Neutralization", subtitle: "Acid + Base", animation: "ph-neutral" },
    ],
    "gas-laws": [
      { title: "Intro", subtitle: "Behavior of gases", animation: "gas-intro" },
      { title: "Boyle's Law", subtitle: "Pressure & volume", animation: "gas-concept" },
      { title: "Charles's Law", subtitle: "Temperature & volume", animation: "gas-walkthrough" },
      { title: "Ideal Gas", subtitle: "PV = nRT", animation: "gas-ideal" },
    ],
    // ── Biology ──
    "cell-structure": [
      { title: "Intro", subtitle: "The basic unit of life", animation: "cell-intro" },
      { title: "Organelles", subtitle: "Parts of a cell", animation: "cell-concept" },
      { title: "Functions", subtitle: "Each part's role", animation: "cell-walkthrough" },
      { title: "Plant vs Animal", subtitle: "Key differences", animation: "cell-compare" },
    ],
    "dna-replication": [
      { title: "Intro", subtitle: "The blueprint of life", animation: "dna-intro" },
      { title: "Structure", subtitle: "Double helix", animation: "dna-concept" },
      { title: "Replication", subtitle: "Copying DNA", animation: "dna-walkthrough" },
      { title: "Mutations", subtitle: "When copies go wrong", animation: "dna-mutations" },
    ],
    photosynthesis: [
      { title: "Intro", subtitle: "Energy from sunlight", animation: "photo-intro" },
      { title: "Light Reactions", subtitle: "Capturing photons", animation: "photo-concept" },
      { title: "Calvin Cycle", subtitle: "Making glucose", animation: "photo-walkthrough" },
      { title: "Overall Equation", subtitle: "6CO₂ + 6H₂O → C₆H₁₂O₆", animation: "photo-equation" },
    ],
    mitosis: [
      { title: "Intro", subtitle: "Cell division", animation: "mitosis-intro" },
      { title: "Phases", subtitle: "PMAT", animation: "mitosis-concept" },
      { title: "Step-by-Step", subtitle: "Watch it divide", animation: "mitosis-walkthrough" },
      { title: "Cytokinesis", subtitle: "Two new cells", animation: "mitosis-cytokinesis" },
    ],
    ecosystem: [
      { title: "Intro", subtitle: "Living systems", animation: "eco-intro" },
      { title: "Food Chains", subtitle: "Energy flow", animation: "eco-concept" },
      { title: "Food Webs", subtitle: "Complex connections", animation: "eco-walkthrough" },
      { title: "Balance", subtitle: "Ecosystem stability", animation: "eco-balance" },
    ],
    "human-heart": [
      { title: "Intro", subtitle: "The body's pump", animation: "heart-intro" },
      { title: "Chambers", subtitle: "4 chambers", animation: "heart-concept" },
      { title: "Blood Flow", subtitle: "The circuit", animation: "heart-walkthrough" },
      { title: "Cardiac Cycle", subtitle: "Systole & diastole", animation: "heart-cycle" },
    ],
    // ── CS (non-DSA) ──
    oop: [
      { title: "Intro", subtitle: "Object-oriented thinking", animation: "oop-intro" },
      { title: "Classes", subtitle: "Blueprints for objects", animation: "oop-concept" },
      { title: "Inheritance", subtitle: "Parent → child", animation: "oop-walkthrough" },
      { title: "Polymorphism", subtitle: "Many forms", animation: "oop-poly" },
    ],
    database: [
      { title: "Intro", subtitle: "Storing data", animation: "db-intro" },
      { title: "Tables", subtitle: "Rows & columns", animation: "db-concept" },
      { title: "Joins", subtitle: "Combining tables", animation: "db-walkthrough" },
      { title: "Normalization", subtitle: "Reducing redundancy", animation: "db-normal" },
    ],
    networking: [
      { title: "Intro", subtitle: "Connected systems", animation: "net-intro" },
      { title: "OSI Model", subtitle: "7 layers", animation: "net-concept" },
      { title: "TCP/IP", subtitle: "How data travels", animation: "net-walkthrough" },
      { title: "DNS", subtitle: "Name resolution", animation: "net-dns" },
    ],
    "os-scheduling": [
      { title: "Intro", subtitle: "Managing processes", animation: "sched-intro" },
      { title: "FCFS", subtitle: "First come, first served", animation: "sched-concept" },
      { title: "Round Robin", subtitle: "Time slicing", animation: "sched-walkthrough" },
      { title: "Priority", subtitle: "Weighted scheduling", animation: "sched-priority" },
    ],
    "binary-number": [
      { title: "Intro", subtitle: "Base 2 system", animation: "binnum-intro" },
      { title: "Counting", subtitle: "0s and 1s", animation: "binnum-concept" },
      { title: "Conversion", subtitle: "Binary ↔ decimal", animation: "binnum-walkthrough" },
      { title: "Operations", subtitle: "Add, shift, AND/OR", animation: "binnum-ops" },
    ],
    generic: [
      { title: "Intro", subtitle: "Let's begin", animation: "generic-intro" },
      { title: "Concept", subtitle: "Core idea", animation: "generic-concept" },
      { title: "Example", subtitle: "See it in action", animation: "generic-example" },
      { title: "Summary", subtitle: "Key takeaways", animation: "generic-summary" },
    ],
  };

  return (templates[topic] || templates["generic"]).map((s, i) => ({
    ...s,
    index: i,
    topic,
  }));
}

// ─────────────────────────────────────────────
// 3. INDIVIDUAL ANIMATION COMPONENTS
// ─────────────────────────────────────────────

// Binary Search Animation — splits array, highlights mid pointer
function BinarySearchAnimation({ phase }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef({ step: 0, arr: [2, 5, 8, 12, 16, 23, 38, 44, 56, 72], target: 23, lo: 0, hi: 9, mid: 4, found: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const s = stateRef.current;
    const arr = s.arr;
    const boxW = Math.floor((W - 80) / arr.length);
    const boxH = 52;
    const startX = 40;
    const startY = H / 2 - boxH / 2;

    let frame = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Title
      ctx.fillStyle = "#a0a0b0";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`Target: ${s.target}`, W / 2, 28);

      // Draw boxes
      arr.forEach((val, i) => {
        const x = startX + i * boxW;
        const isLo = i === s.lo;
        const isHi = i === s.hi;
        const isMid = i === s.mid;
        const inRange = i >= s.lo && i <= s.hi;
        const isFound = s.found && i === s.mid;

        // Box fill
        ctx.fillStyle = isFound
          ? "#22c55e22"
          : isMid
          ? "#f59e0b22"
          : inRange
          ? "#3b82f620"
          : "#ffffff08";
        ctx.strokeStyle = isFound
          ? "#22c55e"
          : isMid
          ? "#f59e0b"
          : inRange
          ? "#3b82f6"
          : "#333355";
        ctx.lineWidth = isMid || isFound ? 2 : 1;

        roundRect(ctx, x + 2, startY, boxW - 4, boxH, 8);

        // Value
        ctx.fillStyle = isFound ? "#22c55e" : isMid ? "#f59e0b" : inRange ? "#e0e8ff" : "#555577";
        ctx.font = `${isMid ? "700" : "500"} 18px system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(val, x + boxW / 2, startY + boxH / 2 + 6);

        // Pointer labels
        ctx.font = "11px system-ui";
        if (isLo) {
          ctx.fillStyle = "#60a5fa";
          ctx.fillText("lo", x + boxW / 2, startY - 10);
        }
        if (isHi) {
          ctx.fillStyle = "#60a5fa";
          ctx.fillText("hi", x + boxW / 2, startY - (isLo ? 25 : 10));
        }
        if (isMid) {
          ctx.fillStyle = "#f59e0b";
          ctx.fillText("mid", x + boxW / 2, startY + boxH + 20);
        }

        // Index
        ctx.fillStyle = "#44445a";
        ctx.font = "10px system-ui";
        ctx.fillText(i, x + boxW / 2, startY + boxH + 36);
      });

      // Status
      ctx.fillStyle = "#a0a0b0";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      let status = s.found
        ? `✓ Found ${s.target} at index ${s.mid}`
        : `arr[${s.mid}] = ${arr[s.mid]} → ${arr[s.mid] < s.target ? "go right ▶" : arr[s.mid] > s.target ? "◀ go left" : ""}`;
      ctx.fillText(status, W / 2, H - 20);

      frame++;
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [phase]);

  // Step through binary search
  const step = useCallback(() => {
    const s = stateRef.current;
    if (s.found || s.lo > s.hi) return;
    const mid = Math.floor((s.lo + s.hi) / 2);
    s.mid = mid;
    if (s.arr[mid] === s.target) {
      s.found = true;
    } else if (s.arr[mid] < s.target) {
      s.lo = mid + 1;
    } else {
      s.hi = mid - 1;
    }
    // Re-render by updating canvas directly
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // trigger redraw via effect by toggling a dummy state
    canvasRef.current.dispatchEvent(new Event("tutorredraw"));
  }, []);

  const reset = () => {
    stateRef.current = { step: 0, arr: [2, 5, 8, 12, 16, 23, 38, 44, 56, 72], target: 23, lo: 0, hi: 9, mid: 4, found: false };
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasRef.current.dispatchEvent(new Event("tutorredraw"));
  };

  // Listen for redraw events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = () => {
      const s = stateRef.current;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const arr = s.arr;
      const boxW = Math.floor((W - 80) / arr.length);
      const boxH = 52;
      const startX = 40;
      const startY = H / 2 - boxH / 2;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#a0a0b0";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`Target: ${s.target}`, W / 2, 28);

      arr.forEach((val, i) => {
        const x = startX + i * boxW;
        const isLo = i === s.lo;
        const isHi = i === s.hi;
        const isMid = i === s.mid;
        const inRange = i >= s.lo && i <= s.hi;
        const isFound = s.found && i === s.mid;

        ctx.fillStyle = isFound ? "#22c55e22" : isMid ? "#f59e0b22" : inRange ? "#3b82f620" : "#ffffff08";
        ctx.strokeStyle = isFound ? "#22c55e" : isMid ? "#f59e0b" : inRange ? "#3b82f6" : "#333355";
        ctx.lineWidth = isMid || isFound ? 2 : 1;
        roundRect(ctx, x + 2, startY, boxW - 4, boxH, 8);

        ctx.fillStyle = isFound ? "#22c55e" : isMid ? "#f59e0b" : inRange ? "#e0e8ff" : "#555577";
        ctx.font = `${isMid ? "700" : "500"} 18px system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(val, x + boxW / 2, startY + boxH / 2 + 6);

        ctx.font = "11px system-ui";
        if (isLo) { ctx.fillStyle = "#60a5fa"; ctx.fillText("lo", x + boxW / 2, startY - 10); }
        if (isHi) { ctx.fillStyle = "#60a5fa"; ctx.fillText("hi", x + boxW / 2, startY - (isLo ? 25 : 10)); }
        if (isMid) { ctx.fillStyle = "#f59e0b"; ctx.fillText("mid", x + boxW / 2, startY + boxH + 20); }

        ctx.fillStyle = "#44445a";
        ctx.font = "10px system-ui";
        ctx.fillText(i, x + boxW / 2, startY + boxH + 36);
      });

      ctx.fillStyle = "#a0a0b0";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      const status = s.found
        ? `✓ Found ${s.target} at index ${s.mid}`
        : `arr[${s.mid}] = ${arr[s.mid]} → ${arr[s.mid] < s.target ? "go right ▶" : "◀ go left"}`;
      ctx.fillText(status, W / 2, H - 20);
    };
    canvas.addEventListener("tutorredraw", handler);
    return () => canvas.removeEventListener("tutorredraw", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <canvas
        ref={canvasRef}
        width={680}
        height={220}
        style={{ width: "100%", borderRadius: 12, background: "rgba(10,10,30,0.85)" }}
      />
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={step} style={btnStyle("#3b82f6")}>Next Step →</button>
        <button onClick={reset} style={btnStyle("#555")}>Reset</button>
      </div>
    </div>
  );
}

// Bubble Sort Animation
function BubbleSortAnimation({ phase }) {
  const [arr, setArr] = useState([64, 34, 25, 12, 22, 11, 90]);
  const [comparing, setComparing] = useState([-1, -1]);
  const [sorted, setSorted] = useState([]);
  const [running, setRunning] = useState(false);
  const runRef = useRef(false);

  const run = async () => {
    if (runRef.current) return;
    runRef.current = true;
    setRunning(true);
    const a = [...arr];
    const sortedSet = new Set();

    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < a.length - i - 1; j++) {
        if (!runRef.current) return;
        setComparing([j, j + 1]);
        await sleep(400);
        if (a[j] > a[j + 1]) {
          [a[j], a[j + 1]] = [a[j + 1], a[j]];
          setArr([...a]);
        }
      }
      sortedSet.add(a.length - 1 - i);
      setSorted([...sortedSet]);
    }

    setComparing([-1, -1]);
    setRunning(false);
    runRef.current = false;
  };

  const reset = () => {
    runRef.current = false;
    setRunning(false);
    setArr([64, 34, 25, 12, 22, 11, 90]);
    setComparing([-1, -1]);
    setSorted([]);
  };

  const maxVal = Math.max(...arr);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: "100%",
          height: 200,
          background: "rgba(10,10,30,0.85)",
          borderRadius: 12,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 6,
          padding: "16px 24px",
        }}
      >
        {arr.map((val, i) => {
          const isComparing = comparing.includes(i);
          const isSorted = sorted.includes(i);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: isComparing ? "#f59e0b" : isSorted ? "#22c55e" : "#6666aa" }}>{val}</span>
              <div
                style={{
                  width: 42,
                  height: `${(val / maxVal) * 130}px`,
                  background: isSorted ? "#22c55e" : isComparing ? "#f59e0b" : "#3b82f6",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.3s, background 0.2s",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={run} disabled={running} style={btnStyle("#3b82f6")}>{running ? "Sorting..." : "▶ Run Sort"}</button>
        <button onClick={reset} style={btnStyle("#555")}>Reset</button>
      </div>
    </div>
  );
}

// Stack Animation
function StackAnimation({ phase }) {
  const [stack, setStack] = useState([10, 20, 30]);
  const [input, setInput] = useState("");
  const [log, setLog] = useState("Stack initialized");

  const push = () => {
    const val = parseInt(input) || Math.floor(Math.random() * 90 + 10);
    setStack((s) => [...s, val]);
    setLog(`Pushed ${val} onto stack`);
    setInput("");
  };

  const pop = () => {
    if (stack.length === 0) { setLog("Stack is empty!"); return; }
    const top = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setLog(`Popped ${top} from stack`);
  };

  const peek = () => {
    if (stack.length === 0) { setLog("Stack is empty!"); return; }
    setLog(`Peek: ${stack[stack.length - 1]} (top of stack)`);
  };

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div
        style={{
          minWidth: 140,
          background: "rgba(10,10,30,0.85)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column-reverse",
          gap: 6,
          minHeight: 200,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 10, color: "#444466" }}>BOTTOM</div>
        <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", fontSize: 10, color: "#60a5fa" }}>TOP ↑</div>
        <div style={{ height: 20 }} />
        {stack.map((val, i) => (
          <div
            key={i}
            style={{
              background: i === stack.length - 1 ? "#3b82f6" : "#1e2a4a",
              border: `1px solid ${i === stack.length - 1 ? "#60a5fa" : "#2a3560"}`,
              borderRadius: 6,
              padding: "8px 12px",
              textAlign: "center",
              color: i === stack.length - 1 ? "#fff" : "#8888cc",
              fontWeight: i === stack.length - 1 ? 700 : 400,
              fontSize: 16,
              transition: "all 0.2s",
            }}
          >
            {val}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#22c55e", background: "#0a1a0a", borderRadius: 8, padding: "8px 12px" }}>
          {log}
        </div>
        <div style={{ fontSize: 12, color: "#666688" }}>Size: {stack.length}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={push} style={btnStyle("#3b82f6")}>Push</button>
          <button onClick={pop} style={btnStyle("#ef4444")}>Pop</button>
          <button onClick={peek} style={btnStyle("#f59e0b")}>Peek</button>
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Value to push..."
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #2a3560", background: "#0d0d1a", color: "#fff", fontSize: 13 }}
        />
      </div>
    </div>
  );
}

// Linked List Animation
function LinkedListAnimation({ phase }) {
  const [nodes, setNodes] = useState([
    { val: 10, id: 0 },
    { val: 20, id: 1 },
    { val: 30, id: 2 },
    { val: 40, id: 3 },
  ]);
  const [highlighted, setHighlighted] = useState(null);
  const [log, setLog] = useState("Traversing: click a node");

  const addHead = () => {
    const val = Math.floor(Math.random() * 90 + 10);
    setNodes((n) => [{ val, id: Date.now() }, ...n]);
    setLog(`Inserted ${val} at head — O(1)`);
  };

  const removeTail = () => {
    if (nodes.length === 0) return;
    const removed = nodes[nodes.length - 1].val;
    setNodes((n) => n.slice(0, -1));
    setLog(`Removed tail ${removed}`);
  };

  const traverse = async () => {
    for (let i = 0; i < nodes.length; i++) {
      setHighlighted(i);
      setLog(`Visiting node ${i}: value = ${nodes[i].val}`);
      await sleep(500);
    }
    setHighlighted(null);
    setLog("Traversal complete");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "rgba(10,10,30,0.85)",
          borderRadius: 12,
          padding: "24px 16px",
          display: "flex",
          alignItems: "center",
          overflowX: "auto",
          gap: 0,
          minHeight: 120,
        }}
      >
        {nodes.map((node, i) => (
          <div key={node.id} style={{ display: "flex", alignItems: "center" }}>
            <div
              onClick={() => { setHighlighted(i); setLog(`Node ${i}: val=${node.val}, next→${i < nodes.length - 1 ? nodes[i + 1].val : "null"}`); }}
              style={{
                background: highlighted === i ? "#3b82f6" : "#1e2a4a",
                border: `2px solid ${highlighted === i ? "#60a5fa" : "#2a3560"}`,
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minWidth: 56,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: highlighted === i ? "#fff" : "#8888cc" }}>{node.val}</span>
              <span style={{ fontSize: 9, color: "#444466" }}>next→</span>
            </div>
            {i < nodes.length - 1 && (
              <div style={{ color: "#3b82f6", fontSize: 18, padding: "0 4px", userSelect: "none" }}>→</div>
            )}
            {i === nodes.length - 1 && (
              <div style={{ color: "#444466", fontSize: 12, padding: "0 8px" }}>null</div>
            )}
          </div>
        ))}
        {nodes.length === 0 && <div style={{ color: "#444466", margin: "auto" }}>Empty list</div>}
      </div>
      <div style={{ fontSize: 13, color: "#22c55e", background: "#0a1a0a", borderRadius: 8, padding: "8px 12px" }}>{log}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={addHead} style={btnStyle("#3b82f6")}>Insert Head</button>
        <button onClick={removeTail} style={btnStyle("#ef4444")}>Remove Tail</button>
        <button onClick={traverse} style={btnStyle("#f59e0b")}>Traverse</button>
      </div>
    </div>
  );
}

// Recursion (Fibonacci) Animation
function RecursionAnimation({ phase }) {
  const [n, setN] = useState(5);
  const [calls, setCalls] = useState([]);
  const [result, setResult] = useState(null);

  const visualize = async () => {
    const log = [];
    const fib = async (k, depth = 0) => {
      log.push({ k, depth, state: "calling" });
      setCalls([...log]);
      await sleep(150);
      if (k <= 1) {
        log.push({ k, depth, state: "returning", val: k });
        setCalls([...log]);
        return k;
      }
      const a = await fib(k - 1, depth + 1);
      const b = await fib(k - 2, depth + 1);
      const val = a + b;
      log.push({ k, depth, state: "returning", val });
      setCalls([...log]);
      await sleep(100);
      return val;
    };
    const r = await fib(n);
    setResult(r);
  };

  const reset = () => { setCalls([]); setResult(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#a0a0b0" }}>fib(</span>
        <input type="number" min={1} max={8} value={n} onChange={(e) => setN(parseInt(e.target.value) || 5)}
          style={{ width: 50, padding: "4px 8px", borderRadius: 6, border: "1px solid #2a3560", background: "#0d0d1a", color: "#fff", fontSize: 14, textAlign: "center" }} />
        <span style={{ fontSize: 13, color: "#a0a0b0" }}>)</span>
        <button onClick={visualize} style={btnStyle("#3b82f6")}>Visualize</button>
        <button onClick={reset} style={btnStyle("#555")}>Reset</button>
        {result !== null && <span style={{ color: "#22c55e", fontSize: 14 }}>= {result}</span>}
      </div>
      <div style={{
        background: "rgba(10,10,30,0.85)", borderRadius: 12, padding: "12px 16px",
        maxHeight: 220, overflowY: "auto", fontFamily: "monospace", fontSize: 12, display: "flex", flexDirection: "column", gap: 2,
      }}>
        {calls.slice(-30).map((c, i) => (
          <div key={i} style={{
            paddingLeft: c.depth * 14,
            color: c.state === "returning" ? "#22c55e" : "#60a5fa",
          }}>
            {"  ".repeat(c.depth)}
            {c.state === "calling" ? `→ fib(${c.k})` : `← fib(${c.k}) = ${c.val}`}
          </div>
        ))}
        {calls.length === 0 && <span style={{ color: "#444466" }}>Call stack will appear here...</span>}
      </div>
    </div>
  );
}

// Hash Table Animation
function HashTableAnimation({ phase }) {
  const SIZE = 7;
  const [table, setTable] = useState(Array(SIZE).fill(null).map(() => []));
  const [input, setInput] = useState("");
  const [highlighted, setHighlighted] = useState(null);
  const [log, setLog] = useState("Hash table ready. Insert a key.");

  const hash = (key) => {
    let h = 0;
    for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) % SIZE;
    return h;
  };

  const insert = () => {
    const key = input.trim() || `key${Math.floor(Math.random() * 99)}`;
    const idx = hash(key);
    setHighlighted(idx);
    setTable((t) => { const n = t.map((b) => [...b]); n[idx] = [...n[idx], key]; return n; });
    setLog(`hash("${key}") = ${idx} → inserted at bucket ${idx}`);
    setInput("");
    setTimeout(() => setHighlighted(null), 1000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='Enter a key...'
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #2a3560", background: "#0d0d1a", color: "#fff", fontSize: 13, flex: 1 }} />
        <button onClick={insert} style={btnStyle("#3b82f6")}>Insert</button>
      </div>
      <div style={{ background: "rgba(10,10,30,0.85)", borderRadius: 12, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {table.map((bucket, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 28, fontSize: 11, color: "#444466", textAlign: "right" }}>[{i}]</div>
            <div style={{
              flex: 1, minHeight: 32, background: highlighted === i ? "#1e3a6a" : "#0d0d1a",
              border: `1px solid ${highlighted === i ? "#3b82f6" : "#1a1a2e"}`,
              borderRadius: 6, padding: "4px 10px", display: "flex", gap: 8, alignItems: "center",
              transition: "all 0.2s",
            }}>
              {bucket.map((k, j) => (
                <span key={j} style={{ fontSize: 12, color: "#60a5fa", background: "#1e2a4a", borderRadius: 4, padding: "2px 8px" }}>{k}</span>
              ))}
              {bucket.length === 0 && <span style={{ color: "#33334a", fontSize: 11 }}>empty</span>}
              {bucket.length > 1 && <span style={{ fontSize: 10, color: "#f59e0b", marginLeft: "auto" }}>collision!</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "#22c55e", background: "#0a1a0a", borderRadius: 8, padding: "8px 12px" }}>{log}</div>
    </div>
  );
}

// BFS Animation
function BFSAnimation({ phase }) {
  const nodes = { 0: [1, 2], 1: [0, 3, 4], 2: [0, 5], 3: [1], 4: [1, 6], 5: [2], 6: [4] };
  const positions = {
    0: [320, 40], 1: [160, 130], 2: [480, 130], 3: [80, 220], 4: [240, 220], 5: [400, 220], 6: [240, 310],
  };
  const [visited, setVisited] = useState([]);
  const [queue, setQueue] = useState([]);
  const [running, setRunning] = useState(false);
  const runRef = useRef(false);

  const runBFS = async () => {
    if (runRef.current) return;
    runRef.current = true;
    setRunning(true);
    const vis = new Set();
    const q = [0];
    setQueue([...q]);
    setVisited([...vis]);
    while (q.length > 0 && runRef.current) {
      const node = q.shift();
      if (vis.has(node)) continue;
      vis.add(node);
      setVisited([...vis]);
      setQueue([...q]);
      await sleep(600);
      for (const nb of nodes[node]) {
        if (!vis.has(nb)) { q.push(nb); setQueue([...q]); }
      }
    }
    setRunning(false);
    runRef.current = false;
  };

  const reset = () => {
    runRef.current = false;
    setRunning(false);
    setVisited([]);
    setQueue([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <svg width="100%" viewBox="0 0 640 360" style={{ background: "rgba(10,10,30,0.85)", borderRadius: 12 }}>
        {Object.entries(nodes).map(([from, tos]) =>
          tos.map((to) =>
            parseInt(from) < to ? (
              <line key={`${from}-${to}`}
                x1={positions[from][0]} y1={positions[from][1]}
                x2={positions[to][0]} y2={positions[to][1]}
                stroke={visited.includes(parseInt(from)) && visited.includes(to) ? "#3b82f6" : "#2a3560"}
                strokeWidth={2}
              />
            ) : null
          )
        )}
        {Object.entries(positions).map(([id, [x, y]]) => {
          const n = parseInt(id);
          const isVisited = visited.includes(n);
          const inQueue = queue.includes(n);
          return (
            <g key={id}>
              <circle cx={x} cy={y} r={22}
                fill={isVisited ? "#3b82f6" : inQueue ? "#f59e0b33" : "#1e2a4a"}
                stroke={isVisited ? "#60a5fa" : inQueue ? "#f59e0b" : "#2a3560"}
                strokeWidth={2}
              />
              <text x={x} y={y + 5} textAnchor="middle" fill={isVisited ? "#fff" : "#8888cc"} fontSize={14} fontWeight={600}>{id}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 13, color: "#a0a0b0" }}>
        Queue: [{queue.join(", ")}] &nbsp;|&nbsp; Visited: [{visited.join(", ")}]
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={runBFS} disabled={running} style={btnStyle("#3b82f6")}>{running ? "Running..." : "▶ Run BFS"}</button>
        <button onClick={reset} style={btnStyle("#555")}>Reset</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SUBJECT-SPECIFIC ANIMATION COMPONENTS
// ─────────────────────────────────────────────

// Reusable canvas-based animation for math/science/CS topics
function SubjectCanvasAnimation({ phase, config }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    frameRef.current = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      frameRef.current++;
      config.draw(ctx, W, H, frameRef.current, phase);
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, config]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <canvas ref={canvasRef} width={680} height={240}
        style={{ width: "100%", borderRadius: 12, background: "rgba(10,10,30,0.85)" }} />
      {config.label && (
        <div style={{ fontSize: 12, color: "#60a5fa", textAlign: "center" }}>{config.label}</div>
      )}
    </div>
  );
}

// ── Math: Quadratic Equation ──
function QuadraticAnimation({ phase }) {
  const config = useRef({
    label: "y = ax² + bx + c — drag a,b,c mentally, watch the parabola",
    draw(ctx, W, H, frame) {
      const a = 0.008, b = -2.5, c = 180;
      ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let px = 0; px < W; px++) {
        const x = px - W / 2;
        const y = H / 2 - (a * x * x + b * x + c - 180);
        if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
      // Roots
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const r1 = (-b + Math.sqrt(disc)) / (2 * a) + W / 2;
        const r2 = (-b - Math.sqrt(disc)) / (2 * a) + W / 2;
        [r1, r2].forEach(rx => {
          ctx.beginPath(); ctx.arc(rx, H / 2, 5 + Math.sin(frame * 0.05) * 2, 0, Math.PI * 2);
          ctx.fillStyle = "#22c55e"; ctx.fill();
        });
      }
      // Axis
      ctx.strokeStyle = "#333355"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.fillStyle = "#666688"; ctx.font = "11px system-ui";
      ctx.fillText("x", W - 15, H / 2 - 8); ctx.fillText("y", W / 2 + 8, 15);
    }
  }).current;
  return <SubjectCanvasAnimation phase={phase} config={config} />;
}

// ── Math: Trigonometry / Unit Circle ──
function TrigAnimation({ phase }) {
  const config = useRef({
    label: "Unit circle — sin (red) and cos (blue) traced in real time",
    draw(ctx, W, H, frame) {
      const cx = 160, cy = H / 2, r = 80;
      const angle = (frame * 0.02) % (Math.PI * 2);
      // Circle
      ctx.strokeStyle = "#333366"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      // Radius line
      const px = cx + r * Math.cos(angle), py = cy - r * Math.sin(angle);
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      // Point
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b"; ctx.fill();
      // Sin projection
      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
      ctx.setLineDash([]);
      // Cos projection
      ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke();
      ctx.setLineDash([]);
      // Wave (sin)
      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 360; i++) {
        const wx = 280 + i;
        const wy = cy - r * Math.sin(angle - i * 0.017);
        if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      // Labels
      ctx.fillStyle = "#ef4444"; ctx.font = "12px system-ui";
      ctx.fillText(`sin = ${Math.sin(angle).toFixed(2)}`, 280, 30);
      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`cos = ${Math.cos(angle).toFixed(2)}`, 400, 30);
    }
  }).current;
  return <SubjectCanvasAnimation phase={phase} config={config} />;
}

// ── Math: Probability (Dice Simulation) ──
function ProbabilityAnimation({ phase }) {
  const [rolls, setRolls] = useState([]);
  const [freq, setFreq] = useState([0, 0, 0, 0, 0, 0]);

  const roll = () => {
    const val = Math.floor(Math.random() * 6);
    setRolls(r => [...r.slice(-49), val + 1]);
    setFreq(f => { const n = [...f]; n[val]++; return n; });
  };
  const reset = () => { setRolls([]); setFreq([0, 0, 0, 0, 0, 0]); };
  const total = freq.reduce((a, b) => a + b, 0) || 1;
  const maxF = Math.max(...freq, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "rgba(10,10,30,0.85)", borderRadius: 12, padding: "16px 24px", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, height: 200 }}>
        {freq.map((f, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "#60a5fa" }}>{((f / total) * 100).toFixed(1)}%</span>
            <div style={{ width: 48, height: `${(f / maxF) * 130}px`, background: "#3b82f6", borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e0e8ff" }}>⚂ {i + 1}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#666688", textAlign: "center" }}>Total rolls: {total === 1 && freq[0] === 0 ? 0 : total}</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={roll} style={btnStyle("#3b82f6")}>🎲 Roll Dice</button>
        <button onClick={() => { for (let i = 0; i < 50; i++) setTimeout(roll, i * 30); }} style={btnStyle("#8b5cf6")}>Roll ×50</button>
        <button onClick={reset} style={btnStyle("#555")}>Reset</button>
      </div>
    </div>
  );
}

// ── Math: Statistics ──
function StatisticsAnimation({ phase }) {
  const [data, setData] = useState([12, 15, 18, 22, 25, 28, 30, 35, 40, 45]);
  const sorted = [...data].sort((a, b) => a - b);
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const median = data.length % 2 === 0 ? (sorted[data.length / 2 - 1] + sorted[data.length / 2]) / 2 : sorted[Math.floor(data.length / 2)];
  const maxVal = Math.max(...data);

  const addRandom = () => setData(d => [...d, Math.floor(Math.random() * 50) + 1]);
  const reset = () => setData([12, 15, 18, 22, 25, 28, 30, 35, 40, 45]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "rgba(10,10,30,0.85)", borderRadius: 12, padding: "16px 24px", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, height: 180 }}>
        {data.map((v, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 9, color: "#666" }}>{v}</span>
            <div style={{ width: Math.max(20, 400 / data.length), height: `${(v / maxVal) * 120}px`, background: v <= mean ? "#3b82f6" : "#f59e0b", borderRadius: "3px 3px 0 0", transition: "all 0.3s" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 13 }}>
        <span style={{ color: "#3b82f6" }}>Mean: {mean.toFixed(1)}</span>
        <span style={{ color: "#22c55e" }}>Median: {median}</span>
        <span style={{ color: "#f59e0b" }}>Count: {data.length}</span>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={addRandom} style={btnStyle("#3b82f6")}>+ Add Data</button>
        <button onClick={reset} style={btnStyle("#555")}>Reset</button>
      </div>
    </div>
  );
}

// ── Physics: Projectile Motion ──
function ProjectileAnimation({ phase }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [angle, setAngle] = useState(45);
  const [firing, setFiring] = useState(false);
  const tRef = useRef(0);
  const trailRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const g = 9.8, v0 = 60, rad = angle * Math.PI / 180;
    const ground = H - 30;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // Ground
      ctx.strokeStyle = "#333355"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke();
      // Trail
      ctx.fillStyle = "#3b82f644";
      trailRef.current.forEach(([tx, ty]) => { ctx.beginPath(); ctx.arc(tx, ty, 2, 0, Math.PI * 2); ctx.fill(); });

      if (firing) {
        tRef.current += 0.15;
        const t = tRef.current;
        const x = 40 + v0 * Math.cos(rad) * t;
        const y = ground - (v0 * Math.sin(rad) * t - 0.5 * g * t * t);
        if (y >= ground) { setFiring(false); tRef.current = 0; }
        else {
          trailRef.current.push([x, y]);
          ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = "#f59e0b"; ctx.fill();
          // Velocity vectors
          const vx = v0 * Math.cos(rad), vy = v0 * Math.sin(rad) - g * t;
          ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vx * 0.5, y); ctx.stroke();
          ctx.strokeStyle = "#ef4444";
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - vy * 0.5); ctx.stroke();
        }
      }
      ctx.fillStyle = "#666688"; ctx.font = "11px system-ui";
      ctx.fillText(`Angle: ${angle}°`, 20, 20);
      ctx.fillText(`v₀ = ${v0} m/s`, 20, 36);
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [angle, firing]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <canvas ref={canvasRef} width={680} height={220} style={{ width: "100%", borderRadius: 12, background: "rgba(10,10,30,0.85)" }} />
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#a0a0b0" }}>Angle:</span>
        <input type="range" min={10} max={80} value={angle} onChange={e => setAngle(+e.target.value)} style={{ width: 120 }} />
        <span style={{ fontSize: 12, color: "#60a5fa" }}>{angle}°</span>
        <button onClick={() => { trailRef.current = []; tRef.current = 0; setFiring(true); }} style={btnStyle("#3b82f6")}>🚀 Launch</button>
        <button onClick={() => { trailRef.current = []; tRef.current = 0; setFiring(false); }} style={btnStyle("#555")}>Reset</button>
      </div>
    </div>
  );
}

// ── Physics: Wave Animation ──
function WaveAnimation({ phase }) {
  const config = useRef({
    label: "Transverse wave — amplitude and wavelength visualized",
    draw(ctx, W, H, frame) {
      const cy = H / 2, amp = 60, freq = 0.03, speed = 0.05;
      // Wave
      ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const y = cy + amp * Math.sin(freq * x - speed * frame);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Amplitude arrow
      const ax = 80, ayTop = cy - amp, ayBot = cy + amp;
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(ax, ayTop); ctx.lineTo(ax, ayBot); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#f59e0b"; ctx.font = "11px system-ui";
      ctx.fillText("Amplitude", ax + 6, cy);
      // Wavelength
      const wl = Math.PI * 2 / freq;
      ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(200, cy + amp + 20); ctx.lineTo(200 + wl, cy + amp + 20); ctx.stroke();
      ctx.fillStyle = "#22c55e"; ctx.fillText("λ (wavelength)", 200 + wl / 2 - 30, cy + amp + 36);
      // Equilibrium
      ctx.strokeStyle = "#ffffff15"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    }
  }).current;
  return <SubjectCanvasAnimation phase={phase} config={config} />;
}

// ── Chemistry: Atomic Structure (Bohr Model) ──
function AtomicAnimation({ phase }) {
  const config = useRef({
    label: "Bohr model — electrons orbiting the nucleus in shells",
    draw(ctx, W, H, frame) {
      const cx = W / 2, cy = H / 2;
      // Nucleus
      ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444"; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
      ctx.fillText("p⁺n⁰", cx, cy + 4);
      // Shells
      const shells = [{ r: 50, e: 2 }, { r: 85, e: 4 }, { r: 120, e: 2 }];
      shells.forEach(({ r, e }, si) => {
        ctx.strokeStyle = "#333366"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < e; i++) {
          const a = (frame * (0.015 + si * 0.005) + (i * Math.PI * 2) / e) % (Math.PI * 2);
          const ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
          ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#60a5fa"; ctx.fill();
        }
        ctx.fillStyle = "#444466"; ctx.font = "9px system-ui";
        ctx.fillText(`n=${si + 1}`, cx + r + 8, cy + 4);
      });
      ctx.textAlign = "start";
    }
  }).current;
  return <SubjectCanvasAnimation phase={phase} config={config} />;
}

// ── Chemistry: pH Scale ──
function PHScaleAnimation({ phase }) {
  const [ph, setPh] = useState(7);
  const colors = ["#ff0000","#ff4400","#ff8800","#ffaa00","#ffcc00","#ccdd00","#88cc00","#44bb44","#00aa88","#0088aa","#0066cc","#0044dd","#2222cc","#4400bb","#6600aa"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "rgba(10,10,30,0.85)", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
          {colors.map((c, i) => (
            <div key={i} onClick={() => setPh(i)} style={{
              flex: 1, height: 40, background: c, borderRadius: i === 0 ? "6px 0 0 6px" : i === 14 ? "0 6px 6px 0" : 0,
              cursor: "pointer", border: ph === i ? "2px solid #fff" : "none", transition: "all 0.2s",
              display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4,
            }}>
              <span style={{ fontSize: 9, color: i < 5 ? "#fff" : "#000", fontWeight: 700 }}>{i}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: colors[ph] }}>pH {ph}</span>
          <div style={{ fontSize: 13, color: "#a0a0b0", marginTop: 4 }}>
            {ph < 7 ? `Acidic${ph < 3 ? " (Strong)" : ""}` : ph === 7 ? "Neutral" : `Basic/Alkaline${ph > 11 ? " (Strong)" : ""}`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Biology: Cell Structure ──
function CellAnimation({ phase }) {
  const config = useRef({
    label: "Animal cell — click organelles to learn their function",
    draw(ctx, W, H, frame) {
      const cx = W / 2, cy = H / 2;
      // Cell membrane
      ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, 220, 100, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#22c55e08"; ctx.fill();
      // Nucleus
      ctx.beginPath(); ctx.arc(cx - 30, cy, 35, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f620"; ctx.fill();
      ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#3b82f6"; ctx.font = "10px system-ui"; ctx.textAlign = "center";
      ctx.fillText("Nucleus", cx - 30, cy + 4);
      // Mitochondria
      const mx = cx + 80, my = cy - 20;
      ctx.beginPath(); ctx.ellipse(mx, my, 25, 12, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "#ef444420"; ctx.fill();
      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#ef4444"; ctx.font = "9px system-ui";
      ctx.fillText("Mitochondria", mx, my + 24);
      // ER
      ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const sx = cx + 20 + i * 15, sy = cy + 30;
        ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 7, sy + 10, sx + 14, sy);
      }
      ctx.stroke();
      ctx.fillStyle = "#8b5cf6"; ctx.font = "9px system-ui";
      ctx.fillText("ER", cx + 55, cy + 55);
      // Ribosomes (dots)
      ctx.fillStyle = "#f59e0b";
      for (let i = 0; i < 8; i++) {
        const rx = cx - 100 + Math.cos(i * 0.8 + frame * 0.01) * 60;
        const ry = cy - 40 + Math.sin(i * 1.2 + frame * 0.008) * 30;
        ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#f59e0b"; ctx.font = "9px system-ui";
      ctx.fillText("Ribosomes", cx - 140, cy - 50);
      ctx.textAlign = "start";
    }
  }).current;
  return <SubjectCanvasAnimation phase={phase} config={config} />;
}

// ── Biology: DNA Replication ──
function DNAAnimation({ phase }) {
  const config = useRef({
    label: "DNA double helix — base pairs A-T and G-C",
    draw(ctx, W, H, frame) {
      const cy = H / 2, amp = 40, offset = frame * 0.03;
      const colors = { A: "#ef4444", T: "#3b82f6", G: "#22c55e", C: "#f59e0b" };
      const pairs = "ATGCTAGCATGCTAGCATGC".split("");
      for (let i = 0; i < pairs.length; i++) {
        const x = 40 + i * 32;
        const y1 = cy + amp * Math.sin(i * 0.5 + offset);
        const y2 = cy - amp * Math.sin(i * 0.5 + offset);
        const base = pairs[i];
        const complement = base === "A" ? "T" : base === "T" ? "A" : base === "G" ? "C" : "G";
        // Backbone
        ctx.strokeStyle = "#444466"; ctx.lineWidth = 2;
        if (i > 0) {
          const px = 40 + (i - 1) * 32;
          const py1 = cy + amp * Math.sin((i - 1) * 0.5 + offset);
          const py2 = cy - amp * Math.sin((i - 1) * 0.5 + offset);
          ctx.beginPath(); ctx.moveTo(px, py1); ctx.lineTo(x, y1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px, py2); ctx.lineTo(x, y2); ctx.stroke();
        }
        // Base pair bridge
        ctx.strokeStyle = "#ffffff20"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
        // Bases
        ctx.beginPath(); ctx.arc(x, y1, 8, 0, Math.PI * 2);
        ctx.fillStyle = colors[base]; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y2, 8, 0, Math.PI * 2);
        ctx.fillStyle = colors[complement]; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 8px system-ui"; ctx.textAlign = "center";
        ctx.fillText(base, x, y1 + 3); ctx.fillText(complement, x, y2 + 3);
      }
      ctx.textAlign = "start";
      ctx.fillStyle = "#666688"; ctx.font = "10px system-ui";
      ctx.fillText("A-T (2 bonds)  G-C (3 bonds)", 20, H - 15);
    }
  }).current;
  return <SubjectCanvasAnimation phase={phase} config={config} />;
}

// ── Biology: Ecosystem / Food Chain ──
function EcosystemAnimation({ phase }) {
  const levels = [
    { label: "Sun ☀️", color: "#f59e0b", y: 20 },
    { label: "Producers 🌿", color: "#22c55e", y: 60 },
    { label: "Primary Consumers 🐰", color: "#3b82f6", y: 100 },
    { label: "Secondary Consumers 🦊", color: "#f97316", y: 140 },
    { label: "Decomposers 🍄", color: "#8b5cf6", y: 180 },
  ];
  return (
    <div style={{ background: "rgba(10,10,30,0.85)", borderRadius: 12, padding: "16px 24px" }}>
      {levels.map((lvl, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: `${100 - i * 15}%`, maxWidth: 500, background: lvl.color + "22", border: `1px solid ${lvl.color}44`, borderRadius: 8, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: lvl.color, fontWeight: 600 }}>{lvl.label}</span>
            <span style={{ fontSize: 10, color: "#666688" }}>Energy: {100 - i * 20}%</span>
          </div>
          {i < levels.length - 1 && <span style={{ color: "#444466", fontSize: 16 }}>↓</span>}
        </div>
      ))}
      <div style={{ fontSize: 11, color: "#666688", textAlign: "center", marginTop: 8 }}>Energy decreases ~90% at each trophic level</div>
    </div>
  );
}

// ── CS: OOP Visualization ──
function OOPAnimation({ phase }) {
  return (
    <div style={{ background: "rgba(10,10,30,0.85)", borderRadius: 12, padding: "20px" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { name: "Animal", props: ["name", "age"], methods: ["eat()", "sleep()"], color: "#3b82f6", isParent: true },
          { name: "Dog", props: ["breed"], methods: ["bark()", "fetch()"], color: "#22c55e" },
          { name: "Cat", props: ["indoor"], methods: ["purr()", "scratch()"], color: "#f59e0b" },
        ].map((cls, i) => (
          <div key={i} style={{ border: `1.5px solid ${cls.color}`, borderRadius: 10, overflow: "hidden", minWidth: 150, background: cls.color + "08" }}>
            <div style={{ background: cls.color + "22", padding: "8px 12px", borderBottom: `1px solid ${cls.color}33` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: cls.color }}>{cls.isParent ? "🔷 " : "↳ "}{cls.name}</span>
            </div>
            <div style={{ padding: "8px 12px" }}>
              {cls.props.map(p => <div key={p} style={{ fontSize: 11, color: "#8888cc", fontFamily: "monospace" }}>+ {p}</div>)}
              <div style={{ borderTop: "1px solid #1a1a2e", margin: "6px 0" }} />
              {cls.methods.map(m => <div key={m} style={{ fontSize: 11, color: "#a0a0b0", fontFamily: "monospace" }}>+ {m}</div>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 60, marginTop: 12 }}>
        <span style={{ fontSize: 10, color: "#444466" }}>◀── inherits ──▶</span>
      </div>
    </div>
  );
}

// ── Universal fallback for topics with slides but no unique animation ──
function TopicPlaceholderAnimation({ phase, topicKey }) {
  const SUBJECT_COLORS = {
    "math": "#8b5cf6", "physics": "#3b82f6", "chemistry": "#ef4444",
    "biology": "#22c55e", "cs": "#f59e0b", "default": "#60a5fa",
  };
  const getSubject = (k) => {
    if (["quadratic","linear-eq","trig","matrix","derivative","integral","probability","statistics","sets","numtheory"].some(s => k.includes(s))) return "math";
    if (["newton","projectile","circuit","wave","optics","thermo","gravity"].some(s => k.includes(s))) return "physics";
    if (["atom","periodic","bonding","reaction","ph","gas"].some(s => k.includes(s))) return "chemistry";
    if (["cell","dna","photo","mitosis","eco","heart"].some(s => k.includes(s))) return "biology";
    if (["oop","db","net","sched","binnum"].some(s => k.includes(s))) return "cs";
    return "default";
  };
  const subject = getSubject(topicKey || "");
  const color = SUBJECT_COLORS[subject];
  const label = topicKey ? topicKey.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Topic";

  return (
    <div style={{
      background: "rgba(10,10,30,0.85)", borderRadius: 12, height: 200,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
      border: `1px solid ${color}22`,
    }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: color + "20", border: `2px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 20 }}>{subject === "math" ? "📐" : subject === "physics" ? "⚡" : subject === "chemistry" ? "⚗️" : subject === "biology" ? "🧬" : subject === "cs" ? "💻" : "📚"}</span>
      </div>
      <span style={{ color, fontSize: 16, fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#444466", fontSize: 12 }}>Interactive visualization for this topic</span>
    </div>
  );
}

// Generic / fallback animation
function GenericAnimation({ phase }) {
  return (
    <div style={{
      background: "rgba(10,10,30,0.85)", borderRadius: 12, height: 180,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#444466", fontSize: 14,
    }}>
      Ask about any topic — DSA, Math, Physics, Chemistry, Biology, or CS!
    </div>
  );
}

// ─────────────────────────────────────────────
// 4. ANIMATION REGISTRY
// ─────────────────────────────────────────────
function makeTopicEntries(prefix, Component) {
  const entries = {};
  entries[prefix] = Component;
  ["intro", "concept", "walkthrough", "complexity", "usecases", "basecase", "tabulation", "ops",
   "formula", "intercepts", "identities", "determinant", "apps", "dist", "viz",
   "third", "equations", "power", "interference", "lenses", "entropy", "weight",
   "config", "properties", "structures", "types", "neutral", "ideal",
   "compare", "mutations", "equation", "cytokinesis", "balance", "cycle",
   "poly", "normal", "dns", "priority",
  ].forEach(suffix => { entries[`${prefix}-${suffix}`] = Component; });
  return entries;
}

const ANIMATION_MAP = {
  // DSA
  ...makeTopicEntries("binary-search", BinarySearchAnimation),
  ...makeTopicEntries("bubble-sort", BubbleSortAnimation),
  ...makeTopicEntries("stack", StackAnimation),
  ...makeTopicEntries("linked-list", LinkedListAnimation),
  ...makeTopicEntries("recursion", RecursionAnimation),
  ...makeTopicEntries("hash-table", HashTableAnimation),
  "hash-intro": HashTableAnimation, "hash-concept": HashTableAnimation,
  "hash-collision": HashTableAnimation, "hash-complexity": HashTableAnimation,
  ...makeTopicEntries("bfs", BFSAnimation),
  // Math
  ...makeTopicEntries("quadratic-equation", QuadraticAnimation),
  "quadratic-intro": QuadraticAnimation, "quadratic-concept": QuadraticAnimation,
  "quadratic-walkthrough": QuadraticAnimation, "quadratic-formula": QuadraticAnimation,
  ...makeTopicEntries("trigonometry", TrigAnimation),
  "trig-intro": TrigAnimation, "trig-concept": TrigAnimation,
  "trig-walkthrough": TrigAnimation, "trig-identities": TrigAnimation,
  ...makeTopicEntries("probability", ProbabilityAnimation),
  "probability-intro": ProbabilityAnimation, "probability-concept": ProbabilityAnimation,
  "probability-walkthrough": ProbabilityAnimation, "probability-dist": ProbabilityAnimation,
  ...makeTopicEntries("statistics", StatisticsAnimation),
  "statistics-intro": StatisticsAnimation, "statistics-concept": StatisticsAnimation,
  "statistics-walkthrough": StatisticsAnimation, "statistics-viz": StatisticsAnimation,
  // Physics
  ...makeTopicEntries("projectile-motion", ProjectileAnimation),
  "projectile-intro": ProjectileAnimation, "projectile-concept": ProjectileAnimation,
  "projectile-walkthrough": ProjectileAnimation, "projectile-equations": ProjectileAnimation,
  ...makeTopicEntries("waves", WaveAnimation),
  "waves-intro": WaveAnimation, "waves-concept": WaveAnimation,
  "waves-walkthrough": WaveAnimation, "waves-interference": WaveAnimation,
  // Chemistry
  ...makeTopicEntries("atomic-structure", AtomicAnimation),
  "atom-intro": AtomicAnimation, "atom-concept": AtomicAnimation,
  "atom-walkthrough": AtomicAnimation, "atom-config": AtomicAnimation,
  ...makeTopicEntries("ph-scale", PHScaleAnimation),
  "ph-intro": PHScaleAnimation, "ph-concept": PHScaleAnimation,
  "ph-walkthrough": PHScaleAnimation, "ph-neutral": PHScaleAnimation,
  // Biology
  ...makeTopicEntries("cell-structure", CellAnimation),
  "cell-intro": CellAnimation, "cell-concept": CellAnimation,
  "cell-walkthrough": CellAnimation, "cell-compare": CellAnimation,
  ...makeTopicEntries("dna-replication", DNAAnimation),
  "dna-intro": DNAAnimation, "dna-concept": DNAAnimation,
  "dna-walkthrough": DNAAnimation, "dna-mutations": DNAAnimation,
  ...makeTopicEntries("ecosystem", EcosystemAnimation),
  "eco-intro": EcosystemAnimation, "eco-concept": EcosystemAnimation,
  "eco-walkthrough": EcosystemAnimation, "eco-balance": EcosystemAnimation,
  // CS
  ...makeTopicEntries("oop", OOPAnimation),
  "oop-intro": OOPAnimation, "oop-concept": OOPAnimation,
  "oop-walkthrough": OOPAnimation, "oop-poly": OOPAnimation,
  // Generic
  "generic": GenericAnimation, "generic-intro": GenericAnimation,
  "generic-concept": GenericAnimation, "generic-example": GenericAnimation,
  "generic-summary": GenericAnimation,
};

// ─────────────────────────────────────────────
// 5. MAIN COMPONENT — drop this into your Canvas
// ─────────────────────────────────────────────
export function TopicAnimationEngine({ topic = "generic", animationKey, slideIndex = 0 }) {
  const key = animationKey || topic;
  const AnimComponent = ANIMATION_MAP[key];
  if (AnimComponent) return <AnimComponent phase={slideIndex} />;
  // If we have a known topic but no dedicated animation, show the subject-aware placeholder
  if (topic !== "generic") return <TopicPlaceholderAnimation phase={slideIndex} topicKey={key} />;
  return <GenericAnimation phase={slideIndex} />;
}

// ─────────────────────────────────────────────
// 6. CANVAS PAGE INTEGRATION EXAMPLE
// ─────────────────────────────────────────────
export function CanvasPageExample() {
  const [userMessage, setUserMessage] = useState("");
  const [topic, setTopic] = useState("generic");
  const [slides, setSlides] = useState(generateSlides("generic", ""));
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleStart = () => {
    const detected = detectTopic(userMessage);
    const newSlides = generateSlides(detected, userMessage);
    setTopic(detected);
    setSlides(newSlides);
    setCurrentSlide(0);
  };

  const slide = slides[currentSlide];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui", color: "#e0e0f0" }}>
      <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 10 }}>
        <input
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder='Ask something like "Explain binary search" or "How does recursion work"'
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #2a3560", background: "#0a0a16", color: "#fff", fontSize: 14 }}
          onKeyDown={(e) => e.key === "Enter" && handleStart()}
        />
        <button onClick={handleStart} style={btnStyle("#3b82f6")}>Open Canvas</button>
      </div>

      {topic !== "generic" && (
        <div style={{ marginBottom: 8, fontSize: 12, color: "#60a5fa" }}>
          Topic detected: <strong>{topic}</strong>
        </div>
      )}

      <div style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #1a1a2e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{slide.title}</div>
            <div style={{ fontSize: 12, color: "#666688" }}>{slide.subtitle}</div>
          </div>
          <div style={{ fontSize: 12, color: "#444466" }}>{currentSlide + 1} / {slides.length}</div>
        </div>

        <div style={{ padding: 20 }}>
          <TopicAnimationEngine topic={topic} animationKey={slide.animation} slideIndex={currentSlide} />
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={() => setCurrentSlide((i) => Math.max(0, i - 1))} disabled={currentSlide === 0} style={btnStyle("#333")}>◀ Prev</button>
          <div style={{ display: "flex", gap: 6 }}>
            {slides.map((_, i) => (
              <div key={i} onClick={() => setCurrentSlide(i)} style={{ width: 8, height: 8, borderRadius: "50%", background: i === currentSlide ? "#3b82f6" : "#2a3560", cursor: "pointer" }} />
            ))}
          </div>
          <button onClick={() => setCurrentSlide((i) => Math.min(slides.length - 1, i + 1))} disabled={currentSlide === slides.length - 1} style={btnStyle("#3b82f6")}>Next ▶</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function btnStyle(bg) {
  return {
    padding: "7px 16px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color: bg === "#555" ? "#aaa" : "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export default CanvasPageExample;