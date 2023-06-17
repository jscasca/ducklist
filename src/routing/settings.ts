import { Express, Request, Response} from 'express';
import { verifyToken } from '../middleware/auth';

export const register = (app: Express) => {

  app.get('/settings', verifyToken, (req: Request, res: Response) => {
    const user = (req as any).user;
    res.send(200).json({'text':'welcome'});
  });

  app.post('/settings/', verifyToken, (req: Request, res: Response) => {
    res.send(200).json({'text':'welcome'});
  });

  app.get('/settings/blacklist', verifyToken, (req, res) => {
    res.send(200).json({'text':'welcome'});
  });

  app.get('/settings/whitelist', verifyToken, (req, res) => {
    res.send(200).json({'text': 'wwelcome'});
  });
};