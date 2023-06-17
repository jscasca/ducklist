import { timeStamp } from "console";

export class ElementNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ElementNotFoundException.prototype);
    this.name = 'ElementNotFoundException';
  }
}

export class InvalidCredentialsException extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidCredentialsException.prototype);
    this.name = 'InvalidCredentialsException'
  }
}

export class UserAccessException extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, UserAccessException.prototype);
    this.name = 'UserAccessException'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
    this.name = 'ValidationError';
  }
}

export class PropertyRequiredError extends ValidationError {
  property: string;
  constructor(property: string) {
    super(`No property: ${property}`);
    Object.setPrototypeOf(this, PropertyRequiredError.prototype);
    this.name = 'PropertyRequiredError';
    this.property = property;
  }
}

export class DuplicateElementException extends ValidationError {
  duplicate: string;
  constructor(duplicate: string) {
    super(`Duplicate element: ${duplicate}`);
    Object.setPrototypeOf(this, DuplicateElementException.prototype);
    this.name = 'DuplicateElementException';
    this.duplicate = duplicate;
  }
}

// More info here: https://javascript.info/custom-errors

// Extended errors fail to validate with `instanceof` due to babel issues
// https://stackoverflow.com/questions/42064466/instanceof-using-es6-class-inheritance-chain-doesnt-work