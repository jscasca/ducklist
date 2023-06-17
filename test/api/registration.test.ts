import request from 'supertest';
import { expect } from 'chai';
import { connect, disconnect } from '../../src/db/database';
import dotenv from 'dotenv';
dotenv.config();

import app from '../../src/index';

const UserModel = require('../../src/models/user');
const EmailLoginModel = require('../../src/models/mailLogin');

const name = 'Username';
const email = 'email@test.com';
const password = 'Password';

before('Connect to the DB', (done) => {
  console.log('droppping database');
  connect().then((con) => {
    con.connection.db.dropDatabase(() => {
      console.log('dropped database');
      done();
    });
  });
});

after('Disconnect', () => {
  disconnect();
});

describe('Registration endpoint', () => {
  it('Should fail for missing parameters', (done) => {
    request(app)
      .post('/auth/register')
      .send({mail: email, pass: password})
      .set('Accept', 'application/json')
      .expect(400)
      .end((err: any) => {
        if (err) return done(err);
        done()
      });
  });

  it('Should pass for a name, email, and password call', (done) => {
    request(app)
      .post('/auth/register')
      .send({name, mail: email, pass: password})
      .expect(200)
      .expect((res) => {
        expect(res.body).to.have.deep.property('user_id');
        expect(res.body).to.have.deep.property('name', name);
        expect(res.body).to.have.deep.property('icon');
        expect(res.body).to.have.deep.property('token');
        expect(res.body).to.have.deep.property('refreshToken');
      })
      .end(done)
  });

  /*
it('test aysync', async () => {
  test = await supertest(app)....
  expect(test.body)to.be....
});
  */

  it('Should insert the user and login', async () => {
    const user = await UserModel.findOne({name});
    const login = await EmailLoginModel.findOne({mail: email});
    expect(user).to.exist;
    expect(user).to.have.deep.property('name', name);
    expect(login).to.exist;
    expect(login).to.have.deep.property('mail', email);

    expect(login).to.have.deep.property('user_id', user._id.toString());
  });

  it('Should fail for duplicate emails', (done) => {
    request(app)  
      .post('/auth/register')
      .send({name, mail: email, pass: password})
      .expect(409)
      .end((err: any) => {
        if(err) return done(err);
        done()
      })
  });
});

describe('Login', () => {
  //
  it('Should allow a user to login', (done) => {
    request(app)
      .post('/auth/login')
      .send({mail: email, pass: password})
      .expect(200)
      .expect((res) => {
        console.log(res.body);
        expect(res.body).to.have.deep.property('user_id');
        expect(res.body).to.have.deep.property('name', name);
        expect(res.body).to.have.deep.property('icon');
        expect(res.body).to.have.deep.property('token');
        expect(res.body).to.have.deep.property('refreshToken');
      })
      .end(done)
  });

  it('Should fail on incorrect username', (done) => {
    request(app)
      .post('/auth/login')
      .send({mail: 'wrong mail', pass: password})
      .set('Accept', 'application/json')
      .expect(404)
      .end((err: any) => {
        if (err) return done(err);
        done()
      });
  });

  it('Should fail on incorrect password', (done) => {
    request(app)
      .post('/auth/login')
      .send({mail: email, pass: 'wrong'})
      .set('Accept', 'application/json')
      .expect(401)
      .end((err: any) => {
        if (err) return done(err);
        done()
      });
  });
});

describe('Refresh Token', () => {
  // TBD: refresh token
});

describe('Welcome banner', () => {
  it('Shoudl fail for incorrect token', (done) => {
    done();
  })
});
