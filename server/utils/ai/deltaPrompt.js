/**
 * Master Delta Prompt v3.0
 * 
 * Specifically optimized for surgical, incremental canvas updates.
 */
export const MASTER_DELTA_PROMPT = ({ doubt, snapshot, topic }) => `
CURRENT TOPIC:
${topic}

STUDENT DOUBT:
"${doubt}"

CURRENT CANVAS STATE:
${JSON.stringify(snapshot, null, 2)}

TASK:
Generate a minimal VisualScript delta to address the student's doubt.

STRICT RULES:
- DO NOT regenerate full animation
- DO NOT reset the canvas
- ONLY modify existing elements
- Maximum 5 actions
- Prefer highlight, pointer emphasis, or text annotation
- Maintain timeline continuity
- If conceptual doubt (why/how) → Use text annotations/highlights rather than complex movements.


ACTION TYPES ALLOWED:
- highlightNode
- movePointer
- showTextOverlay
- emphasizeEdge
- pulseElement

DISALLOWED:
- createFullScene
- resetCanvas
- removeAllNodes

VALIDATION RULES:
- Every target MUST exist in the snapshot
- Do not invent new nodes unless absolutely necessary
- Do not exceed 5 actions
- Do not use vague targets like "some node"
- If unsure → annotate instead of modifying structure

SELF-CHECK (Internal Verification):
Before finalizing, verify:
- Are you modifying existing elements only?
- Are actions ≤ 5?
- Are you avoiding full scene regeneration?
- Is this the smallest possible explanation?
If any answer is NO, you MUST fix the output before returning.

VISUAL STYLE RULES:
- highlightNode: Use for comparisons or focus (duration: 0.5–1.0s).
- movePointer: Use only for specific markers (i, j, mid, pivot); ensure smooth motion.
- showTextOverlay: Keep text short (max 12 words) and place near the target.
- pulseElement: Use for emphasis; max 2 pulses.
- Avoid: Large movements, multiple simultaneous highlights, or long text explanations.

OUTPUT FORMAT:



{
  "explanation": "Brief answer to the doubt (1-2 sentences).",
  "actions": [
    {
      "type": "highlightNode | movePointer | showTextOverlay | emphasizeEdge | pulseElement",
      "target": "id of the element",
      "duration": 0.5,
      "meta": { "x": 0.5, "y": 0.5, "text": "optional text" }
    }
  ],
  "followUp": "One suggested thinking-aloud question."
}
`;

/**
 * Doubt Classifier Prompt
 * 
 * Used to categorize the student doubt for optimized strategy selection.
 */
export const DOUBT_CLASSIFIER_PROMPT = `
Classify the student doubt into ONE category:

1. CONCEPTUAL → "why", "what is"
2. STEP_CONFUSION → "why this step", "why swap"
3. POINTER_CONFUSION → "why mid", "why i/j"
4. LOGIC_ERROR → misunderstanding
5. UNCLEAR → vague doubt

Return only the category name in UPPERCASE.
`;
