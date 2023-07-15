import request from 'supertest';
import { expect } from 'chai';
import { connect, disconnect } from '../../../src/db/database';
import dotenv from 'dotenv';
dotenv.config();

import app from '../../../src/index';
import { registerUserByMail } from '../../../src/middleware/engine';
import { addListItem, newList, isEmail } from '../../../src/middleware/lists';
import { ShoppingList, ShoppingListItem, UserToken } from '../../../src/types';
import { ObjectId } from 'mongodb';

import { getUserFromToken } from '../../util';
import { doesNotMatch, fail } from 'assert';
import { send } from 'process';

//const ShoppingListModel = require('../models/shoppingList');
const ShoppingListModel = require('../../../src/models/shoppingList');
const ShoppingListItemModel = require('../../../src/models/shoppingListItem');
const UserNotificationModel = require('../../../src/models/userNotification');
const ListInviteModel = require('../../../src/models/listInvite');

let userAlice: { token: any; user_id: any; name?: string; icon?: string; refreshToken?: any; };
let userBob: { user_id: any; name?: string; icon?: string; token?: any; refreshToken?: any; };
let userCharlie: { token: any; user_id?: any | undefined; name?: string; icon?: string; refreshToken?: any; };

let privateUser: any;

let listA: ShoppingList;

const invitedByMail = "invitedWithOutAccount@test.com";

before('Connect to the DB', async () => {
  console.log('droppping database');
  const con = await connect();
  await con.connection.db.dropDatabase();
  console.log('dropped');
  userAlice = await registerUserByMail('Alice', 'alice@test.com', 'alice');
  userBob = await registerUserByMail('Bob', 'bob@test.com', 'bob');
  userCharlie = await registerUserByMail('Charlie', 'charlie@test.com', 'charlie');
  listA = await newList(getUserFromToken(userAlice.token), 'list a', [userAlice.user_id as string]);
  privateUser = await registerUserByMail('Private', 'private@test.com', 'private');

  console.log('created list: ', listA);
  // console.log('Saved settings: ', privateSettings);
});

describe('Sharing lists', () => {

  describe('Fail on wrong calls', () => {
    it('Should fail for missing headers', (done) => {
      request(app)
        .post(`/lists/${listA._id}/invite`)
        .send({})
        .expect(401)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for missing parameters', (done) => {
      request(app)
        .post(`/lists/${listA._id}/invite`)
        .set('x-access-token', userAlice.token)
        .send({invited_x: '', invited_y: ''})
        .expect(400)
        .end((err) => {
          if(err) return done(err);
          done();
        });
    });

    it('Should fail for wrong id', (done) => {
      request(app)
        .post(`/lists/wrongid/invite`)
        .set('x-access-token', userAlice.token)
        .send({invited_name: 'ignored@test.com'})
        .expect(404)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong owner', (done) => {
      request(app)
        .post(`/lists/${listA._id}/invite`)
        .set('x-access-token', userCharlie.token)
        .send({invited_name: 'ignored@test.com'})
        .expect(403)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });
  });

  // Email sending TBD
  // describe('Invite new users by email', () => {
  //   it('Should return a new list with the invited name', (done) => {
      
  //     request(app)
  //       .post(`/lists/${listA._id}/invite`)
  //       .set('x-access-token', userAlice.token)
  //       .send({invited_id: '', invited_name: 'newmail@test.com'})
  //       .expect(200)
  //       .end((_, res) => {
  //         //
  //         expect(res.body).to.have.deep.property('shared');
  //         expect(res.body).to.have.deep.property('invited');
  //         expect(res.body.invited).to.contain('newmail@test.com');
  //       })
  //   });

  //   it('Should create a notification for the invited user', (done) => {
  //     //
  //   });
  // });

  describe('Identify emails', () => {
    it('Should be false for incorrect mails', () => {
      [
        'sinmplestring',
        'notamail.com',
        '@actualemail@dot.com',
        'email.com@'
      ].forEach(mail => expect(isEmail(mail), `For [${mail}] to fail`).to.be.false);
    });

    it('Should be true correct mails', () => {
      [
        'alice@test.com',
        'alice.test@example.com',
        'some+guy@custom.domain.au',
        'xx_cool_guy_xx@my.domain.com',
        'basic123@my.server.com'
      ].forEach(mail => expect(isEmail(mail), `For [${mail}] to pass`).to.be.true);
    });
  });

  describe('Invite existing users by email', () => {
    it('Should return a new list with the invited user', (done) => {
      request(app)
      .post(`/lists/${listA._id}/invite`)
      .set('x-access-token', userAlice.token)
      .send({invited_id: '', invited_name: 'bob@test.com'})
      .expect(200)
      .end((_, res) => {
        expect(res.body).to.have.deep.property('_id', listA._id?.toString());
        expect(res.body).to.have.deep.property('shared');
        expect(res.body).to.have.deep.property('invited');
        expect(res.body.invited.some((i: any) => i._id === userBob.user_id.toString())).to.be.true;
        done();
      });
    });

    it('Should create a notification for the user', async() => {
      //
      const notification = await UserNotificationModel.findOne({user_id: userBob.user_id});
      expect(notification).to.exist;
      expect(notification).to.have.deep.property('notification');
    });

    it('Should create a list invite', async() => {
      const invite = await ListInviteModel.findOne({list_id: listA._id, invited_id: userBob.user_id});
      expect(invite).to.exist;
      expect(invite).to.have.deep.property('list_id', listA._id);
      expect(invite).to.have.deep.property('inviting_id');
      expect(invite.inviting_id.toString()).to.eq(userAlice.user_id.toString());
      expect(invite).to.have.deep.property('invited_id');
      expect(invite.invited_id.toString()).to.eq(userBob.user_id.toString());
    });
  });

  describe('Invite existing users by user_id', () => {
    it('Should return a new list with the invited user when issued the user id', (done) => {
      request(app)
      .post(`/lists/${listA._id}/invite`)
      .set('x-access-token', userAlice.token)
      .send({invited_id: userCharlie.user_id.toString(), invited_name: userCharlie.name})
      .expect(200)
      .end((_, res) => {
        console.log(res.body);
        expect(res.body).to.have.deep.property('_id', listA._id?.toString());
        expect(res.body).to.have.deep.property('shared');
        expect(res.body).to.have.deep.property('invited');
        expect(res.body.invited.some((i: any) => i._id === userBob.user_id.toString())).to.be.true;
        expect(res.body.invited.some((i: any) => i._id === userCharlie.user_id.toString())).to.be.true;
        done();
      });
    });

    it('Should create a notification for the user', async() => {
      //
      const notification = await UserNotificationModel.findOne({user_id: userCharlie.user_id});
      expect(notification).to.exist;
      expect(notification).to.have.deep.property('notification');
    });

    it('Should create a list invite', async() => {
      const invite = await ListInviteModel.findOne({list_id: listA._id, invited_id: userCharlie.user_id});
      expect(invite).to.exist;
      expect(invite).to.have.deep.property('list_id', listA._id);
      expect(invite).to.have.deep.property('inviting_id');
      expect(invite.inviting_id.toString()).to.eq(userAlice.user_id.toString());
      expect(invite).to.have.deep.property('invited_id');
      expect(invite.invited_id.toString()).to.eq(userCharlie.user_id.toString());
    });
  });

  describe('Accept invitation', () => {});

  describe('Deny invitation', () => {});

  // TBD: usernames are not ready yet
  describe('Invite existing users by username', () => {});

  // TBD: settings are not ready yet
  describe('Invite private users', () => {});

  describe('Invite public users with whitelist', () => {});

  describe('Invite public users with blacklist', () => {});

  describe('Invite public users', () => {});

});

after('Disconnect', () => {
  disconnect();
});
