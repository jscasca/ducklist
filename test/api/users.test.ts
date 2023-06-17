import request from 'supertest';
import { expect } from 'chai';
import dotenv from 'dotenv';
dotenv.config();

import app from '../../src/index';

describe('Register', () => {
  let registration = {
    mail: 'test@test.com',
    pass: 'password'
  };
  it('Should fail for missing parameters', (done) => {
    request(app)
      .post('/auth/register')
      .send({mail: 'some@mail.com'})
      .set('Accept', 'application/json')
      .expect(400)
      .end((err: any) => {
        if (err) return done(err);
        done()
      });
  });
  // it('Should allow new users to register', (done) => {
  //   request(app)
  //     .post('/auth/register')
  //     .send(registration)
  //     .set('Accept', 'application/json')
  //     .expect('Content-Type', /json/)
  //     .expect(400, done)
  // });
});

describe('Login', () => {
  //
});

describe('Refresh Token', () => {
  //
});