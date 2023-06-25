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
import { addListItem, newList, isEmail, updateListItem, updateListItemStatus } from '../../../src/middleware/lists';
import { FinishedListItem, FinishedShoppingList, ShoppingList, ShoppingListItem, UserToken, TodoList, TodoListItem } from '../../../src/types';
import { ObjectId } from 'mongodb';

import { getUserFromToken } from '../../authUtil';

const TodoListModel = require('../../../src/models/todoList');
const TodoListItemModel = require('../../../src/models/todoListItem');
const FinishedListModel = require('../../../src/models/finishedTodoList');
const UserNotificationModel = require('../../../src/models/userNotification');
const ListInviteModel = require('../../../src/models/listInvite');

let userAlice: { token: any; user_id: any; name?: string; icon?: string; refreshToken?: any; };
let userBob: { user_id: any; name?: string; icon?: string; token?: any; refreshToken?: any; };
let userCharlie: { token: any; user_id?: any | undefined; name?: string; icon?: string; refreshToken?: any; };

let privateUser: any;

let listA: TodoList;
let uncheckedItem1: TodoListItem;
let uncheckedItem2: TodoListItem;
let uncheckedItem3: TodoListItem;
let checkedItem1: TodoListItem;
let checkedItem2: TodoListItem;
let deletedItem1: TodoListItem;

const invitedByMail = "invitedWithOutAccount@test.com";

const EMPTY_LIST: TodoList = {
  name: '',
  shared: [],
  invited: [],
  details: {}
}

const EMPTY_ITEM: TodoListItem = {
  name: '',
  list_id: '',
  status: 'pending',
  details: {}
};

const newListFn = (alice: any, bob: any) => pipe(
  newList(getUserFromToken(alice.token), 'list a', [alice.user_id, bob.user_id]),
  TE.getOrElse(() => T.of(EMPTY_LIST))
)();

const newItemFn = (user: any, list: TodoList, item: any) => pipe(
  addListItem(getUserFromToken(user.token), list._id?.toString() as string, item),
  TE.getOrElse(() => T.of(EMPTY_ITEM))
)();

const updateItemFn = (user: any, item:TodoListItem, status: string) => pipe(
  updateListItemStatus(getUserFromToken(user.token), item._id?.toString() as string, status),
  TE.getOrElse(() => T.of(EMPTY_ITEM))
)();

before('Connect to the DB', async () => {
  console.log('-- List finish test --')
  console.log('droppping database');
  const con = await connect();
  await con.connection.db.dropDatabase();
  userAlice = await registerUserByMail('Alice', 'alice@test.com', 'alice');
  userBob = await registerUserByMail('Bob', 'bob@test.com', 'bob');
  userCharlie = await registerUserByMail('Charlie', 'charlie@test.com', 'charlie');
  listA = await newListFn(userAlice, userBob);
  // console.log('Saved settings: ', privateSettings);
});

describe('Finishing lists', () => {

  describe('Fail on wrong calls', () => {

    beforeEach('Prepare testing list', async() => {
      listA = await newListFn(userAlice, userBob);
      console.log('preparing list for failing tests: ', listA._id);
    });

    it('Should fail for missing headers', (done) => {
      request(app)
        .post(`/lists/${listA._id}/finish`)
        .send({})
        .expect(401)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong id', (done) => {
      request(app)
        .post(`/lists/wrongid/finish`)
        .set('x-access-token', userAlice.token)
        .expect(400)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong correct id', (done) => {
      request(app)
        .post(`/lists/123456789012/finish`)
        .set('x-access-token', userAlice.token)
        .expect(404)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });

    it('Should fail for wrong owner', (done) => {
      request(app)
        .post(`/lists/${listA._id}/finish`)
        .set('x-access-token', userCharlie.token)
        .send({invited_name: 'ignored@test.com'})
        .expect(403)
        .end((err) => {
          if(err) return done(err);
          done();
        })
    });
  });

  describe('Finishing a list', () => {

    beforeEach('Set the list with items', async() => {
      console.log('creating a new list');
      listA = await newListFn(userAlice, userBob);
      uncheckedItem1 = await newItemFn(userAlice, listA, {name: 'Item1'});
      uncheckedItem2 = await newItemFn(userAlice, listA, {name: 'ItemA'});
      checkedItem1 = await newItemFn(userAlice, listA, {name: 'Item2'});
      checkedItem1 = await updateItemFn(userAlice, checkedItem1, 'checked');
      deletedItem1 = await newItemFn(userAlice, listA, {name: 'Item3'});
      deletedItem1 = await updateItemFn(userAlice, deletedItem1, 'deleted');
    });

    it('Should finish a list', (done) => {
      request(app)
      .post(`/lists/${listA._id}/finish`)
      .set('x-access-token', userAlice.token)
      .send({opts: {}})
      .expect(200)
      .end(async (err, res) => {
        if(err) return done(err);
        //
        // console.log('finished: ', res.body);
        const deletedList = await TodoListModel.findById(listA._id);
        // console.log('deleted list: ', deletedList);
        expect(deletedList).to.not.exist;

        // console.log('look for removed items');

        const removedItems = await TodoListItemModel.find({ list_id: listA._id?.toString()});
        // console.log('removed items: ', removedItems);
        expect(removedItems.length).to.eq(0);

        const finished = await FinishedListModel.findById(res.body.finished.archive);
        // console.log('archive: ', finished);
        expect(finished.items.some((i: any) => uncheckedItem1.name === i.name && i.status === uncheckedItem1.status)).to.be.true;
        expect(finished.items.some((i: any) => checkedItem1.name === i.name && i.status === checkedItem1.status)).to.be.true;
        expect(finished.items.some((i: any) => deletedItem1.name === i.name && i.status === deletedItem1.status)).to.be.true;

        done();
      });
    });

    it('Should finish a list and carry over the unchecked items', (done) => {
      request(app)
      .post(`/lists/${listA._id}/finish`)
      .set('x-access-token', userAlice.token)
      .send({opts: {carryover: true}})
      .expect(200)
      .end(async (err, res) => {
        if(err) done(err);
        //
        const finish = res.body;
        // console.log(finish);
        expect(finish).to.have.deep.property('carryover');
        // console.log('finished: ', res.body);
        const deletedList = await TodoListModel.findById(listA._id);
        // console.log('deleted list: ', deletedList);
        expect(deletedList).to.not.exist;

        const removedItems = await TodoListItemModel.find({ list_id: listA._id});
        // console.log('removed items: ', removedItems);
        expect(removedItems.length).to.eq(0);

        const finished = await FinishedListModel.findById(res.body.finished.archive);
        // console.log('archive: ', finished);
        expect(finished.items.some((i: any) => uncheckedItem1.name === i.name && i.status === uncheckedItem1.status)).to.be.true;
        expect(finished.items.some((i: any) => checkedItem1.name === i.name && i.status === checkedItem1.status)).to.be.true;
        expect(finished.items.some((i: any) => deletedItem1.name === i.name && i.status === deletedItem1.status)).to.be.true;


        const carryover = await TodoListModel.findById(new ObjectId(finish.carryover.list));
        expect(carryover).to.have.deep.property('name');
        const carryOverItems = await TodoListItemModel.find({ list_id: carryover._id});
        expect(carryOverItems.length).to.be.eq(2);

        done();
      });
    });
  
    // it('Should finish a shared list', async() => {});
    // it('Should finish a shared list and create a remaining one', async() => {
    //   const req = await request(app)
    //     .post(`/lists/${listA._id}/finish`)
    //     .set('x-access-token', userAlice.token)
    //     .send({opts: {pending: true}});
    //   console.log('finished request');
    //   const finishedId = req.body._id;

    //   const list = await ShoppingListModel.findById(listA._id?.toString());
    //   expect(list).to.not.exist;

    //   const item1 = await ShoppingListItemModel.findById(uncheckedItem1._id);
    //   expect(item1).to.exist;

    //   const newList = await ShoppingListModel.findById(item1.list_id);
    //   expect(newList).to.exist;
    //   const newListItems: ShoppingListItem[] = await ShoppingListItemModel.find({list_id: newList._id});
    //   expect(newListItems.length).to.eq(3);
    //   newListItems.forEach(i => {
    //     expect(i.status === 'pending');
    //   });
    //   expect(newList.name).to.eq('List A (2)');

    //   const finished: FinishedShoppingList = await FinishedListModel.findById(finishedId);
    //   expect(finished).to.exist;
    //   console.log('finished: ', finished);

    //   listA.shared.forEach(s => expect(finished.users.some(u => s.toString() === u.toString())).to.be.true);

    // });

    // it('Should finish a shared list and name the remaining one properly', async() => {
    //   await ShoppingListModel.findByIdAndUpdate(listA._id, {$set: {name: 'List A (99)'}});
    //   const req = await request(app)
    //     .post(`/lists/${listA._id}/finish`)
    //     .set('x-access-token', userAlice.token)
    //     .send({opts: {pending: true}});
    //   console.log('finished request');
    //   const finishedId = req.body._id;

    //   const list = await ShoppingListModel.findById(listA._id?.toString());
    //   expect(list).to.not.exist;

    //   const item1 = await ShoppingListItemModel.findById(uncheckedItem1._id);
    //   expect(item1).to.exist;

    //   const newList = await ShoppingListModel.findById(item1.list_id);
    //   expect(newList).to.exist;
    //   const newListItems: ShoppingListItem[] = await ShoppingListItemModel.find({list_id: newList._id});
    //   expect(newListItems.length).to.eq(3);
    //   newListItems.forEach(i => {
    //     expect(i.status === 'pending');
    //   });
    //   expect(newList.name).to.eq('List A (100)');

    //   const finished: FinishedShoppingList = await FinishedListModel.findById(finishedId);
    //   expect(finished).to.exist;
    //   console.log('finished: ', finished);

    //   listA.shared.forEach(s => expect(finished.users.some(u => s.toString() === u.toString())).to.be.true);
    // });

    // TBD: Other options for finishing lists

  });

});

after('Disconnect', () => {
  disconnect();
});
