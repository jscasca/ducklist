import { ObjectId } from "mongodb";
import { model, Schema } from "mongoose";
import { UserNotification } from '../types';

const schema = new Schema<UserNotification>({
  user_id: {type: ObjectId, required: true},
  notification: {}
});

module.exports = model("user_notification", schema);