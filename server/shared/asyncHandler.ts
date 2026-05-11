import { Request, Response, NextFunction } from 'express';

/**
 * asyncHandler
 * Wraps async Express routes to catch errors and pass them to next()
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};
