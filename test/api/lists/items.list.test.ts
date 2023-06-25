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
import { ShoppingList, ShoppingListItem, TodoList, TodoListItem, UserToken } from '../../../src/types';
import { ObjectId } from 'mongodb';

import { getUserFromToken } from '../../authUtil';
import { doesNotMatch, fail } from 'assert';
import { send } from 'process';

//const ShoppingListModel = require('../models/shoppingList');
const TodoListModel = require('../../../src/models/todoList');
const ShoppingListItemModel = require('../../../src/models/shoppingListItem');
const UserNotificationModel = require('../../../src/models/userNotification');
const ListInviteModel = require('../../../src/models/listInvite');

let userAlice: { token: any; user_id: any; name?: string; icon?: string; refreshToken?: any; };
let userBob: { user_id: any; name?: string; icon?: string; token?: any; refreshToken?: any; };
let userCharlie: { token: any; user_id?: any | undefined; name?: string; icon?: string; refreshToken?: any; };

let privateUser: any;

let listA: TodoList;
let basicItem: TodoListItem;

const invitedByMail = "invitedWithOutAccount@test.com";

const EMPTY_LIST: TodoList = {
  name: '',
  shared: [],
  invited: [],
  details: {}
}

const EMPTY_ITEM: TodoListItem = {
  name: '',
  details: {},
  status: 'pending',
  list_id: ''
};

const newListFn = (alice: any, bob: any) => pipe(
  newList(getUserFromToken(alice.token), 'list a', [alice.user_id, bob.user_id]),
  TE.getOrElse(() => T.of(EMPTY_LIST))
)();

const newItemFn = (user: any, listId: string,  item: any) => pipe(
  addListItem(getUserFromToken(user.token), listId, item),
  TE.getOrElse(() => T.of(EMPTY_ITEM))
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
  // find list
  // const auxListA = await TodoListModel.findById(listA._id?.toString());
  // console.log('real list: ', auxListA);
  // const auxB = await TodoListModel.findById(new ObjectId('123456789012'));
  // console.log('fake list: ', auxB);
  privateUser = await registerUserByMail('Private', 'private@test.com', 'private');
  console.log('added user')
  basicItem = await newItemFn(userAlice, listA._id?.toString() as string, {name: 'test'});

  console.log('created list: ', listA);
  // console.log('Saved settings: ', privateSettings);
});

describe('Items', () => {

  describe('Fail on wrong calls', () => {
    it('Should fail for missing headers', (done) => {
      request(app)
        .post(`/lists/${listA._id}/items`)
        .send({name: 'item'})
        .expect(401)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for incorrect parameters', (done) => {
      request(app)
        .post(`/lists/${listA._id}/items/`)
        .set('x-access-token', userAlice.token)
        .send({names: ''})
        .expect(400)
        .end((err) => {
          if(err) return done(err);
          done();
        });
    });

    it('Should fail for wrong incorrect id', (done) => {
      request(app)
        .post(`/lists/wrongid/items/`)
        .set('x-access-token', userAlice.token)
        .send({name: 'item'})
        .expect(400)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong correct id', (done) => {
      request(app)
        .post(`/lists/123456789012/items/`)
        .set('x-access-token', userAlice.token)
        .send({name: 'item'})
        .expect(404)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong owner insert new items', (done) => {
      request(app)
        .post(`/lists/${listA._id}/items`)
        .set('x-access-token', userCharlie.token)
        .send({name: 'New name'})
        .expect(403)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong owner updating items', (done) => {
      request(app)
        .put(`/lists/items/${basicItem._id}`)
        .set('x-access-token', userCharlie.token)
        .send({updates: {changes: {}, deletions:{}}})
        .expect(503)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });
  });

  // TODO apply chai-datetime for dates
  describe('Save and update items', () => {
    let itemId = '';
    const initialTime = Date.now();
    const itemName = 'Saved item'
    it('Should insert a new item', (done) => {
      // update item id
      request(app)
      .post(`/lists/${listA._id}/items`)
      .set('x-access-token', userAlice.token)
      .send({name: itemName})
      .expect(200)
      .end((_, res) => {
        const savedItem = res.body;
        expect(savedItem).to.have.deep.property('name', itemName);
        expect(savedItem).to.have.deep.property('status', 'pending');
        expect(savedItem).to.have.deep.property('list_id', `${listA._id}`)
        expect(savedItem).to.have.nested.property('details.created');
        expect(new Date(savedItem.details.created).getTime()).to.be.greaterThan(initialTime);
        // save the item id
        itemId = savedItem._id;
        done();
      });
    });

    it('Should fail for incorrect status', (done) => {
      request(app)
      .put(`/lists/items/${itemId}/status`)
      .set('x-access-token', userAlice.token)
      .send({status: 'unchecked'})
      .expect(400)
      .end((e, res) => {
        if (e) return done(e);
        done();
      });
    });

    it('Should return item with updated status and timestamp', (done) => {
      request(app)
      .put(`/lists/items/${itemId}/status`)
      .set('x-access-token', userAlice.token)
      .send({status: 'checked'})
      .expect(200)
      .end((e, res) => {
        if (e) return done(e);
        const updated = res.body;
        expect(updated).to.have.deep.property('status', 'checked')
        expect(updated).to.have.deep.property('name', itemName);
        done();
      });
    });

    it('Should return item with updated attributes and timestamp', (done) => {
      request(app)
      .put(`/lists/items/${itemId}/attributes`)
      .set('x-access-token', userAlice.token)
      .send({updates: {
        changes: [
          {key: 'name', value: 'Updated'},
          {key: 'notes.description', value: 'Some text'},
          {key: 'notes.qty', value: 5}
        ],
        deletions: []
      }})
      .expect(200)
      .end((_, res) => {
        const updated = res.body;
        expect(updated).to.have.nested.property('notes.description', 'Some text');
        expect(updated).to.have.nested.property('notes.qty', 5);
        expect(updated).to.have.deep.property('name', 'Updated');
        done();
      });
    });

    it('Should return item with updated attributes and timestamp', (done) => {
      request(app)
      .put(`/lists/items/${itemId}/attributes`)
      .set('x-access-token', userAlice.token)
      .send({updates: {
        changes: [],
        deletions: [
          {key: 'notes.description'}
        ]
      }})
      .expect(200)
      .end((_, res) => {
        const updated = res.body;
        expect(updated).to.not.have.nested.property('notes.description');
        expect(updated).to.have.nested.property('notes.qty', 5);
        done();
      });
    });

  });

});

after('Disconnect', () => {
  disconnect();
});
