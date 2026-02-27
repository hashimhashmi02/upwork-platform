import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, status: number = 200) => {
  return res.status(status).json({
    success: true,
    data,
    error: null,
  });
};

export const sendError = (res: Response, error: string, status: number = 400) => {
  return res.status(status).json({
    success: false,
    data: null,
    error,
  });
};
