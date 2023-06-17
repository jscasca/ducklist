import { UserToken } from "../src/types";

const jwt = require('jsonwebtoken');

const TOKEN_KEY = process.env.TOKEN_KEY || 'token_key';
//const decoded = jwt.verify(token, TOKEN_KEY);

export const getUserFromToken = (token: any): UserToken => {
  return jwt.verify(token, TOKEN_KEY) as UserToken;
};