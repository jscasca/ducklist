import { ObjectId } from "mongodb";
import { model, Schema } from "mongoose";
import { TodoList } from '../types';

const schema = new Schema<TodoList>({
  name: {type: String, required: true},
  shared: [{type: ObjectId, ref: 'user'}],
  invited: [{type: Object}],
  details: {
    createdBy: {type: ObjectId, ref: 'user'},
    // createdOn: { type: Date, default: Date.now } // Apparently you can get the date from the _id
  },
  meta: {
    total: { type: Number, default: 0 },
    checked: { type: Number, default: 0 }
  }
});

module.exports = model("todo_list", schema);