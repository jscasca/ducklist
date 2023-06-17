import * as express from 'express';
import { registerUserByMail, loginByMail, refreshToken } from '../middleware/engine';
import { handleException } from './exceptionHandler';

export const register = (app: express.Application) => {
  
  // Get all list for user
  app.post('/auth/login', (req, res) => {
    console.log('login route');
    const { mail, pass } = req.body;
    // console.log('mail: ', mail);
    // console.log('pass: ', pass);
    // console.log('body: ', req.body);
    if (!(mail && pass)) {
      return res.status(400).send('Missing parameters');
    }
    //
    loginByMail(mail, pass).then((user) => {
      // console.log('successful login');
      return res.status(200).json(user);
    }).catch((e) => {
      // console.log('loginByMail failed with ', e);
      // res.status(400).send(e.message);
      return handleException(res, e);
    })
  });

  // Get specific list
  app.post('/auth/register', (req, res) => {
    const { name, mail, pass } = req.body;
    if (!(name && mail && pass)) {
      return res.status(400).send('Missing parameters');
    }
    registerUserByMail(name, mail, pass).then((user) => {
      return res.status(200).json(user);
    }).catch((e) => {
      return handleException(res, e);
    });
  });

  app.post('/auth/refresh', (req, res) => {
    const { user_id, token } = req.body;
    if (!(user_id && token)) {
      return res.status(400).send('Missing parameters');
    }
    refreshToken(user_id, token).then((user) => {
      return res.status(200).json(user);
    }).catch((e) => {
      console.error('Failed to refresh: ', e);
      // res.status(400).send(e.message);
      return handleException(res, e);
    });
  });
}