import {Request, response, Response } from 'express';
import { DuplicateElementException, ElementNotFoundException, InvalidCredentialsException, UserAccessException, ValidationError } from '../exceptions';

export const handleException = (res: Response, exception: any, handler: (res: Response, e: any) => boolean = () => false): void => {
  const response = {
    status: 500,
    message: exception.message
  }
  if (!handler(res, exception)) {
    //
  }
  // console.log('handling exception: ', exception);
  if (exception instanceof ValidationError) {
    response.status = 400;
  }
  // 401 unauthorized: clinet provides no credentials or invalid
  if (exception instanceof InvalidCredentialsException) {
    response.status = 401;
  }
  // 403 Forbidden client has valid credntials but not enough privileges to performa an action
  if (exception instanceof UserAccessException) {
    response.status = 403;
  }
  if (exception instanceof ElementNotFoundException) {
    response.status = 404;
  }
  if (exception instanceof DuplicateElementException) {
    response.status = 409;
  }
  res.status(response.status).send(response.message);
}