/**
 * SimulatorAgent v1.0
 * 
 * Takes a topic + domain and returns a complete self-contained
 * HTML simulation component as a string.
 * The client receives this string and runs it in a sandboxed iframe.
 */

import { requestCompletion, getModel } from '../../utils/ai/llmClient.js';

const SIMULATOR_SYSTEM_PROMPT = `You are SimulatorAgent — an expert at building interactive educational simulations.

Your ONLY job is to write a complete, self-contained HTML simulation for a given topic.

STRICT OUTPUT RULES:
1. Return ONLY raw HTML. No markdown. No backticks. No explanation.
2. The HTML must be completely self-contained — no external CDN links, no imports.
3. All CSS must be inside a <style> tag. All JS must be inside a <script> tag.
4. The simulation MUST have interactive controls (sliders, buttons) that update the visual in real-time.
5. Use Canvas API or inline SVG for the visualization — no external libraries.
6. Dark theme: background #0d0d14, accent color #a78bfa (purple), text white.
7. The simulation must show live numerical readouts that update as the user interacts.
8. Maximum 300 lines of code. Keep it focused and clean.
9. Must work standalone in an iframe with no parent communication needed.

REQUIRED LAYOUT STRUCTURE:
- Left panel (220px): Title, sliders/controls, parameter display
- Center (flex 1): Canvas or SVG visualization  
- Right panel (180px): Live readout cards, equations, legend
- Bottom bar: Play/pause button + scrubber + time display

QUALITY REQUIREMENTS:
- The visualization must animate smoothly (requestAnimationFrame)
- Sliders must update the simulation in real-time without lag
- Show the key equations for the topic
- Show a legend explaining visual elements
- The "wow moment": one thing that makes the student say "I get it now"

TOPICS AND WHAT TO BUILD:
- Projectile motion → parabolic path with live x/y/v readouts, angle+speed sliders
- Pendulum → swinging mass with period readout, length+gravity sliders
- Wave interference → two waves combining, frequency+amplitude sliders
- Ohm's law → circuit with live V/I/R readouts, resistance slider
- Pythagorean theorem → interactive triangle, drag-to-resize sides, live c calculation
- Bubble sort → array visualization with step-by-step animation
- Binary search → array with pointer animation showing divide and conquer
- Newton's laws → force arrows on object, mass+force sliders
- Circular motion → rotating object with velocity vectors, angular speed slider
- Simple harmonic motion → spring-mass system with energy readouts

For any other topic: build the most visually clear simulation possible.`;

export async function runSimulatorAgent({ topic, domain, modelId, userConfig }) {
  console.log(`[SimulatorAgent] Generating simulation for: "${topic}" (domain: ${domain})`);

  try {
    const res = await requestCompletion({
      model: modelId || getModel(),
      messages: [
        { role: 'system', content: SIMULATOR_SYSTEM_PROMPT },
        { role: 'user', content: `Build an interactive simulation for: ${topic}\nDomain: ${domain || 'general science'}` }
      ],
      temperature: 0.2,
      maxTokens: 4000,
      userConfig,
      taskType: 'teaching'
    });

    let html = res.content || '';
    
    // Strip any accidental markdown wrapping
    html = html.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim();
    
    // Basic safety validation
    if (!html.includes('<canvas') && !html.includes('<svg') && !html.includes('<div')) {
      console.error('[SimulatorAgent] Output does not look like HTML. Aborting.');
      return null;
    }

    // Block dangerous patterns
    const dangerous = ['fetch(', 'XMLHttpRequest', 'eval(', 'document.cookie', 'localStorage'];
    for (const pattern of dangerous) {
      if (html.includes(pattern)) {
        console.warn(`[SimulatorAgent] Blocked dangerous pattern: ${pattern}`);
        html = html.replace(new RegExp(pattern.replace('(', '\\('), 'g'), '/* blocked */');
      }
    }

    console.log(`[SimulatorAgent] ✅ Generated ${html.length} chars of HTML`);
    return html;

  } catch (err) {
    console.error('[SimulatorAgent] ❌ Failed:', err.message);
    return null;
  }
}
