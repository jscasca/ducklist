import { DuplicateElementException, ElementNotFoundException, InvalidCredentialsException, UserAccessException } from '../exceptions';
import { User, EmailLogin, RefreshToken } from '../types';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const TOKEN_KEY = process.env.TOKEN_KEY || 'token_key';
const REFRESH_EXPIRATION = 60 * 60 * 24 * 15; // 2 Week expiration
const TOKEN_EXPIRATION = '1m'; // JWT expiration time '5m'

const UserModel = require('../models/user');
const RefreshTokenModel = require('../models/refreshToken');
const EmailLoginModel = require('../models/mailLogin');
const PhoneLoginModel = require('../models/phoneLogin');


// User.create({
//   name: ''
// });

const registerUserByPhone = () => {
  //
};

function verifyExpirationDate(token: RefreshToken): boolean {
  // console.log('verifying refresh token expiration: ', token.expiry.getTime(), new Date().getTime());
  return token.expiry.getTime() > new Date().getTime();
}

async function signUserIn(user: User) {
  // console.log('creating refresh token');
  const refreshToken = await createRefreshToken(user._id?.toString() as string);
  // console.log('refresh token ready: ', refreshToken);
  const token = jwt.sign(
    {
      user_id: user._id,
      name: user.name,
      icon: user.icon
    },
    TOKEN_KEY,
    {
      expiresIn: TOKEN_EXPIRATION
    }
  );
  // console.log('signed jwt token');
  const authUser = {
    user_id: user._id,
    name: user.name,
    icon: user.icon,
    token,
    refreshToken: refreshToken.token
  };
  // console.log('returning user: ', authUser);
  return authUser;
}

export async function refreshToken(user_id: string, requestToken: string) {
  // check token in db
  console.log('looking for token: ', requestToken);
  const foundToken = await RefreshTokenModel.findOne({user_id, token: requestToken});
  if (!foundToken) {
    throw new UserAccessException('Nonexisting token');
  }
  if (!verifyExpirationDate(foundToken)) {
    throw new UserAccessException('Expired refresh token');
  }
  // verify expiration date
  // delete old token create a new one
  await RefreshTokenModel.findByIdAndDelete(foundToken._id);
  // create a new refresh token
  const user = await UserModel.findById(user_id);
  // get the user again and update maybe?
  const signedUser = await signUserIn(user);
  return signedUser;
};

async function createRefreshToken(user_id: string) {
  const expirationDate = new Date();
  // set the second to the desired time
  // console.log('creating token with exp: ', expirationDate.getTime());
  expirationDate.setSeconds(expirationDate.getSeconds() + REFRESH_EXPIRATION);
  // console.log('pushing expiration time to: ', expirationDate.getTime());
  const token = uuidv4();
  const refreshToken = await RefreshTokenModel.create({
    token,
    user_id,
    expiry: expirationDate
  });
  // console.log('creted refresh token: ', refreshToken);
  return refreshToken;
}

// TODO: implement refresh token flow
export async function loginByMail(mail: string, pass: string) {
  // console.log('login by mail');
  const existingLogin = await EmailLoginModel.findOne({mail});
  // console.log('Found login', JSON.stringify(existingLogin));
  if(!existingLogin) {
    throw new ElementNotFoundException('Login does not exist');
  }
  // console.log('validating credentials');
  const valid = await bcrypt.compare(pass, existingLogin.password);
  if (!valid) {
    throw new InvalidCredentialsException('Invalid credentials');
  }
  // console.log('finding user model');
  const user = await UserModel.findById(existingLogin.user_id);
  if (!user) {
    throw new Error('Invalid user');
  }
  // console.log('signing in user');
  return signUserIn(user);
  // const refreshToken = await createRefreshToken(user._id);
  // console.log('Found user', JSON.stringify(user));
  // const token = jwt.sign(
  //   {
  //     user_id: user._id,
  //     name: user.name,
  //     icon: user.icon
  //   },
  //   TOKEN_KEY,
  //   {
  //     expiresIn: '5m'
  //   }
  // );
  // const authUser = {
  //   user_id: user._id,
  //   name: user.name,
  //   icon: user.icon,
  //   token,
  //   refreshToken
  // };
  // return authUser;
};

// TODO implement refresh token flow
export async function registerUserByMail(name: string, mail: string, pass: string) {
  // check mail
  // console.log('finding duplicate login');
  const existingLogin = await EmailLoginModel.findOne({mail});
  // console.log();
  if (existingLogin) {
    throw new DuplicateElementException('Email');
  }
  // console.log('encrypting pass');
  const password = await bcrypt.hash(pass, 10);
  // console.log('creating user');
  const user = await UserModel.create({
    name,
    icon: 'placeholder' // get from somewhere?
  });
  // console.log(JSON.stringify(user));
  // console.log('creating login');
  const login = await EmailLoginModel.create({
    user_id: user._id,
    mail,
    password
  });
  return signUserIn(user);
  // const refreshToken = await createRefreshToken(user._id);
  // console.log('signing jwt');
  // const token = jwt.sign(
  //   {
  //     user_id: user._id,
  //     name: user.name,
  //     icon: user.icon
  //   },
  //   TOKEN_KEY,
  //   {
  //     expiresIn: '2m' // 2h
  //   }
  // );
  // console.log(token);

  // const authUser = {
  //   user_id: user._id,
  //   name: user.name,
  //   icon: user.icon,
  //   token,
  //   refreshToken
  // };
  // return authUser;

};

const loginMailUser = () => {};

const createHouse = () => {};