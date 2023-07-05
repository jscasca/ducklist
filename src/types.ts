import { ObjectId, ObjectID } from "mongodb";



export interface User {
  name: string;
  icon: string;
  username?: string;
  _id?: ObjectId;
}

export interface UserToken {
  user_id: string;
  name: string;
  icon: string;
  iat: number;
  exp: number;
}

export interface EmailLogin {
  user_id: string;
  mail: string;
  password: string;
}

export interface PhoneLogin {
  user_id: string;
  phone: string;
}

export interface Board {
  name: string;
  type: string;
  icon?: string;
  background?: string;
  theme?: string;
  details: any;
}

export interface BoardInvites {
  identifier: string;
  type: 'mail' | 'phone' | 'username';
  code: string;
  details: any; // InvitedBy, invitedOn, roles?
}

export interface BoardMembers {
  user_id: string;
  board_id: string;
  details: any; // invitedBy, invitedOn, roles?
}

export interface Location {
  name: string;
  type: string;
  icon?: string;
  background?: string;
  details: LocationDetails;
}

export interface LocationDetails {
  createdBy: User;
  createdOn: Date;
}

export interface UserLocation {
  user_id: string;
  location_id: string;
  role: 'admin' | 'owner' | 'readonly'
}

export interface List {
  name: string;
  details: any;
  items: [];
}

export interface RefreshToken {
  token: string;
  expiry: Date,
  user_id: string;
}

export interface TodoList {
  name: string;
  shared: User[]; // array of user_id of shared users
  invited: any[];
  meta?: any;
  details: any; // TODO: Update this object;
  _id?: ObjectId;
}

export interface TodoListItem {
  list_id: string | TodoList;
  name: string;
  status: 'deleted' | 'checked' | 'pending' | 'unknown';
  details: any;
  notes?: any;
  _id?: ObjectId;
}

export interface ShoppingList {
  name: string;
  shared: User[]; // array of user_id of shared users
  invited: any[];
  details: ShoppingListDetails;
  _id?: ObjectId;
}

export interface ShoppingListDetails {
  createdBy: User; // user
  createdOn: Date; // date
}

export interface ShoppingListItem {
  list_id: string;
  name: string;
  status: 'deleted' | 'checked' | 'pending' | 'unknown';
  details: ShoppingListItemDetails;
  notes: any;
  _id?: ObjectId;
}

export interface ShoppingListItemDetails {
  lastUpdateBy: User;
  lastUpdateOn: Date;
}

export interface FinishedShoppingList {
  name: string;
  users: User[];
  // pending?: ShoppingList;
  items: FinishedListItem[];
}

export interface FinishedTodoList {
  name: string;
  users: User[]
  details?: any;
  items: FinishedListItem[];
  _id?: ObjectId;
}

export interface FinishedListDetails {
  finished: {
    archive: string | undefined;
    checked: number;
    pending: number;
  },
  carryover?: {
    list: string;
    items: number;
  }
}

export interface FinishedListItem {
  name: string;
  status: 'deleted' | 'checked' | 'pending' | 'unknown';
  notes: any;
  details: ShoppingListItemDetails;
}

export interface UserSettings {
  _id?: ObjectId;
  privacy?: {
    privacy?: 'public' | 'private';
    blacklisted?: User[] | ObjectId[]; // Blocked users: do not accept invites
    whitelisted?: User[] | ObjectId[]; // Accept by default
    allowed?: User[] | ObjectId[]; // Close contacts: can invite even if private
  }
}

export interface ListInvite {
  list_id: ShoppingList;
  inviting_id: User;
  invited_id: User;
  _id?: ObjectId;
}

export interface BoardInvite {
  board_id: Board;
  inviting_id: User;
  invited_id: User;
  _id?: ObjectId;
}

export interface UserNotification {
  user_id: User;
  notification: any;
  _id?: ObjectId;
}