/**
 * JSON extraction utilities for robust AI response parsing
 */

export function extractJSON(text: string) {
  return strictParseJSON(text); // Backwards compatibility
}

export function strictParseJSON(text: string): any {
  if (!text || typeof text !== 'string') {
    console.error("[JSON PARSER] Error: Input text is empty or not a string.");
    return null;
  }

  const cleanText = text.trim();
  console.log("[JSON PARSER] Extracting from string of length:", cleanText.length);

  // Strip markdown formatting if present
  let processedText = cleanText;
  const markdownRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const match = processedText.match(markdownRegex);
  if (match) {
    processedText = match[1].trim();
  }

  // Find boundaries of JSON
  const firstBrace = processedText.indexOf('{');
  const lastBrace = processedText.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    console.error("[JSON PARSER] Error: Could not find valid { } boundaries.");
    console.log("[JSON PARSER] RAW TEXT FAILED:", processedText);
    return null;
  }

  let jsonCandidate = processedText.substring(firstBrace, lastBrace + 1);

  // Fix common AI formatting errors: Remove trailing commas
  jsonCandidate = jsonCandidate.replace(/,\s*([\]}])/g, '$1');

  try {
    const parsed = JSON.parse(jsonCandidate);
    console.log("[JSON PARSER] Success: Parsed valid JSON object.");
    return parsed;
  } catch (err: any) {
    console.error("[JSON PARSER] Failed to parse JSON:", err.message);
    console.log("[JSON PARSER] MALFORMED JSON CANDIDATE:", jsonCandidate);
    return null;
  }
}
