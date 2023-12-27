import { ObjectId } from "mongodb";
import { model, Schema } from "mongoose";
import { UserNotification } from '../types';

const schema = new Schema<UserNotification>({
  user_id: { type: ObjectId, ref: 'user' },
  actor_id: { type: ObjectId, ref: 'user' },
  read: { type: Date },
  entity: { type: String },
  action: { type: String },
  notification: { },
});

// Using mixed schema:
// att: {}
// att: Object
// att: Schema.Types.Mixed
// att: mongoose.Mixed
// new Schema({ att: {} })
// const schema = new Schema<UserNotification>({
//   user_id: { type: ObjectId, required: true },
//   read: { type: Boolean, default: false },
//   notification: { type: ObjectId, required: true, refPath: 'notificationModel' },
//   notificationModel: { type: String, required: true, enum: ['list_invite'] }
// });

module.exports = model("user_notification", schema);

/*
const commentSchema = new Schema({
  body: { type: String, required: true },
  doc: {
    type: Schema.Types.ObjectId,
    required: true,
    // Instead of a hardcoded model name in `ref`, `refPath` means Mongoose
    // will look at the `docModel` property to find the right model.
    refPath: 'docModel'
  },
  docModel: {
    type: String,
    required: true,
    enum: ['BlogPost', 'Product']
  }
});
*/