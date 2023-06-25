import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import { ObjectId } from "mongodb";
import { ElementNotFoundException, UserAccessException, ValidationError } from "../exceptions";
import { HttpError, internalError, notFound, userAccess, validationError } from "../httpError";
import { FinishedListDetails, FinishedTodoList, List, ShoppingList, ShoppingListItem, TodoList, TodoListItem, User, UserToken } from "../types";

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
  console.log(isNewListParamsValid(user, name, shared));
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

const isUsername = (s: string) => {
  return s.startsWith('@');
};

export const isEmail = (s: string) => {
  return /^[^@]+@[^@]+$/.test(s);
  // return /([!#-'*+/-9=?A-Z^-~-]+(\.[!#-'*+/-9=?A-Z^-~-]+)*|\"\(\[\]!#-[^-~ \t]|(\\[\t -~]))+\")@([!#-'*+/-9=?A-Z^-~-]+(\.[!#-'*+/-9=?A-Z^-~-]+)*|\[[\t -Z^-~]*])/.test(s);
};

export async function inviteToList(user: UserToken, list_id: string, invited_id: string, invited: string) {
  console.log('inviting to list');
  // check the user has access to the list
  const list = await getListForUser(list_id, user);
  console.log('list: ', list);
  if (invited_id) {
    const invitedUser = await UserModel.findById(invited_id);
    if (!invitedUser) {
      throw new ElementNotFoundException(`User:${invited_id}`)
    }
    return inviteUserToList(user, list, invitedUser);
  }
  if (isUsername(invited)) {
    // find by username
    const invitedUser = UserModel.findOne({ username: invited.slice(1) });
    if (invitedUser) {
      return inviteUserToList(user, list, invitedUser);
    } else {
      // notify ??
      // not sure what to do here
    }
  } else if (isEmail(invited)){
    console.log('inviting by mail');
    const existingLogin = await EmailLoginModel.findOne({ mail: invited });
    // console.log('e')
    const invitedUser = await UserModel.findById(existingLogin.user_id);
    if (invitedUser) {
      console.log('exisintg user');
      return inviteUserToList(user, list, invitedUser);
    } else {
      console.log('nonexisintg');
      // notify
      return inviteByMail(user, list, invited);
    }
  } else {
    //
  }
  // else do nothing and return the list?
  // TBD: refactor this
  return list;
}

// Blacklisted means the invited user is private or the inviting user has been blocked
function isBlacklisted(settings: any, inviting: UserToken): boolean {
  // console.log('privacy: ', JSON.stringify(settings.privacy));
  return (settings?.privacy && (settings?.privacy?.privacy === 'private' || settings?.privacy?.blacklisted.some((u: any) => inviting.user_id === u._id)));
}

// whitelist means the request is accepted by default
function isWhitelisted(settings: any, inviting: UserToken): boolean {
  return (settings?.privacy && settings?.privacy?.whitelisted?.some((u:any) => inviting.user_id === u._id));
}

async function inviteDeny(user: UserToken, list: ShoppingList, invited: any) {
  // update the list with the alias or the user and return that list
  const updated = await ShoppingListModel.findByIdAndUpdate(
    list._id,
    { $addToSet: { invited: invited}}
  );
  return list;
}

async function inviteAccept(user: UserToken, list: ShoppingList, invited: User) {
  const updated = await ShoppingListModel.findByIdAndUpdate(
    list._id,
    { $addToSet: { shared: invited._id}}
  );
  return updated;
}

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
  console.log('notiication: ', notification);
  console.log('adding user: ', invited);
  const updated = await ShoppingListModel.findByIdAndUpdate(
    list._id,
    { $addToSet: { invited: invited}},
    { new: true }
  );
  console.log('updayed: ', updated);
  return updated;
}

async function inviteUserToList(user: UserToken, list: ShoppingList, invited: User) {
  // get user settings
  const userSettings = await UserSettingsModel.findById(invited._id);
  console.log('settings: ', userSettings);
  // check if blacklisted:
  if (isBlacklisted(userSettings, user)) {
    // return update list
    console.log('nlackislt');
    return inviteDeny(user, list, {})
  }
  // check if whitelisted
  if (isWhitelisted(userSettings, user)) {
    //
    console.log('whitelisted');
    return inviteAccept(user, list, invited);
  }
  console.log('normal invite');
  // else generate notification and notify the user
  return inviteNotification(user, list, invited);
}

// TODO: develop this feature
async function inviteByMail(user: UserToken, list: ShoppingList, invitedMail: string) {
  // Should create a notification to keep the reference of the users
  // Email the notification id to the email address
  // Then update the list with the person email as the name
  // should email the external user
  console.log('Need to implement [InviteByMail]');
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
        console.log('error: ', reason);
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
  const updatedItem = await ShoppingListItemModel.findByIdAndUpdate(
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
  // change list items
  const updated = await TodoListItemModel.updateMany(
    { list_id: list._id, status: 'pending' }, // filter
    { $set: { list_id: newList._id } }, // update
    {} // options
  );

  return {
    items: updated.modifiedCount,
    list: newList._id
  }
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
    carryOver = carryOverList(list);
  }
  const removedItems = await ShoppingListItemModel.deleteMany({list_id: list._id});
  const removedList = await ShoppingListModel.findByIdAndDelete(list._id);
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

export const removeList = (user: UserToken, listId: string, forEveryone: boolean = false): TE.TaskEither<HttpError, boolean> => {
  return pipe(
    getList(user, listId),
    TE.chain(list => {
      if (list.shared.length === 1 || forEveryone) {
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