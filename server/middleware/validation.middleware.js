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
  mode: z.enum(['quick', 'deep', 'test_me']).optional(),
  agentId: z.string().optional(),
  model: z.string().optional(),
});

export const DoubtSchema = z.object({
  question: z.string().min(2, 'Question must be at least 2 characters').max(1000, 'Question too long')
});

export const SignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must not exceed 50 characters'),
  email: z.string().trim().max(254).email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const SigninSchema = z.object({
  email: z.string().trim().max(254).email('Invalid email address'),
  password: z.string().min(1, 'Password is required').max(128),
});

// ── Account recovery & verification ──
const EmailField = z.string().trim().min(3).max(254).email('Invalid email address');
const NewPassword = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');
const OtpCode = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const EmailOnlySchema = z.object({ email: EmailField });
export const VerifyCodeSchema = z.object({ code: OtpCode });
export const ResetVerifySchema = z.object({ email: EmailField, code: OtpCode });
export const ResetPasswordSchema = z.object({
  resetToken: z.string().min(20).max(100),
  password: NewPassword,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: NewPassword,
});
export const ExchangeSchema = z.object({ code: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid code') });
