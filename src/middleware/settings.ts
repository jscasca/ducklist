import { HttpError, internalError, validationError } from "../httpError";
import { UserSettings, UserToken } from "../types";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { ObjectId } from "mongodb";

const UserModel = require('../models/user');
const SettingsModel = require('../models/userSettings');

export const getSettings = (user: UserToken): TE.TaskEither<HttpError, UserSettings> => {
  return pipe(
    TE.tryCatch(
      () => SettingsModel.findById(new ObjectId(user.user_id)) as Promise<UserSettings>,
      (reason) => internalError()
    ),
    TE.chain((settings) => settings === null ? TE.right({}) : TE.right(settings))
  );
};

const addToBlacklist = (user: UserToken, userId: string) => {
  const query = {_id: new ObjectId(user.user_id)};
  const updates = { $push: { 'privacy.blacklisted': new ObjectId(userId)}};
  const ops = { upsert: true, new: true };
  return TE.tryCatch(
    () => SettingsModel.findOneAndUpdate(query, updates, ops) as Promise<UserSettings>,
    (reason) => TE.left(internalError())
  );
};

const addUserToList = (user: UserToken, userId: string, list: string): TE.TaskEither<HttpError, UserSettings> => {
  return TE.tryCatch(
    () => SettingsModel.findOneAndUpdate(
      { _id: new ObjectId(user.user_id) },
      { $push: { [list]: new ObjectId(userId) } },
      { upsert: true, new: true }
    ) as Promise<UserSettings>,
    (reason) => internalError()
  );
};

const validateUpdates = (list: string, updates: Record<string, any>): E.Either<HttpError, any> => {
  if (!Array.isArray(updates.add) || !Array.isArray(updates.remove)) {
    return E.left(validationError());
  }
  if (!['blacklisted', 'whitelisted', 'allowed'].includes(list)) {
    return E.left(validationError());
  }
  const listToUpdate = 'privacy.' + list;
  const add = updates.add.filter(u => ObjectId.isValid(u)).map(u => new ObjectId(u));
  const remove = updates.remove.filter(u => ObjectId.isValid(u)).map(u => new ObjectId(u));

  const push = add.length > 0 ? { $push: { [listToUpdate]: { $each: add } } } : {};
  const pull = remove.length > 0 ? { $pullAll: { [listToUpdate]: remove  } } : {};
  return E.right({
    ...push,
    ...pull
  });
};

export const updateSettingsList = (user: UserToken, list: string, updates: Record<string, any>): TE.TaskEither<HttpError, UserSettings> => {
  console.log('updating with: ', list, updates);
  return pipe(
    validateUpdates(list, updates),
    TE.fromEither,
    TE.chain((update) => {
      console.log(update);
      return TE.tryCatch(
      () => SettingsModel.findByIdAndUpdate(user.user_id, update, { upsert: true, new: true}) as Promise<UserSettings>,
      (reason) => {
        console.error(reason);
        return internalError();
      }
    )}
    )
  );
};

const addUserToBlacklist = (user: UserToken, userId: string) => {
  return addUserToList(user, userId, 'privacy.blacklisted');
};

const addUserToWhitelist = (user: UserToken, userId: string) => {
  return addUserToList(user, userId, 'privacy.whitelisted');
};

const addUserToAllowed = (user: UserToken, userId: string) => {
  return addUserToList(user, userId, 'privacy.allowed');
};

const validatePrivacy = (privacy: string): E.Either<HttpError, string> => {
  if (privacy === 'public' || privacy === 'private') {
    return E.right(privacy);
  }
  return E.left(validationError());
};

export const setPrivacy = (user: UserToken, privacy: string) => {
  console.log('settings privacy: ', privacy);
  return pipe(
    validatePrivacy(privacy),
    TE.fromEither,
    TE.chain(privacyString =>
      TE.tryCatch(
        () => SettingsModel.findOneAndUpdate(
          { _id: new ObjectId(user.user_id) },
          { $set: { 'privacy.privacy': privacyString} },
          { upsert: true, new: true }
        ) as Promise<UserSettings>,
        (reason) => internalError()
      )
    )
  );
}

export const updateSettings = () => {};