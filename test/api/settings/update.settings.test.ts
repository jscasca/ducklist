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
import { getUserFromToken } from '../../util';
import { updateSettingsList } from '../../../src/middleware/settings';
import { ObjectId } from 'mongodb';

interface registeredUser {
  token: string;
  refreshToken: string;
  user_id: ObjectId | undefined;
  name: string;
  icon: string;
}

let userAlice: { token: any; user_id: any; name?: string; icon?: string; refreshToken?: any; };
let userBob: { user_id: any; name?: string; icon?: string; token?: any; refreshToken?: any; };

const updateSettings = (user: any, list: string, updates: any) => pipe(
  updateSettingsList(getUserFromToken(user.token), list, updates),
  TE.getOrElse(() => T.of({}))
)();

const randomMail = (base = 'user'): string => {
  const n = Math.floor(100000 + Math.random() * 900000);
  return base + n + '@mail.com';
};

const makeUser = async (name: string) => {
  return await registerUserByMail(name, randomMail(name), name);
};

before('Connect to the DB', async () => {
  console.log('-- Updating list test')
  console.log('droppping database');
  const con = await connect();
  await con.connection.db.dropDatabase();
  userAlice = await registerUserByMail('Alice', 'alice@test.com', 'alice');
  userBob = await registerUserByMail('Bob', 'bob@test.com', 'bob');
});

describe('User settings', () => {
    //
  describe('Fail on wrong calls', () => {
    it('Should fail for missing headers', (done) => {
      request(app)
      .get('/settings')
      .send()
      .expect(401)
      .end((err) => {
        if (err) return done(err);
        done();
      })
    });

    it('Should fail for incorrect token', (done) => {
      request(app)
      .get('/settings')
      .set('x-access-token', 'wrong-token')
      .expect(401)
      .end((err) => {
        if (err) return done(err);
        done();
      })
    });
  });

  describe('Update the user privacy settings', () => {
    it('Should change the privacy', async () => {
      userAlice = await registerUserByMail('Alice', randomMail('alice'), 'secret');
      const res = await request(app)
        .put('/settings/privacy/status')
        .expect(200)
        .set('x-access-token', userAlice.token)
        .send({status: 'private'});
      const privateSettings = res.body;
      expect(privateSettings).to.have.deep.property('privacy');
      expect(privateSettings).to.have.nested.property('privacy.privacy', 'private');

      const res2 = await request(app)
      .put('/settings/privacy/status')
      .expect(200)
      .set('x-access-token', userAlice.token)
      .send({status: 'public'});
      const updated = res2.body;
      expect(updated).to.have.deep.property('privacy');
      expect(updated).to.have.nested.property('privacy.privacy', 'public');
    })
  });

  describe('Update the user privacy lists', () => {
    it('Should add target users to Blacklisted lists', async () => {
      userAlice = await makeUser('Alice');
      userBob = await makeUser('Bob');
      const userCharlie = await makeUser('Charlie');
      const res = await request(app)
      .post('/settings/privacy/updates/blacklisted')
      .expect(200)
      .set('x-access-token', userAlice.token)
      .send({updates: { add: [userBob.user_id.toString()], remove: []}});

      const settings = res.body;
      expect(settings).to.have.deep.property('privacy');
      expect(settings).to.have.nested.property('privacy.blacklisted');
      expect(settings.privacy.blacklisted).to.include(userBob.user_id.toString());

      const res2 = await request(app)
      .post('/settings/privacy/updates/blacklisted')
      .expect(200)
      .set('x-access-token', userAlice.token)
      .send({updates: { add: [userCharlie.user_id?.toString()], remove: []}});

      const updated = res2.body;
      expect(updated.privacy.blacklisted).to.include.all.members([userBob.user_id.toString(), userCharlie.user_id?.toString()]);

      const res3 = await request(app)
      .post('/settings/privacy/updates/blacklisted')
      .expect(200)
      .set('x-access-token', userAlice.token)
      .send({updates: { add: [], remove: [userCharlie.user_id?.toString()]}});

      const deleted = res3.body;
      expect(deleted.privacy.blacklisted).to.include(userBob.user_id.toString());
      expect(deleted.privacy.blacklisted).to.not.include(userCharlie.user_id?.toString());
    });
  });

  describe('Get the user settings', () => {

    beforeEach('Add settings', async () => {
      userAlice = await makeUser('Alice');
      userBob = await makeUser('Bob');
      await updateSettings(userAlice, 'blacklisted', {add: [userBob.user_id.toString()], remove:[]});
      //
    });

    it('Should get an empty object for no settings', async () => {
      const res = await request(app)
      .get('/settings')
      .set('x-access-token', userBob.token)
      .expect(200);

      const settings = res.body;

      expect(settings).to.be.deep.equal({});
    });

    it('Should return the settings object', async () => {
      const res = await request(app)
      .get('/settings')
      .set('x-access-token', userAlice.token)
      .expect(200);

      const settings = res.body;

      expect(settings).to.have.deep.property('privacy');
      expect(settings).to.have.nested.property('privacy.blacklisted');
    });
  });

  describe('', () => {});
});