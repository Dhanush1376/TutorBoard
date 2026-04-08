export function validatePedagogyResponse(data) {
  const errors = [];
  
  if (!data) return { valid: false, errors: ['Response is empty or null'] };
  
  if (typeof data.concept !== 'string') errors.push("Missing or invalid 'concept'");
  if (typeof data.learning_goal !== 'string') errors.push("Missing or invalid 'learning_goal'");
  
  const validIntent = ['quick_overview', 'deep_understanding', 'problem_solving'];
  if (!validIntent.includes(data.learning_intent)) errors.push(`Invalid learning_intent: ${data.learning_intent}`);

  const validDiff = ['beginner', 'intermediate', 'advanced'];
  if (!validDiff.includes(data.difficulty_level)) errors.push(`Invalid difficulty_level: ${data.difficulty_level}`);

  if (!Array.isArray(data.predicted_pain_points)) errors.push("Missing predicted_pain_points array");

  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    errors.push("'steps' must be a non-empty array");
  } else {
    data.steps.forEach((step, i) => {
      if (typeof step.title !== 'string') errors.push(`Step ${i} missing 'title'`);
      if (typeof step.explanation !== 'string') errors.push(`Step ${i} missing 'explanation'`);
      const exec = step.execution || {};
      const intensity = step.visualization_intensity || exec.intensity;
      const pacing = step.pacing || exec.pacing;
      const interaction = step.interaction_type || exec.interaction;

      if (!['low', 'medium', 'high'].includes(intensity)) {
        errors.push(`Step ${i} missing/invalid 'visualization_intensity'`);
      }
      if (!['slow', 'medium', 'fast'].includes(pacing)) {
        errors.push(`Step ${i} missing/invalid 'pacing'`);
      }
      if (!['passive', 'guided', 'interactive'].includes(interaction)) {
        errors.push(`Step ${i} missing/invalid 'interaction_type'`);
      }

      if (step.explanation && step.explanation.split(' ').length > 40) {
        errors.push(`Step ${i} explanation too long (> 40 words). Keep it concise (1-2 lines).`);
      }

      if (!['beginner', 'intermediate', 'advanced'].includes(step.cognitive_load)) {
         errors.push(`Step ${i} missing/invalid 'cognitive_load'`);
      }
    });
  }

  // Fast-pass clarity heuristic validator (Replaces ReflectionAgent)
  let shouldRefine = false;
  const issues = [];

  if (data.steps && data.steps.length > 6) {
    shouldRefine = true;
    issues.push("Too many steps. Maximum of 6 steps allowed to prevent cognitive overload.");
  }
  
  if (data.steps && data.steps.length > 0) {
    if (data.steps[0].title.toLowerCase().includes("conclusion")) {
      shouldRefine = true;
      issues.push("First step cannot be Conclusion. Must follow progressive disclosure.");
    }

    // Complexity heuristic: Average explanation length > 25 words or any step > 40 words
    let totalWords = 0;
    data.steps.forEach(s => {
      const wc = s.explanation ? s.explanation.split(' ').length : 0;
      totalWords += wc;
      if (wc > 40) {
        shouldRefine = true;
        issues.push(`Step ${s.step_number} is too verbose (${wc} words). Target is < 25.`);
      }
    });

    if (totalWords / data.steps.length > 25) {
      shouldRefine = true;
      issues.push("Average explanation length is too high. Simplify content.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    shouldRefine,
    issues
  };
}
