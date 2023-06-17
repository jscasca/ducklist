import { ObjectId } from "mongodb";
import { model, Schema } from "mongoose";
import { ShoppingListItem } from '../types';

const schema = new Schema<ShoppingListItem>({
  list_id: {type: String, ref: 'list'},
  name: {type: String, required: true},
  status: {type: String, required: true},
  details: {
    createdBy: {type: ObjectId, ref: 'user'},
    // createdOn: { type: Date, default: Date.now } // Apparently you can get the date from the _id
  },
  notes: {}
});

module.exports = model("shopping_list_item", schema);


/*
https://stackoverflow.com/questions/31907370/mongoose-storing-an-array-of-ids-in-mongodb-at-storage-time-but-getting-entir

Mongoose provides a mechanism for referencing other collections and populating them. I'm making the assumption the _ids in friends are other Users so you can define your schema as

module.exports = mongoose.model('User', new Schema(
{
    username: String,
    userType: int,
    tagline: String,
    friends: [{type: ObjectId, ref: 'User'}]
}));

And then you can use the built in populate method in mongoose to retrieve the actual documents and not just the _ids

User
.findOne({ username: username })
.populate('friends')
.exec(function (err, user) {
  if (err) return handleError(err);
  console.log(user.friends);
});


*/