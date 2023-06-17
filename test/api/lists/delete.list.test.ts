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

import { getUserFromToken } from '../../authUtil';
import { doesNotMatch, fail } from 'assert';

//const ShoppingListModel = require('../models/shoppingList');
const ShoppingListModel = require('../../../src/models/shoppingList');
const ShoppingListItemModel = require('../../../src/models/shoppingListItem');


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

const newListFn = (alice: any, bob: any) => pipe(
  newList(getUserFromToken(alice.token), 'list a', [alice.user_id, bob.user_id]),
  TE.getOrElse(() => T.of(EMPTY_LIST))
)();

const addItemFn = (user: any, listId: string, item: any) => pipe(
  addListItem(user.token, listId, item),
  TE.getOrElse(() => T.of(EMPTY_ITEM))
)();

before('Connect to the DB', async () => {
  console.log('-- List delete test --');
  console.log('droppping database');
  const con = await connect();
  await con.connection.db.dropDatabase();
  userAlice = await registerUserByMail('Alice', 'alice@test.com', 'alice');
  userBob = await registerUserByMail('Bob', 'bob@test.com', 'bob');
  userCharlie = await registerUserByMail('Charlie', 'charlie@test.com', 'charlie');
  listA = await newListFn(userAlice, userBob);
  console.log('created list: ', listA);
  itemA = await addItemFn(getUserFromToken(userAlice.token), listA._id?.toString() as string, {name: 'test', notes: 'notes'});
  // console.log('Saved settings: ', privateSettings);
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

    it('Should fail for wrong id', (done) => {
      request(app)
        .delete(`/lists/wrongid`)
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

  describe('Check elements to be deleted', () => {
    it('Should ensure list exist', async() => {
      const list = await ShoppingListModel.findOne({name: listA.name });
      console.log('check list exists: ', list.toObject());
      expect(list).to.exist;
    });

    it('Should ensure the item exist', async() => {
      const item = await ShoppingListItemModel.findById(itemA._id?.toString());
      console.log('check item exists: ', item);
      expect(item).to.exist;
    });
  });

  describe('Remove list for users', () => {
    describe('Remove user from list', () => {
      it('Should return the removed list', (done) => {
        request(app)
          .delete(`/lists/${listA._id}`)
          .set('x-access-token', userAlice.token)
          .expect(200)
          .expect((res) => {
            expect(res.body).to.have.deep.property('_id', listA._id?.toString());
            expect(res.body).to.have.deep.property('shared');
            expect(res.body.shared).to.not.include(userAlice.user_id.toString());
          })
          .end(done);
      });

      it('Should remove user from shared in DB', async () => {
        const list = await ShoppingListModel.findById(listA._id?.toString());
        expect(list).to.exist;
        expect(list._id.toString()).to.eq(listA._id?.toString());
        expect(list.shared).to.not.include(userAlice.user_id);
        expect(list.shared).to.include(userBob.user_id);
        // check for array
      });
    });

    describe('Delete list if not shared', () => {
      it('Should remove user from shared in response', (done) => {
        request(app)
          .delete(`/lists/${listA._id}`)
          .set('x-access-token', userBob.token)
          .expect(200)
          .expect((res) => {
            console.log('returned delted list: ', res.body);
            expect(res.body).to.have.deep.property('_id', listA._id?.toString());
            expect(res.body).to.have.deep.property('count', 1);
          })
          .end(done);
      });

      it('Should delete the list', async() => {
        const list = await ShoppingListModel.findOne({_id: listA._id });
        expect(list).to.not.exist;
      });

      it('Should remove the items', async() => {
        const item = await ShoppingListItemModel.findById(itemA._id?.toString());
        expect(item).to.not.exist;
      });

    });
  });

});

after('Disconnect', () => {
  disconnect();
});
