import request from 'supertest';
import { expect } from 'chai';
import { connect, disconnect } from '../../src/db/database';
import dotenv from 'dotenv';
dotenv.config();

import app from '../../src/index';
import { registerUserByMail } from '../../src/middleware/engine';
import { UserToken } from '../../src/types';
import { ObjectId } from 'mongodb';

const UserModel = require('../../src/models/user');
const TodoListModel = require('../../src/models/todoList');
const UserSettingsModel = require('../../src/models/userSettings');
const EmailLoginModel = require('../../src/models/mailLogin');

interface userData {
  details: {
    name: string;
    email: string;
    password: string;
  }
  user?: any;
  settings?: any;
}

const users: Record<string, userData> = {
  mainUser: {
    details: { name: 'Main user', email: 'main@user.com', password: 'password' }
  },
  sharedUser: {
    details: { name: 'Shared user', email: 'shared@user.com', password: 'password' }
  },
  privateUser: {
    details: { name: 'Private user', email: 'private@user.com', password: 'password' }
  },
  whitelistingUser: {
    details: { name: 'Whitelisting user', email: 'wl@user.com', password: 'password' }
  },
  blacklistingUser: {
    details: { name: 'Blacklisting user', email: 'bl@user.com', password: 'password' }
  },
};

const createdList = 'test list';

const getUser = async(details: any) => {
  return await registerUserByMail(details.name, details.email, details.password);
};

before('Connect to the DB', async () => {
  console.log('droppping database');
  const con = await connect();
  await con.connection.db.dropDatabase();
  users.mainUser.user = await getUser(users.mainUser.details);
  users.sharedUser.user = await getUser(users.sharedUser.details);
  users.privateUser.user = await getUser(users.privateUser.details);
  const privateSettings = await UserSettingsModel.create({
    _id: new ObjectId(users.privateUser.user.user_id),
    privacy: {
      privacy: 'private'
    }
  });
  // console.log('Saved settings: ', privateSettings);
});

after('Disconnect', () => {
  disconnect();
});
describe('Basic shopping list endpoint', () => {

  describe('Creating a new list', () => {
    it('Should fail for missing parameters', (done) => {
      request(app)
        .post('/lists/')
        .set('x-access-token', users.mainUser.user.token)
        .send({})
        .expect(400)
        .end((err) => {
          if (err) return done(err);
          done()
        });
    });

    it('Should fail for unauthorized tokens', (done) => {
      request(app)
        .post('/lists/')
        .set('x-access-token', 'notAnActualToken')
        .send({name: createdList, sharedWith: [users.mainUser.user.user_id.toString()]})
        .expect(401)
        .end((err) => {
          if (err) return done(err);
          done()
        });
    });

    it('Should fail for unsigned request', (done) => {
      request(app)
        .post('/lists/')
        .send({name: createdList, sharedWith: [users.mainUser.user.user_id.toString()]})
        .expect(401)
        .end((err) => {
          if (err) return done(err);
          done()
        });
    });

    it('Should allow to create a new list', (done) => {
      request(app)
        .post('/lists/')
        .set('x-access-token', users.mainUser.user.token)
        .send({name: createdList, sharedWith: [users.mainUser.user.user_id.toString()]})
        .set('Accept', 'application/json')
        .expect(200)
        .expect((res) => {
          console.log('saved list: ', res.body);
          expect(res.body).to.have.deep.property('_id');
          expect(res.body).to.have.deep.property('name', createdList);
        })
        .end(done);
    });
    it('Should save the created list', async() => {
      const list = await TodoListModel.findOne({name: createdList}).populate('shared');
      expect(list).to.exist;
      expect(list).to.have.deep.property('_id');
      expect(list).to.have.deep.property('name', createdList);
      expect(list).to.have.deep.property('shared')
    });
  });

  describe('Updating a list', () => {
    it('Should update a list', () => {});
  });

  describe('Finishing a list', () => {
    it('Should finish a list', () => {});

    it('Should create a finished list element', () => {});

    it('Should create a new list with the remaining elements', () => {})
  });

  describe('Sharing and inviting', () => {
    it('Should invite users by email', () => {});

    // it('Should invite users by username', () => {});

    it('Should invite users by User', () => {});

    it('Should create a notification for public users', () => {});

    it('Should be declined by private users', (done) => {
      // request(app)
      //   .post()
      done();
    });

    it('Should be declined by blacklisting users', () => {});

    it('Should de accepted by whitelisting users', () => {});

    it('Should send an email for non-existing email users', () => {});
  });

  describe('Dealing with items', () => {
    describe('Adding items', () => {});

    describe('Updating items', () => {});
  });

  // it('Should create a new list', (done) => {
  //   request(app)
  //     .post('/lists/')
  //     .set('x-access-token', signedUser.token)
  //     .send({name: createdList, sharedWith: [signedUser.user_id.toString()]})
  //     .set('Accept', 'application/json')
  //     .expect(200)
  //     .expect((res) => {
  //       console.log('saved list: ', res.body);
  //     })
  //     .end(done);
  // });

});
