import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import { ObjectId } from "mongodb";
import { ElementNotFoundException, UserAccessException, ValidationError } from "../exceptions";
import { HttpError, internalError, notFound, userAccess, validationError } from "../httpError";
import { EmailLogin, FinishedListDetails, FinishedTodoList, List, ListInvite, ShoppingList, ShoppingListItem, TodoList, TodoListItem, User, UserNotification, UserSettings, UserToken } from "../types";

const UserModel = require('../models/user');
const ListInviteModel = require('../models/listInvite');
const UserNotificationModel = require('../models/userNotification');
const EmailLoginModel = require('../models/mailLogin');
const UserSettingsModel = require('../models/userSettings');
const ShoppingListModel = require('../models/shoppingList');
const ShoppingListItemModel = require('../models/shoppingListItem');
const FinishedListModel = require('../models/finishedTodoList');


const TodoListModel = require('../models/todoList');
const TodoListItemModel = require('../models/todoListItem');

// export async function newList(user: UserToken, name: string, shared: string[]) {
//   // just insert a list and for each user create a share access
//   // maybe check that the shared list is of known users?
//   const list = await ShoppingListModel.create({
//     name,
//     shared: shared.map((s) => new ObjectId(s)),
//     details: {
//       createdBy: user.user_id,
//     }
//   });
//   return list;
// };

const isValidId = (id: string): E.Either<HttpError, string> => {
  return ObjectId.isValid(id) ? E.right(id) : E.left(validationError());
};

const isNewListParamsValid = (user: UserToken, name: string, shared: string[]): boolean => {
  if (!user) return false;
  if (name === '') return false;
  if (!shared || shared.length < 1) return false;
  return true;
};

export const newList = (user: UserToken, name: string, shared: string[]): TE.TaskEither<HttpError, TodoList> => {
  return isNewListParamsValid(user, name, shared) ?
  TE.tryCatch(
    () => TodoListModel.create({
      name,
      shared: shared.map((s) => new ObjectId(s)),
      details: {
        createdBy: new ObjectId(user.user_id)
      }
    }) as Promise<TodoList>,
    (reason) => internalError()
  ) :
  TE.left(validationError());
};

const validateUserAccess = (user: UserToken): (l: TodoList) => TE.TaskEither<HttpError, TodoList> => {
  return (list: TodoList): TE.TaskEither<HttpError, TodoList> => {
    if (!list.shared.some(u => u._id?.toString() === user.user_id)) {
      return TE.left(userAccess())
    }
    return TE.right(list);
  };
}

const validateListAccess = (user: UserToken, listId: string): TE.TaskEither<HttpError, TodoList> => {
  return pipe(
    TE.tryCatch(
      () => TodoListModel.findById(new ObjectId(listId)) as Promise<TodoList>,
      (reason) => internalError()
    ),
    TE.chain((list) => list === null ? TE.left(notFound()) : TE.right(list)),
    TE.chainW((list: TodoList) => validateUserAccess(user)(list))
  )
};

export const getLists = (user: UserToken, filter: any): TE.TaskEither<HttpError, TodoList[]> => {
  return TE.tryCatch(
    () => TodoListModel.find({shared: new ObjectId(user.user_id)}).populate('shared') as Promise<TodoList[]>,
    (reason) => internalError()
  );
};

export const getList = (user: UserToken, listId: string): TE.TaskEither<HttpError, TodoList> => {
  return pipe(
    isValidId(listId),
    TE.fromEither,
    TE.chain((id: string) => validateListAccess(user, id))
  );
}

async function getListForUser(list_id: string, user: UserToken) {
  let list: ShoppingList;
  try{
    list = await ShoppingListModel.findById(list_id);
  } catch(e) {
    throw new ElementNotFoundException(`List:${list_id}`);
  }
  // const list = await ShoppingListModel.find({shared: new ObjectId(user.user_id), _id: new ObjectId(listId)});
  if(!list) {
    throw new ElementNotFoundException(`List:${list_id}`);
  }
  // Check if user has access
  if(!list.shared.some((u) => u._id?.toString() === user.user_id)) {
    throw new UserAccessException(`List:${list_id}:User:${user.user_id}`);
  }
  return list;
}

// TODO: Update List in smaller modules

const mapUpdateValues = (values: Record<string, any>): Record<string, any> => {
  let updates = {}
  if (values.name) {
    updates = {$set: {name: values.name}}
  }
  return updates;
}

const updateFn = async (list: TodoList, values: Record<string, string>): Promise<TodoList> => {
  const updates = mapUpdateValues(values);
  console.log('Updating List with values: ', updates);
  const updated = await TodoListModel.findByIdAndUpdate(list._id, updates, { new: true }).populate('shared');
  return updated;
};

const validateUpdates = (values: any): TE.TaskEither<HttpError, Record<string, string>> => {
  if (!values) return TE.left(validationError());
  return TE.right(values as Record<string, string>);
}

export const updateList = (user: UserToken, listId: string, values: Record<string, string>): TE.TaskEither<HttpError, TodoList> => {
  return pipe(
    validateUpdates(values),
    TE.bindTo('updates'),
    TE.bind('list', () => getList(user, listId)),
    TE.chain(({updates, list}) => TE.tryCatch(
      () => updateFn(list, updates),
      (reason) => internalError()
    ))
  );
};

const getItems = (list: TodoList): TE.TaskEither<HttpError, TodoListItem[]> => {
  return TE.tryCatch(
    () => TodoListItemModel.find({list_id: list._id}),
    (reason) => notFound()
  );
};

export const getListItems = (user: UserToken, listId: string): TE.TaskEither<HttpError, TodoListItem[]> => {
  return pipe(
    getList(user, listId),
    TE.chain(list => getItems(list))
  );
};

const addItemFn = (list: TodoList, item: Record<string, string>): TE.TaskEither<HttpError, TodoListItem> => {
  const listItem = {
    ...item,
    list_id: list._id
  }
  return TE.tryCatch(
    () => TodoListItemModel.create(listItem),
    (reason) => internalError()
  )
};

const validateNewItem = (user: UserToken, newItem: any): TE.TaskEither<HttpError, Record<string, string>> => {
  const details = newItem.details ? newItem.details : {}
  const item = {
    ...newItem,
    status: 'pending',
    details: {
      ...details,
      created: Date.now(),
      createdBy: new ObjectId(user.user_id)
    }
  };
  if (item.name) {
    return TE.right(item);
  }
  return TE.left(validationError());
};

export const addListItem = (user: UserToken, listId: string, newItem: any): TE.TaskEither<HttpError, TodoListItem> => {
  //
  return pipe(
    validateNewItem(user, newItem),
    TE.bindTo('item'),
    TE.bind('list', () => getList(user, listId)),
    TE.chain(({list, item}) => addItemFn(list, item))
  );
};

/*
Nested poipulate example
Project.find(query)
  .populate({ 
     path: 'pages',
     populate: {
       path: 'components',
       model: 'Component'
     } 
  })
  .exec(function(err, docs) {});
*/

const validateItemAccess = (user: UserToken, itemId: string) => {
  return pipe(
    TE.tryCatch(
      () => TodoListItemModel.findById(new ObjectId(itemId)).populate({ path: 'list_id', populate: { path: 'shared', model: 'user'}}) as Promise<TodoListItem>,
      (reason) => {
        // console.log('error: ', reason);
        return internalError()
      }
    ),
    TE.chain((item: TodoListItem) => item === null ? TE.left(notFound()) : TE.right(item)),
    TE.chain((item: TodoListItem) => {
      if (!(item.list_id as TodoList).shared.some(u => u._id?.toString() === user.user_id)) {
        return TE.left(userAccess());
      }
      return TE.right(item);
    })
  );
};

const getItem = (user: UserToken, itemId: string): TE.TaskEither<HttpError, TodoListItem> => {
  return pipe(
    isValidId(itemId),
    TE.fromEither,
    TE.chain((id: string) => validateItemAccess(user, id))
  );
};

const validateItemUpdates = (updates: Record<string, any>): E.Either<HttpError, Record<string, any>> => {
  //
  return E.right(updates);
}

const updateItemFn = (user: UserToken, item: TodoListItem, updates: Record<string, any>): TE.TaskEither<HttpError, TodoListItem> => {
  //
  const itemToUpdate = {
    ...item,
    details: {
      ...item.details,
      updated: Date.now(),
      updatedBy: new ObjectId(user.user_id)
    }
  };
  return TE.left(internalError());
};

export const updateItem = (user: UserToken, itemId: string, updates: Record<string, any>) => {
  return pipe(
    validateItemUpdates(updates),
    TE.fromEither,
    TE.bindTo('updates'),
    TE.bind('item', () => getItem(user, itemId)),
    TE.chain(({updates, item}) => updateItemFn(user, item, updates))
  );
};

const updateItemAttributesFn = (item: TodoListItem, updates: Record<string, any>) => {
  return TE.tryCatch(
    () => TodoListItemModel.findByIdAndUpdate(item._id, updates, {new: true}) as Promise<TodoListItem>,
    (reason) => internalError()
  );
};

const validateItemAttributesUpdates = (user: UserToken, updates: Record<string, any>): E.Either<HttpError, Record<string, any>> => {
  if (!Array.isArray(updates.changes) || !Array.isArray(updates.deletions)) {
    return E.left(validationError());
  }

  const validChanges = updates.changes.filter(c => c.key && c.value && (c.key === 'name' || c.key.startsWith('notes.'))).reduce((acc, current) => ({...acc, [current.key]: current.value}), {});
  const validDeletions = updates.deletions.filter(d => d.key && d.key.startsWith('notes')).reduce((acc, current) => ({...acc, [current.key]: ''}), {});
  return E.right({
    $set: {
      ...validChanges,
      'details.updated': Date.now(),
      'details.updatedBy': new ObjectId(user.user_id)
    },
    $unset: validDeletions
  });
};

export const updateItemAttributes = (user: UserToken, itemId: string, updates: Record<string, any>): TE.TaskEither<HttpError, TodoListItem> => {
  return pipe(
    validateItemAttributesUpdates(user, updates),
    TE.fromEither,
    TE.bindTo('updates'),
    TE.bind('item', () => getItem(user, itemId)),
    TE.chain(({item, updates}) => updateItemAttributesFn(item, updates))
  );
};

export async function updateListItem(user: UserToken, item: any) {
  // check stuff here?
  const itemToUpdate = {
    ...item,
    details: {
      ...item.details,
      updated: Date.now(),
      updatedBy: new ObjectId(user.user_id)
    }
  };
  return TE.tryCatch(
    () => TodoListItemModel.findByIdAndUpdate(item._id, itemToUpdate) as Promise<TodoListItem[]>,
    (reason) => internalError()
  );
};

const validateItemStatus = (status: string): E.Either<HttpError, string> => {
  return status !== 'pending' && status !== 'checked' && status !== 'deleted' ? E.left(validationError()) : E.right(status);
};

const updateItemStatusFn = (user: UserToken, item: TodoListItem, status: string): TE.TaskEither<HttpError, TodoListItem> => {
  return TE.tryCatch(
    () => TodoListItemModel.findByIdAndUpdate(item._id, {
      $set: {
        status: status,
        'details.updated': Date.now(),
        'details.updatedBy': new ObjectId(user.user_id)
      },
    }, { new: true }),
    (reason) => internalError()
  );
};

export const updateListItemStatus = (user: UserToken, itemId: string, newStatus: string): TE.TaskEither<HttpError, TodoListItem> => {
  // check for valid status
  return pipe(
    validateItemStatus(newStatus),
    TE.fromEither,
    TE.bindTo('status'),
    TE.bind('item', () => getItem(user, itemId)),
    TE.chain(({ status, item }) => updateItemStatusFn(user, item, status))
  );
}

export async function updateListItemNotes(user: UserToken, itemId: string, notes: any) {
  // validate notes?
  const updatedItem = await TodoListItemModel.findByIdAndUpdate(
    itemId, 
    { $set: { notes: notes} },
    { new: true });
  return updatedItem;}

const upName = (s: string) => {
  const rerun = s.match(/\((\d+)\)$/); 
  let run = ' (2)';
  if(rerun) {
    run = `(${(parseInt(rerun[1]) + 1)})`;
    return s.replace(/\(\d+\)/, run);
  }
  return s + run;
};

const carryOverList = async (list: TodoList) => {
  // create a new list and add items
  const newList = await TodoListModel.create({
    name: upName(list.name),
    shared: list.shared
  });
  // console.log('created list: ', newList);
  // change list items
  const updated = await TodoListItemModel.updateMany(
    { list_id: list._id, status: 'pending' }, // filter
    { $set: { list_id: newList._id } }, // update
    {} // options
  );

  return {carryover: {
    items: updated.modifiedCount,
    list: newList._id
  }}
};

const finishFn = async (list: TodoList, user: UserToken, opts: any): Promise<FinishedListDetails> => {
  const items: TodoListItem[] = await TodoListItemModel.find({ list_id: list._id});
  const pending = items.filter(i => i.status === 'pending');
  // Finished and archived list
  const finishedList: FinishedTodoList = await FinishedListModel.create({
    name: list.name,
    users: list.shared,
    details: {
      finishedOn: Date.now(),
      finishedBy: new ObjectId(user.user_id)
    },
    items: items.map((item: TodoListItem) => ({
      name: item.name,
      status: item.status,
      notes: item.notes,
      details: item.details
    }))
  });

  let carryOver = {};

  if (opts.carryover && pending.length > 0) {
    // Create a new list with the pending items
    carryOver = await carryOverList(list);
  }
  const removedItems = await TodoListItemModel.deleteMany({list_id: list._id});
  const removedList = await TodoListModel.findByIdAndDelete(list._id);
  return {
    finished: {
      archive: finishedList._id?.toString(),
      checked: items.filter(i => i.status === 'checked').length,
      pending: pending.length
    },
    ...carryOver
  };
};

export const finishList = (user: UserToken, listId: string, opts: any = {}): TE.TaskEither<HttpError, FinishedListDetails> => {
  return pipe(
    getList(user, listId),
    TE.chain(list => TE.tryCatch(
      () => finishFn(list, user, opts),
      (reason) => internalError()
    ))
  );
};

const removeListAndItems = async (listId: ObjectId | undefined) => {
  await TodoListItemModel.deleteMany({list_id: listId});
  await TodoListModel.findByIdAndDelete(listId);
  return true;
};

const removeUserFromList = async (listId: ObjectId | undefined, userId: string) => {
  // const updatedList = await ShoppingListModel.findByIdAndUpdate(list._id, {
  //   $set: {shared: list.shared.filter((s: any) => s.toString() !== user.user_id).map((user: User) => user._id)}
  // }, { new: true});
  // {new: true} ensure we get the updated object
  await TodoListModel.findByIdAndUpdate(listId, {
    $pull: {shared: userId}
  });
  return true;
};

export const removeList = (user: UserToken, listId: string, opts: Record<string, any>): TE.TaskEither<HttpError, boolean> => {
  return pipe(
    getList(user, listId),
    TE.chain(list => {
      if (list.shared.length === 1 || opts.force) {
        // delete and remove
        return TE.tryCatch(
          () => removeListAndItems(list._id),
          (reason) => internalError()
        );
      }
      return TE.tryCatch(
        () => removeUserFromList(list._id, user.user_id),
        (reason) => internalError()
      );
    })
  )
}

export async function acceptInvite(user: UserToken, invite_id: string) {
  //
  const invite = await ListInviteModel.findById(invite_id).populate('list_id inviting_id invited_id');
  console.log('invitation: ', JSON.stringify(invite));
  if (!invite) {
    // throw exception: invite not found
    throw new ElementNotFoundException('Invite not found');
  }
  if (invite.invited_id?._id !== user.user_id) {
    // throw exception: invalid user
    throw new UserAccessException('List not shared with user');
  }
  // update list and then remove invitation
  const list = await ShoppingListModel.findByIdAndUpdate(
    invite.list_id._id, 
    {
      $addToSet: { shared: invite.invited_id._id },
      $pull: { invited: invite.invited_id._id }
    }
  );
  return list;
}

export async function denyInvite(user: UserToken, invite_id: string) {
  // do nothing?? maybe just remove the invite?
  const invite = await ListInviteModel.findById(invite_id).populate('list_id inviting_id invited_id');
  if (!invite) {
    throw new ElementNotFoundException('Invite not found');
  }
  if (invite.invited_id?._id !== user.user_id) {
    // throw exception: invalid user
    throw new UserAccessException('List not shared with user');
  }
}

export const inviteByEmails = () => {};

const validateUsers = (invited: string[]) => {
  if (!Array.isArray(invited)) return E.left(validationError());
  return E.right(invited.filter(i => ObjectId.isValid(i)).map(i => new ObjectId(i)));
};

interface sortInvites {
  accept: ObjectId[];
  deny: ObjectId[];
  invite: ObjectId[];
}

const inviteAndNotifyUsers = async (user: UserToken, list: TodoList, invited: ObjectId[]): Promise<void> => {
  // make the invites
  const userFull = UserModel.findById(new ObjectId(user.user_id));
  const invites = invited.map(u => {
    const invite: ListInvite = {
      list_id: list._id as ObjectId,
      list_name: list.name,
      inviting: userFull,
      invited_id: u
    };
    return invite;
  });
  const listInvites = await ListInviteModel.insertMany(invites) as ListInvite[];
  // make the notifications
  const notifications = listInvites.map(l => {
    const notification: UserNotification = {
      user_id: l.invited_id as ObjectId,
      read: false,
      notificationModel: 'list_invite',
      notification: l._id
    };
    return notification;
  });
  const userNotifications = await UserNotificationModel.insertMany(notifications);
  return userNotifications;
};

interface Invitations {
  emails: string[];
  users: ObjectId[];
}

const makeInvitations = async (user: UserToken, list: TodoList, invited: (string|ObjectId)[]): Promise<TodoList> => {
  const { emails, users } = invited.reduce((a: Invitations, i) => {
    return i instanceof ObjectId ? {...a, users: a.users.concat(i)} : {...a, emails: a.emails.concat(i)};
  }, { emails: [], users: []});
  // Eail that have actual users
  const logins: EmailLogin[] = emails.length > 0 ? await EmailLoginModel.find({ mail: { $in: emails } }) : [];
  // Will have to email these one as they dont have an account
  const emailOnly = emails.filter(e => logins.every(l => l.mail !== e));
  // All the users invited (they have accounts)
  const usersToInvite = logins.map(l => new ObjectId(l.user_id)).concat(users);
  const settings: UserSettings[] = await UserSettingsModel.find({ _id: { $in: usersToInvite } });
  // Update history here?
  const historyUpdate = {};
  // users without settings
  const without = usersToInvite.filter(i => settings.some(s => i.equals(s._id as ObjectId)));
  // separate users with settings
  const { accept, deny, invite } = settings.reduce(() => {}, {});
  return list;
};

const makeUserInvFn = async (user: UserToken, list: TodoList, invited: ObjectId[]): Promise<TodoList> => {
  //
  const settings: UserSettings[] = await UserSettingsModel.find({_id: { $in: invited}});
  const historyUpdate = { invited: {
    date: Date.now(),
    invites: invited,
    invitedBy: new ObjectId(user.user_id)
  }};
  const without = invited.filter(i => settings.some(s => i.equals(s._id as ObjectId)));
  const { accept, deny, invite } = settings.reduce((sorted: sortInvites, s) => {
    if (Array.isArray(s?.privacy?.whitelisted)) {
      if (s.privacy?.whitelisted.some(w => w.toString() === user.user_id)) {
        return {
          ...sorted,
          accepted: sorted.accept.concat(s._id as ObjectId)
        }
      }
    }
    if (Array.isArray(s?.privacy?.blacklisted)) {
      if (s.privacy?.blacklisted.some(b => b.toString() === user.user_id)) {
        return {
          ...sorted,
          denied: sorted.deny.concat(s._id as ObjectId)
        }
      }
    }
    if (s?.privacy?.privacy === 'private') {
      if (Array.isArray(s?.privacy?.allowed) && s.privacy.allowed.some(a => a.toString() === user.user_id)) {
        return {
          ...sorted,
          toInvite: sorted.invite.concat(s._id as ObjectId)
        };
      } else {
        return {
          ...sorted,
          deny: sorted.deny.concat(s._id as ObjectId)
        }
      }
    }
    return {
      ...sorted,
      invite: sorted.invite.concat(s._id as ObjectId)
    };
  }, {
    deny: [], accept: [], invite: []
  });

  // TBD: do something with the denied?

  const acceptUpdate = accept.length > 0 ? { shared: accept } : {}

  const inviteAndNotify = invite.concat(without);
  // Make invitations and send notifications
  if ( inviteAndNotify.length > 0 ) {
    inviteAndNotifyUsers(user, list, inviteAndNotify);
  }
  const updates = {
    $push: {
      ...historyUpdate,
      ...acceptUpdate
    }
  };
  const updated = await TodoListModel.findByIdAndUpdate(list._id, updates, { new: true });
  return updated;
};

const makeUserInvitations = (user: UserToken, list: TodoList, invited: ObjectId[]): TE.TaskEither<HttpError, TodoList> => {
  //
  return pipe(
    TE.tryCatch(
      () => makeUserInvFn(user, list, invited) as Promise<TodoList>,
      (reason) => internalError()
    )
  );
};

export const inviteByUsers = (user: UserToken, listId: string, invited: string[]): TE.TaskEither<HttpError, TodoList> => {
  return pipe(
    validateUsers(invited),
    TE.fromEither,
    TE.bindTo('invitedIds'),
    TE.bind('list', () => getList(user, listId)),
    TE.chain(({list, invitedIds}) => makeUserInvitations(user, list, invitedIds))
  );
};

const validateInvitations = (invited: string[]): E.Either<HttpError, (string|ObjectId)[]> => {
  if (!Array.isArray(invited)) return E.left(validationError());
  return E.right(invited.filter(i => ObjectId.isValid(i) || isEmail(i)).map(i => ObjectId.isValid(i) ? new ObjectId(i) : i));
};

export const inviteToList = (user: UserToken, listId: string, invited: string[]) => {
  return pipe(
    validateInvitations(invited),
    TE.fromEither,
    TE.bindTo('invitations'),
    TE.bind('list', () => getList(user, listId)),
    TE.chain(({list, invitations}) => TE.tryCatch(
        () => makeInvitations(user, list, invitations),
        (reason) => internalError()
      )
    )
  );
};

const validateUsername = (username: string): E.Either<HttpError, string> => {
  return isUsername(username) ? E.right(username.slice(1)) : E.left(validationError());
};

const isUsername = (s: string) => {
  return s.startsWith('@');
};

const validateEmail = (mail: string): E.Either<HttpError, string> => {
  return isEmail(mail) ? E.right(mail) : E.left(validationError());
};

export const isEmail = (s: string) => {
  return /^[^@]+@[^@]+$/.test(s);
  // return /([!#-'*+/-9=?A-Z^-~-]+(\.[!#-'*+/-9=?A-Z^-~-]+)*|\"\(\[\]!#-[^-~ \t]|(\\[\t -~]))+\")@([!#-'*+/-9=?A-Z^-~-]+(\.[!#-'*+/-9=?A-Z^-~-]+)*|\[[\t -Z^-~]*])/.test(s);
};

/*
async function inviteNotification(user: UserToken, list: ShoppingList, invited: User) {
  console.log('creaiting invite, notification and updating list');
  // createa list invite and a user notification
  const invite = await ListInviteModel.create({
    list_id: list._id,
    inviting_id: new ObjectId(user.user_id),
    invited_id: invited._id
  });
  console.log('invite created: ', invite);
  const notification = await UserNotificationModel.create({
    user_id: new ObjectId(invited._id),
    notification: {
      type: 'list_invite',
      invite_id: invite._id,
      inviting_user: {
        name: user.name,
        icon: user.icon
      },
      invited_list: {
        name: list.name
      }
    }
  });
}
*/