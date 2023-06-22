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
import { ShoppingList, ShoppingListItem, TodoList, UserToken } from '../../../src/types';
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
let basicItem: any;

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
  console.log('-- List items test --');
  console.log('droppping database');
  const con = await connect();
  console.log('connected to DB');
  await con.connection.db.dropDatabase();
  console.log('dropped');
  userAlice = await registerUserByMail('Alice', 'alice@test.com', 'alice');
  userBob = await registerUserByMail('Bob', 'bob@test.com', 'bob');
  userCharlie = await registerUserByMail('Charlie', 'charlie@test.com', 'charlie');
  console.log('registered users');
  listA = await newListFn(userAlice, userBob);
  console.log('created list');
  privateUser = await registerUserByMail('Private', 'private@test.com', 'private');
  console.log('added user')
  basicItem = await addListItem(getUserFromToken(userAlice.token), listA._id?.toString() as string, {name: 'test'});

  console.log('created list: ', listA);
  // console.log('Saved settings: ', privateSettings);
});

describe('Items', () => {

  describe('Adding items', () => {
    
  });

  describe('Fail on wrong calls', () => {
    it('Should fail for missing headers', (done) => {
      request(app)
        .post(`/lists/items/${basicItem._id}`)
        .send({})
        .expect(401)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for missing parameters', (done) => {
      request(app)
        .post(`/lists/items/${basicItem._id}`)
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
        .post(`/lists/items/wrongid`)
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
        .post(`/lists/items/${basicItem._id}`)
        .set('x-access-token', userCharlie.token)
        .send({name: 'Updated name', sharedWith: [userAlice.user_id as string, userBob.user_id as string]})
        .expect(403)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });
  });

  describe('Update item name', () => {
    it('Should return a new list with the updated name', (done) => {
      request(app)
      .post(`/lists/${listA._id}`)
      .set('x-access-token', userAlice.token)
      .send({name: 'list b', sharedWith: [userAlice.user_id as string, userBob.user_id as string]})
      .expect(200)
      .end((_, res) => {
        expect(res.body).to.have.deep.property('_id', listA._id?.toString());
        expect(res.body).to.have.deep.property('name');
        // expect(res.body).to.have.deep.property('invited');
        // expect(res.body.invited.some((i: any) => i._id === userBob.user_id.toString())).to.be.true;
        done();
      });
    });

  });

  describe('Update item status', () => {
    let itemId = '';
    it('Should insert a new item', (done) => {
      // update item id
      request(app)
      .post(`/lists/${listA._id}/items`)
      .set('x-access-token', userAlice.token)
      .send({name: '', details: {}})
      .expect(200)
      .end((_, res) => {
        // save the item id
      });
    });

    it('Should return item with updated status and timestamp', (done) => {
      request(app)
      .post(`/lists/${listA._id}`)
      .set('x-access-token', userAlice.token)
      .send({name: 'list b', sharedWith: [userAlice.user_id as string, userBob.user_id as string]})
      .expect(200)
      .end((_, res) => {
        expect(res.body).to.have.deep.property('_id', listA._id?.toString());
        expect(res.body).to.have.deep.property('name');
        // expect(res.body).to.have.deep.property('invited');
        // expect(res.body.invited.some((i: any) => i._id === userBob.user_id.toString())).to.be.true;
        done();
      });
    });

  });

  describe('Update item attributes', () => {

    it('Should update a single attribute of the item', () => {
      request(app)
      .post(`list`)
    });
  });

});

after('Disconnect', () => {
  disconnect();
});
