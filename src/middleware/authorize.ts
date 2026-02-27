import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { AuthRequest } from './auth';

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user;

    if (!user || !roles.includes(user.role)) {
      sendError(res, 'FORBIDDEN', 403);
      return;
    }

    next();
  };
};
