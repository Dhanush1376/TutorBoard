/**
 * Formats raw AI output into standardized TutorBoard JSON
 */
export function formatStandardOutput(rawContent) {
  try {
    // Attempt to extract JSON from markdown if present
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : rawContent;
    
    const parsed = JSON.parse(cleanJson);
    
    return {
      steps: parsed.steps || [],
      explanation: parsed.explanation || "No explanation provided.",
      visualization: parsed.visualization || [],
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    // Fallback if parsing fails
    return {
      steps: ["Introduction"],
      explanation: rawContent,
      visualization: ["show topic"],
      timestamp: new Date().toISOString(),
      error: "Failed to parse structured output"
    };
  }
}
