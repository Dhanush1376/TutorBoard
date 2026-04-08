/**
 * Reflection/Feedback Validator
 */
export function validateReflectionResponse(response) {
  const errors = [];
  
  if (!response || !response.status) {
    errors.push('Response must contain a "status" field ("good" or "needs_improvement")');
    return { valid: false, errors };
  }

  if (response.status === 'needs_improvement') {
    if (!Array.isArray(response.refined_steps)) {
      errors.push('If status is "needs_improvement", "refined_steps" must be an array');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
