import { model, Schema } from "mongoose";
import { RefreshToken } from '../types';

const schema = new Schema<RefreshToken>({
  token: {type: String, required: true},
  user_id: {type: String, required: true},
  expiry: {type: Date, required: true}
});

module.exports = model("refresh_token", schema);