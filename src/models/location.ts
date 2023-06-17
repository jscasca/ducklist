import { model, Schema } from "mongoose";
import { Location } from '../types';

const schema = new Schema<Location>({
  name: {type: String, required: true},
  type: {type: String, required: true},
  details: {type: {}, required: true},
});

module.exports = model("mail_login", schema);