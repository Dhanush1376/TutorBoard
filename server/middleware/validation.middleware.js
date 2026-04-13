import { z } from 'zod';

/**
 * Higher-order middleware to validate req.body against a Zod schema.
 */
export const validateBody = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    // Replace req.body with the parsed/cleaned data
    req.body = result.data;
    next();
  } catch (err) {
    next(err);
  }
};

// Common Schemas
export const GenerateSchema = z.object({
  prompt: z.string().min(2, 'Prompt must be at least 2 characters').max(5000, 'Prompt too long'),
  mode: z.enum(['quick', 'deep', 'test_me']).optional()
});

export const DoubtSchema = z.object({
  question: z.string().min(2, 'Question must be at least 2 characters').max(1000, 'Question too long')
});
