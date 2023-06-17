import { ObjectId } from "mongodb";
import { model, Schema } from "mongoose";
import { UserSettings } from '../types';

const schema = new Schema<UserSettings>({
  _id: {type: ObjectId, auto: false},
  privacy: {
    privacy: {type: String, default: 'public'},
    blacklisted: [{type: ObjectId, ref: 'user'}],
    whitelisted: [{type: ObjectId, ref: 'user'}],
    allowed: [{type: ObjectId, ref: 'user'}]
  }
});

module.exports = model("user_settings", schema);