import { registerUserByMail } from "../src/middleware/engine";
import { addListItem, newList } from "../src/middleware/lists";
import { updateSettingsList } from "../src/middleware/settings";
import { TodoList, TodoListItem, UserToken } from "../src/types";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";

const jwt = require('jsonwebtoken');

const TOKEN_KEY = process.env.TOKEN_KEY || 'token_key';
//const decoded = jwt.verify(token, TOKEN_KEY);

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

export const getUserFromToken = (token: any): UserToken => {
  return jwt.verify(token, TOKEN_KEY) as UserToken;
};

const randomMail = (base = 'user'): string => {
  const n = Math.floor(100000 + Math.random() * 900000);
  return base + n + '@mail.com';
};

export const makeUser = async (name: string) => {
  return await registerUserByMail(name, randomMail(name), name);
};

export const updateSettings = (user: any, list: string, updates: any) => pipe(
  updateSettingsList(getUserFromToken(user.token), list, updates),
  TE.getOrElse(() => T.of({}))
)();

export const newListFn = (alice: any, users: any[]) => pipe(
  newList(getUserFromToken(alice.token), 'list a', users.map(u => u.user_id)),
  TE.getOrElse(() => T.of(EMPTY_LIST))
)();

export const addItemFn = (user: any, list: TodoList, item: any) => pipe(
  addListItem(getUserFromToken(user.token), list._id?.toString() as string, item),
  TE.getOrElse(() => T.of(EMPTY_ITEM))
)();