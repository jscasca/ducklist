import { ObjectId } from "mongodb";
import { model, Schema } from "mongoose";
import { FinishedShoppingList } from '../types';

const schema = new Schema<FinishedShoppingList>({
  name: {type: String, required: true},
  users: [{type: ObjectId, ref: 'user'}],
  // pending: {type: ObjectId, ref: 'shopping_list'},
  items: [{}],
});

module.exports = model("finished_shopping_list", schema);
