import { ObjectId } from "mongodb";
import { model, Schema } from "mongoose";
import { FinishedTodoList } from '../types';

const schema = new Schema<FinishedTodoList>({
  name: {type: String, required: true},
  users: [{type: ObjectId, ref: 'user'}],
  details: {},
  // pending: {type: ObjectId, ref: 'shopping_list'},
  items: [{}],
});

module.exports = model("finished_todo_list", schema);
