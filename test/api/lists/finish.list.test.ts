import request from 'supertest';
import { expect } from 'chai';
import { connect, disconnect } from '../../../src/db/database';
import dotenv from 'dotenv';
dotenv.config();

import app from '../../../src/index';
import { registerUserByMail } from '../../../src/middleware/engine';
import { addListItem, newList, isEmail, updateListItem, updateListItemStatus } from '../../../src/middleware/lists';
import { FinishedListItem, FinishedShoppingList, ShoppingList, ShoppingListItem, UserToken } from '../../../src/types';
import { ObjectId } from 'mongodb';

import { getUserFromToken } from '../../authUtil';
import { doesNotMatch, fail } from 'assert';
import { send } from 'process';

//const ShoppingListModel = require('../models/shoppingList');
const ShoppingListModel = require('../../../src/models/shoppingList');
const ShoppingListItemModel = require('../../../src/models/shoppingListItem');
const FinishedListModel = require('../../../src/models/finishedShoppingList');
const UserNotificationModel = require('../../../src/models/userNotification');
const ListInviteModel = require('../../../src/models/listInvite');

let userAlice: { token: any; user_id: any; name?: string; icon?: string; refreshToken?: any; };
let userBob: { user_id: any; name?: string; icon?: string; token?: any; refreshToken?: any; };
let userCharlie: { token: any; user_id?: any | undefined; name?: string; icon?: string; refreshToken?: any; };

let privateUser: any;

let listA: ShoppingList;
let uncheckedItem1: ShoppingListItem;
let uncheckedItem2: ShoppingListItem;
let uncheckedItem3: ShoppingListItem;
let checkedItem1: ShoppingListItem;
let checkedItem2: ShoppingListItem;
let deletedItem1: ShoppingListItem;

const invitedByMail = "invitedWithOutAccount@test.com";

before('Connect to the DB', async () => {
  console.log('-- List finish test --')
  console.log('droppping database');
  const con = await connect();
  await con.connection.db.dropDatabase();
  userAlice = await registerUserByMail('Alice', 'alice@test.com', 'alice');
  userBob = await registerUserByMail('Bob', 'bob@test.com', 'bob');
  userCharlie = await registerUserByMail('Charlie', 'charlie@test.com', 'charlie');
  // console.log('Saved settings: ', privateSettings);
});

describe('Finishing lists', () => {

  describe('Fail on wrong calls', () => {

    beforeEach('Prepare testing list', async() => {
      console.log('preparing list for failing tests');
      listA = await newList(getUserFromToken(userAlice.token), 'list a', [userAlice.user_id as string]);
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
      listA = await newList(getUserFromToken(userAlice.token), 'List A', [userAlice.user_id.toString(), userBob.user_id.toString()]);
      console.log('created: ', listA._id);
      uncheckedItem1 = await addListItem(getUserFromToken(userAlice.token), listA._id?.toString() as string, {name: 'test', notes: 'notes'});
      uncheckedItem2 = await addListItem(getUserFromToken(userAlice.token), listA._id?.toString() as string, {name: 'test 2', notes: {qty: 2, description: 'description'}});
      uncheckedItem3 = await addListItem(getUserFromToken(userAlice.token), listA._id?.toString() as string, {name: 'test 3', notes: {category: 'x', status: 'checked'}});
      // check an item
      checkedItem1 = await addListItem(getUserFromToken(userAlice.token), listA._id?.toString() as string, {name: 'test 4', notes: {}});
      checkedItem1.status = 'checked';
      await updateListItemStatus(userAlice.token, checkedItem1._id?.toString() as string, 'checked');
      // delte an item
      deletedItem1 = await addListItem(getUserFromToken(userAlice.token), listA._id?.toString() as string, {name: 'test 4', notes: {}});
      deletedItem1.status = 'checked';
      await updateListItemStatus(userAlice.token, deletedItem1._id?.toString() as string, 'deleted');

      // const items = await ShoppingListItemModel.find({});
      // console.log('prepared itesm: ', items);
    });

    it('Should finish a list', async() => {
      const req = await request(app)
        .post(`/lists/${listA._id}/finish`)
        .set('x-access-token', userAlice.token);
      console.log('finished request');
      const finishedId = req.body._id;

      const list = await ShoppingListModel.findById(listA._id?.toString());
      expect(list).to.not.exist;
      const item1 = await ShoppingListItemModel.findById(uncheckedItem1._id);
      expect(item1).to.not.exist;

      const finished: FinishedShoppingList = await FinishedListModel.findById(finishedId);
      expect(finished).to.exist;
      console.log('finished: ', finished);

      listA.shared.forEach(s => expect(finished.users.some(u => s.toString() === u.toString())).to.be.true);
    });
  
    // it('Should finish a shared list', async() => {});
    it('Should finish a shared list and create a remaining one', async() => {
      const req = await request(app)
        .post(`/lists/${listA._id}/finish`)
        .set('x-access-token', userAlice.token)
        .send({opts: {pending: true}});
      console.log('finished request');
      const finishedId = req.body._id;

      const list = await ShoppingListModel.findById(listA._id?.toString());
      expect(list).to.not.exist;

      const item1 = await ShoppingListItemModel.findById(uncheckedItem1._id);
      expect(item1).to.exist;

      const newList = await ShoppingListModel.findById(item1.list_id);
      expect(newList).to.exist;
      const newListItems: ShoppingListItem[] = await ShoppingListItemModel.find({list_id: newList._id});
      expect(newListItems.length).to.eq(3);
      newListItems.forEach(i => {
        expect(i.status === 'pending');
      });
      expect(newList.name).to.eq('List A (2)');

      const finished: FinishedShoppingList = await FinishedListModel.findById(finishedId);
      expect(finished).to.exist;
      console.log('finished: ', finished);

      listA.shared.forEach(s => expect(finished.users.some(u => s.toString() === u.toString())).to.be.true);

    });

    it('Should finish a shared list and name the remaining one properly', async() => {
      await ShoppingListModel.findByIdAndUpdate(listA._id, {$set: {name: 'List A (99)'}});
      const req = await request(app)
        .post(`/lists/${listA._id}/finish`)
        .set('x-access-token', userAlice.token)
        .send({opts: {pending: true}});
      console.log('finished request');
      const finishedId = req.body._id;

      const list = await ShoppingListModel.findById(listA._id?.toString());
      expect(list).to.not.exist;

      const item1 = await ShoppingListItemModel.findById(uncheckedItem1._id);
      expect(item1).to.exist;

      const newList = await ShoppingListModel.findById(item1.list_id);
      expect(newList).to.exist;
      const newListItems: ShoppingListItem[] = await ShoppingListItemModel.find({list_id: newList._id});
      expect(newListItems.length).to.eq(3);
      newListItems.forEach(i => {
        expect(i.status === 'pending');
      });
      expect(newList.name).to.eq('List A (100)');

      const finished: FinishedShoppingList = await FinishedListModel.findById(finishedId);
      expect(finished).to.exist;
      console.log('finished: ', finished);

      listA.shared.forEach(s => expect(finished.users.some(u => s.toString() === u.toString())).to.be.true);
    });

    // TBD: Other options for finishing lists

  });

});

after('Disconnect', () => {
  disconnect();
});
