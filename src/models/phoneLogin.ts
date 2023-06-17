import { model, Schema } from "mongoose";
import { PhoneLogin } from '../types';

const schema = new Schema<PhoneLogin>({
  phone: {type: String, required: true}
});

module.exports = model("phone_login", schema);