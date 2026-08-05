export function generateFallbackVisualScript(topic: string = "Topic") {
  console.warn(`[Fallback Visualizer] Generating emergency visual lesson for topic: ${topic}`);

  // Ordered so the client segments it into THREE progressive steps (one per
  // narrate): root → key details → applications. Each `narrate` closes a step,
  // so the concept map is revealed piece by piece alongside the narration rather
  // than dumped in one frame.
  return {
    renderer: "cinematic",
    scene: "fallback_scene",
    script: [
      // ── Step 1: the core concept ──
      {
        cmd: "node",
        id: "fallback_root",
        title: topic,
        subtitle: "Core Concept",
        x: 0.5,
        y: 0.22,
        color: "#F59E0B", // amber
        glow: true,
        importance: 5,
        shape: "diamond"
      },
      {
        cmd: "narrate",
        text: `Let's build up ${topic} one piece at a time. We'll start from the core idea in the center.`
      },
      // ── Step 2: the key details ──
      {
        cmd: "node",
        id: "fallback_info_1",
        title: "Key Details",
        subtitle: "What makes it work",
        x: 0.28,
        y: 0.7,
        color: "#3B82F6", // blue
        importance: 3,
        shape: "circle"
      },
      {
        cmd: "edge",
        id: "e1",
        from: "fallback_root",
        to: "fallback_info_1",
        label: "has",
        type: "glow",
        animated: true
      },
      {
        cmd: "narrate",
        text: `First, the key details — the essential parts that make ${topic} work. These connect directly back to the core idea.`
      },
      // ── Step 3: the applications ──
      {
        cmd: "node",
        id: "fallback_info_2",
        title: "Applications",
        subtitle: "Where it's used",
        x: 0.72,
        y: 0.7,
        color: "#10B981", // emerald
        importance: 3,
        shape: "circle"
      },
      {
        cmd: "edge",
        id: "e2",
        from: "fallback_root",
        to: "fallback_info_2",
        label: "enables",
        type: "glow",
        animated: true
      },
      {
        cmd: "narrate",
        text: `And finally, where ${topic} is applied in practice. That's the big picture — core idea, key details, and real-world use.`
      }
    ]
  };
}

// Minimum Working Visual Lesson (Pythagoras) for Step 6 and 7 bypass testing
export function getHardcodedPythagorasLesson() {
  console.warn(`[Fallback Visualizer] INJECTING HARDCODED PYTHAGORAS LESSON`);
  return {
    renderer: "cinematic",
    scene: "pythagoras_theorem",
    script: [
      {
        cmd: "node",
        id: "pythagoras_triangle",
        title: "Right Triangle",
        subtitle: "a² + b² = c²",
        x: 0.5,
        y: 0.4,
        color: "#6366F1", // indigo
        importance: 5,
        shape: "triangle"
      },
      {
        cmd: "node",
        id: "side_a",
        label: "Side a (3)",
        x: 0.35,
        y: 0.6,
        color: "#10B981", // emerald
        importance: 2,
        shape: "circle"
      },
      {
        cmd: "node",
        id: "side_b",
        label: "Side b (4)",
        x: 0.65,
        y: 0.6,
        color: "#F59E0B", // amber
        importance: 2,
        shape: "circle"
      },
      {
        cmd: "node",
        id: "hypotenuse_c",
        label: "Hypotenuse c (5)",
        x: 0.5,
        y: 0.2,
        color: "#EC4899", // pink
        glow: true,
        importance: 4,
        shape: "diamond"
      },
      {
        cmd: "edge",
        id: "e_a",
        from: "pythagoras_triangle",
        to: "side_a",
        label: "Leg",
        type: "dashed"
      },
      {
        cmd: "edge",
        id: "e_b",
        from: "pythagoras_triangle",
        to: "side_b",
        label: "Leg",
        type: "dashed"
      },
      {
        cmd: "edge",
        id: "e_c",
        from: "pythagoras_triangle",
        to: "hypotenuse_c",
        label: "Longest Side",
        type: "glow",
        animated: true
      }
    ]
  };
}
