import { model, Schema } from "mongoose";
import { User } from '../types';

const schema = new Schema<User>({
  name: {type: String, required: true},
  icon: {type: String, required: true},
});

module.exports = model("user", schema);