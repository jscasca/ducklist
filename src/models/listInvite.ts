import { ObjectId } from "mongodb";
import { model, Schema } from "mongoose";
import { ListInvite } from '../types';

const schema = new Schema<ListInvite>({
  list_id: {type: ObjectId, ref: 'todo_list', required: true},
  list_name: { type: String },
  inviting: {},
  invited_id: {type: ObjectId, ref: 'user'},
  invited_mail: { type: String }
});

module.exports = model("list_invite", schema);

// const model1 = model('name', schema);
// module.exports = { model1, model2 }
// importing
// const { module1, module2 } = require('./pathtofile.js')