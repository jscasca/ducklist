import { model, Schema } from "mongoose";

interface User {
  user_id: string;
  email: string;
  password: string;
}

const schema = new Schema<User>({
  user_id: { type: String, required: true},
  email: {type: String, required: true},
  password: {type: String, required: true},
});

module.exports = model("login", schema);