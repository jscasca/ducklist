
export type HttpError = {
  code: () => number;
  message: () => string;
}

const httpError = (code: number, message: string): HttpError  => {
  return {
    code: () => code,
    message: () => message
  }
}

const validationError = (): HttpError => {
  return httpError(400, 'Validation Error');
}

const invalidCredentials = (): HttpError => {
  return httpError(401, 'Invalid credentials');
}

const userAccess = (): HttpError => {
  return httpError(403, 'User Access');
}

const notFound = (): HttpError => {
  return httpError(404, 'Not found');
}

const internalError = (): HttpError => {
  return httpError(500, 'Internal Error');
};

export {
  httpError,
  validationError,
  invalidCredentials,
  userAccess,
  notFound,
  internalError
}