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

export const SignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must not exceed 50 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password too long'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const SigninSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
