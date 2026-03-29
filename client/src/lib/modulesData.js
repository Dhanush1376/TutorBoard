export const modulesData = [
  {
    id: "module-binary-search",
    title: "Binary Search",
    description: "Find the number 10 in a sorted array using O(log n) efficiency.",
    icon: "Search",
    data: {
      title: "Binary Search (Target: 10)",
      steps: [
        {
          type: "array",
          description: "We start with a sorted array of numbers.",
          animation_instructions: "Render the base array securely.",
          data: { array: [2, 4, 6, 8, 10, 12, 14] }
        },
        {
          type: "compare",
          description: "Identify the middle element (Index 3, Value 8).",
          animation_instructions: "Place pointers on bounds and highlight the middle index.",
          data: { array: [2, 4, 6, 8, 10, 12, 14], index_a: 3, index_b: 3, condition: "Middle = 8" }
        },
        {
          type: "array",
          description: "Since 8 < 10, we know the target must be in the right half. We discard the left half.",
          animation_instructions: "Dim or remove the left half. Update search bounds.",
          data: { array: [10, 12, 14] }
        },
        {
          type: "compare",
          description: "Find the new middle element (Index 1, Value 12).",
          animation_instructions: "Place pointers on bounds and highlight the new middle.",
          data: { array: [10, 12, 14], index_a: 1, index_b: 1, condition: "Middle = 12" }
        },
        {
          type: "array",
          description: "Since 12 > 10, the target must be in the left half.",
          animation_instructions: "Narrow bounds strictly to the remaining left side.",
          data: { array: [10] }
        },
        {
          type: "highlight",
          description: "We found the target! 10 == 10.",
          animation_instructions: "Pulse the element green to indicate success.",
          data: { array: [10], highlight_indices: [0] }
        }
      ]
    }
  },
  {
    id: "module-bubble-sort",
    title: "Bubble Sort",
    description: "Sort an array by swapping adjacent elements O(n²) times.",
    icon: "ArrowUpDown",
    data: {
      title: "Bubble Sort Optimization",
      steps: [
        {
          type: "array",
          description: "Here is an unsorted array.",
          animation_instructions: "Display original array state.",
          data: { array: [9, 4, 7, 2] }
        },
        {
          type: "compare",
          description: "Compare the first two elements: 9 and 4.",
          animation_instructions: "Highlight index 0 and 1 in yellow.",
          data: { array: [9, 4, 7, 2], index_a: 0, index_b: 1, condition: ">" }
        },
        {
          type: "swap",
          description: "Since 9 is greater than 4, we swap them.",
          animation_instructions: "Lift cells and swap their X coordinates.",
          data: { array: [4, 9, 7, 2], swap_i: 0, swap_j: 1 }
        },
        {
          type: "compare",
          description: "Compare the next two: 9 and 7.",
          animation_instructions: "Shift pointers to index 1 and 2.",
          data: { array: [4, 9, 7, 2], index_a: 1, index_b: 2, condition: ">" }
        },
        {
          type: "swap",
          description: "9 is greater than 7, so swap them.",
          animation_instructions: "Lift 9 and 7, swapping them efficiently.",
          data: { array: [4, 7, 9, 2], swap_i: 1, swap_j: 2 }
        },
        {
          type: "compare",
          description: "Compare the last two: 9 and 2.",
          animation_instructions: "Shift pointers to index 2 and 3.",
          data: { array: [4, 7, 9, 2], index_a: 2, index_b: 3, condition: ">" }
        },
        {
          type: "swap",
          description: "9 > 2, swap them. 9 has 'bubbled' up to its highest sorted position.",
          animation_instructions: "Swap them, then color index 3 to signify it is definitively sorted.",
          data: { array: [4, 7, 2, 9], swap_i: 2, swap_j: 3 }
        },
        {
          type: "highlight",
          description: "The array will continue this pattern until fully sorted.",
          animation_instructions: "Highlight the fully sorted state.",
          data: { array: [2, 4, 7, 9], highlight_indices: [0,1,2,3] }
        }
      ]
    }
  },
  {
    id: "module-graph-basics",
    title: "Graph Plotting",
    description: "Visualize a linear mathematical equation Cartesian plot.",
    icon: "LineChart",
    data: {
      title: "Graphing y = 2x + 1",
      steps: [
        {
          type: "graph",
          description: "Let's plot the equation y = 2x + 1. First we define the axes.",
          animation_instructions: "Draw out the X and Y axes smoothly.",
          data: { equation: "y = 2x + 1", points: [] }
        },
        {
          type: "graph",
          description: "If x = 0, y = 2(0) + 1 = 1. We plot (0, 1).",
          animation_instructions: "Pop in the first plot dot at coordinates.",
          data: { equation: "y = 2x + 1", points: [[0, 1]] }
        },
        {
          type: "graph",
          description: "If x = 2, y = 2(2) + 1 = 5. We plot (2, 5).",
          animation_instructions: "Pop in the second dot.",
          data: { equation: "y = 2x + 1", points: [[0, 1], [2, 5]] }
        },
        {
          type: "graph",
          description: "If x = -2, y = 2(-2) + 1 = -3. We plot (-2, -3).",
          animation_instructions: "Pop in the third dot on the negative axis.",
          data: { equation: "y = 2x + 1", points: [[0, 1], [2, 5], [-2, -3]] }
        },
        {
          type: "graph",
          description: "Connect the points to reveal the line.",
          animation_instructions: "Interpolate a purple SVG stroke line through all points.",
          data: { equation: "y = 2x + 1", points: [[-2, -3], [0, 1], [2, 5]] }
        }
      ]
    }
  }
];
