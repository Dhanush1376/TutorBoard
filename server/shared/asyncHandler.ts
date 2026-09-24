import { Request, Response, NextFunction } from 'express';

/**
 * asyncHandler
 * Wraps async Express routes to catch errors and pass them to next()
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => any) => (req: Request, res: Response, next: NextFunction) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};
