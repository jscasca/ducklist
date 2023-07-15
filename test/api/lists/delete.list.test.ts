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
import { addListItem, newList } from '../../../src/middleware/lists';
import { TodoList, TodoListItem, UserToken } from '../../../src/types';
import { ObjectId } from 'mongodb';

import { getUserFromToken } from '../../util';

const TodoListModel = require('../../../src/models/todoList');
const TodoListItemModel = require('../../../src/models/todoListItem');


let userAlice: { token: any; user_id: any; name?: string; icon?: string; refreshToken?: any; };
let userBob: { user_id: any; name?: string; icon?: string; token?: any; refreshToken?: any; };
let userCharlie: { token: any; user_id?: any | undefined; name?: string; icon?: string; refreshToken?: any; };

let listA: TodoList;
let itemA: TodoListItem;

const EMPTY_LIST: TodoList = {
  name: '',
  shared: [],
  invited: [],
  details: {}
}

const EMPTY_ITEM: TodoListItem = {
  list_id: '',
  name: '',
  status: 'unknown',
  details: {},
  notes: {}
}

const newListFn = (alice: any, users: any[]) => pipe(
  newList(getUserFromToken(alice.token), 'list a', users.map(u => u.user_id)),
  TE.getOrElse(() => T.of(EMPTY_LIST))
)();

const addItemFn = (user: any, list: TodoList, item: any) => pipe(
  addListItem(getUserFromToken(user.token), list._id?.toString() as string, item),
  TE.getOrElse(() => T.of(EMPTY_ITEM))
)();

before('Connect to the DB', async () => {
  const con = await connect();
  await con.connection.db.dropDatabase();
  userAlice = await registerUserByMail('Alice', 'alice@test.com', 'alice');
  userBob = await registerUserByMail('Bob', 'bob@test.com', 'bob');
  userCharlie = await registerUserByMail('Charlie', 'charlie@test.com', 'charlie');
  listA = await newListFn(userAlice, [userAlice, userBob]);
  itemA = await addItemFn(userAlice, listA, {name: 'test', notes: 'notes'});
});

describe('Deleting lists', () => {

  describe('Fail on wrong calls', () => {
    it('Should fail for missing headers', (done) => {
      request(app)
        .delete(`/lists/${listA._id}`)
        .expect(401)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong incorrect id', (done) => {
      request(app)
        .delete(`/lists/wrongid`)
        .set('x-access-token', userAlice.token)
        .expect(400)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong correct id', (done) => {
      request(app)
        .delete(`/lists/123456789012`)
        .set('x-access-token', userAlice.token)
        .expect(404)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong owner', (done) => {
      request(app)
        .delete(`/lists/${listA._id}`)
        .set('x-access-token', userCharlie.token)
        .expect(403)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });
  });

  describe('Deleting shared lists', () => {

    //
    beforeEach('Create shared lists', async() => {
      listA = await newListFn(userAlice, [userAlice, userBob]);
      itemA = await addItemFn(userAlice, listA, {name: 'test'});
    });

    it('Should delete a list for a single user (remove user from list)', (done) => {
      const list = TodoListModel.findById(listA._id);
      const req = request(app)
      .delete(`/lists/${listA._id}`)
      .set('x-access-token', userBob.token)
      .expect(200)
      .end(async(err, res) => {
        if(err) return done(err);

        const removedFrom = await TodoListModel.findById(listA._id);
        expect(removedFrom.shared.some((u: any) => u._id.equals(userBob.user_id))).to.be.false;
        expect(removedFrom.shared.some((u: any) => u._id.equals(userAlice.user_id))).to.be.true;

        const listItem = await TodoListItemModel.findById(itemA._id);
        expect(listItem).to.be.not.null;

        done();
      });
    });

    it('Should delete a list for multiple user when `force` is on', (done) => {
      const req = request(app)
      .delete(`/lists/${listA._id}`)
      .set('x-access-token', userAlice.token)
      .send({force: true})
      .expect(200)
      .end(async(err, res) => {
        if (err) done(err);

        const deleted = await TodoListModel.findById(listA._id);
        expect(deleted).to.be.null;

        const listItem = await TodoListItemModel.findById(itemA._id);
        expect(listItem).to.be.null;
        done();
      });
    });

  });

  describe('Deleting for single users', () => {

    beforeEach('Prep single user list', async () => {
      listA = await newListFn(userAlice, [userAlice]);
      itemA = await addItemFn(userAlice, listA, {name: 'test'});
    });

    it('Should delete a list for a single user and delete the list', (done) => {
      const list = TodoListModel.findById(listA._id);
      const req = request(app)
      .delete(`/lists/${listA._id}`)
      .set('x-access-token', userAlice.token)
      .expect(200)
      .end(async(err, res) => {
        if(err) return done(err);

        const deleted = await TodoListModel.findById(listA._id);
        expect(deleted).to.be.null;

        const listItem = await TodoListItemModel.findById(itemA._id);
        expect(listItem).to.be.null;

        done();
      });
    });

  });

});

after('Disconnect', () => {
  disconnect();
});
