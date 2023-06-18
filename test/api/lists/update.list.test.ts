import request from 'supertest';
import { expect } from 'chai';
import { connect, disconnect } from '../../../src/db/database';
import dotenv from 'dotenv';
dotenv.config();

import app from '../../../src/index';
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { registerUserByMail } from '../../../src/middleware/engine';
import { addListItem, newList, isEmail } from '../../../src/middleware/lists';
import { ShoppingList, ShoppingListItem, UserToken, TodoList } from '../../../src/types';
import { ObjectId } from 'mongodb';

import { getUserFromToken } from '../../authUtil';
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

let listA: TodoList;

const invitedByMail = "invitedWithOutAccount@test.com";

const EMPTY_LIST: TodoList = {
  name: '',
  shared: [],
  invited: [],
  details: {}
}

const newListFn = (alice: any, bob: any) => pipe(
  newList(getUserFromToken(alice.token), 'list a', [alice.user_id, bob.user_id]),
  TE.getOrElse(() => T.of(EMPTY_LIST))
)();

before('Connect to the DB', async () => {
  console.log('-- Updating list test')
  console.log('droppping database');
  const con = await connect();
  await con.connection.db.dropDatabase();
  userAlice = await registerUserByMail('Alice', 'alice@test.com', 'alice');
  userBob = await registerUserByMail('Bob', 'bob@test.com', 'bob');
  userCharlie = await registerUserByMail('Charlie', 'charlie@test.com', 'charlie');
  privateUser = await registerUserByMail('Private', 'private@test.com', 'private');

  listA = await newListFn(userAlice, userBob);

  console.log('created list: ', listA);
  // console.log('Saved settings: ', privateSettings);
});

describe('Updating lists', () => {

  describe('Fail on wrong calls', () => {
    it('Should fail for missing headers', (done) => {
      request(app)
        .post(`/lists/${listA._id}`)
        .send({})
        .expect(401)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for missing parameters', (done) => {
      request(app)
        .post(`/lists/${listA._id}`)
        .set('x-access-token', userAlice.token)
        .send({name: '', sharedWith: []})
        .expect(400)
        .end((err) => {
          if(err) return done(err);
          done();
        });
    });

    it('Should fail for wrong id', (done) => {
      request(app)
        .post(`/lists/wrongid`)
        .set('x-access-token', userAlice.token)
        .send({updates: {}})
        .expect(404)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong owner', (done) => {
      request(app)
        .post(`/lists/${listA._id}`)
        .set('x-access-token', userCharlie.token)
        .send({updates: {}})
        .expect(403)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });
  });

  describe('Update name properly', () => {
    it('Should return a new list with the updated name', (done) => {
      request(app)
      .post(`/lists/${listA._id}`)
      .set('x-access-token', userAlice.token)
      .send({updates: {name: 'Updated'}})
      .expect(200)
      .end((_, res) => {
        expect(res.body).to.have.deep.property('_id', listA._id?.toString());
        expect(res.body).to.have.deep.property('name', 'Updated');
        // expect(res.body).to.have.deep.property('invited');
        // expect(res.body.invited.some((i: any) => i._id === userBob.user_id.toString())).to.be.true;
        done();
      });
    });

  });

});

after('Disconnect', () => {
  disconnect();
});
