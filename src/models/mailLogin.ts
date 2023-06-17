import { model, Schema } from "mongoose";
import { EmailLogin } from '../types';

const schema = new Schema<EmailLogin>({
  user_id: {type: String, required: true},
  mail: {type: String, required: true, unique: true},
  password: {type: String, required: true},
});

module.exports = model("mail_login", schema);