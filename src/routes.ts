import * as express from 'express';
import { registerUserByMail, loginByMail, refreshToken } from './middleware/engine';
import { verifyToken } from './middleware/auth';
import { User } from './types';

import * as AuthRoutes from './routing/auth';
import * as ListRoutes from './routing/lists';

export const register = (app: express.Application) => {
  app.get('/', (req, res) => {});

  app.post('/loginmail', (req, res) => {
    const { mail, pass } = req.body;
    console.log('mail: ', mail);
    console.log('pass: ', pass);
    console.log('body: ', req.body);
    if (!(mail && pass)) {
      return res.status(400).send('Missing parameters');
    }
    //
    loginByMail(mail, pass).then((user) => {
      console.log('successful login');
      res.status(200).json(user);
    }).catch((e) => {
      console.log('loginByMail failed with ', e);
      res.status(400).send(e.message);
    })
  });

  app.post('/refreshtoken', (req, res) => {
    const { user_id, token } = req.body;
    if (!(user_id && token)) {
      return res.status(400).send('Missing parameters');
    }
    refreshToken(user_id, token).then((user) => {
      res.status(200).json(user);
    }).catch((e) => {
      res.status(400).send(e.message);
    });
  });

  app.post('/registermail', (req, res) => {
    const { name, mail, pass } = req.body;
    // Fail on missing inputs
    if (!(name && mail && pass)) {
      res.status(400).send('Missing parameters');
    }
    registerUserByMail(name, mail, pass).then((user) => {
      res.status(200).json(user);
    }).catch((e) => {
      res.status(400).send(e.message);
    });
  });

  app.get('/registerphone', (req, res) => {
    //
  });

  app.get('/welcome', verifyToken, (req, res) => {
    console.log('verified token');
    console.log(JSON.stringify((req as any).user));
    res.status(200).send('Welcome');
  });

  app.get('/me', (req, res) => {});

  AuthRoutes.register(app)
  // ListRoutes.register(app);
}