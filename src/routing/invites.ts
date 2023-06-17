import { Express, Request, Response} from 'express';
import { handleException } from './exceptionHandler';
import { ValidationError } from '../exceptions';
import { verifyToken } from '../middleware/auth';

export const register = (app: Express) => {

  app.post('/invitation/list/accept', verifyToken, (req, res) => {
    const user = (req as any).user;
  });

  app.post('/invitation/list/deny', verifyToken, (req, res) => {
    const user = (req as any).user;
  });

};