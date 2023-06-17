import { model, Schema } from "mongoose";

interface Role {
  name: string;
}

const schema = new Schema<Role>({
  name: { type: String, required: true}
});

export const Role = model<Role>('Role', schema);