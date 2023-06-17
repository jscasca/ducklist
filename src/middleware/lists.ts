import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { ObjectId } from "mongodb";
import { ElementNotFoundException, UserAccessException, ValidationError } from "../exceptions";
import { HttpError, internalError, notFound, userAccess, validationError } from "../httpError";
import { List, ShoppingList, ShoppingListItem, TodoList, TodoListItem, User, UserToken } from "../types";

const UserModel = require('../models/user');
const ListInviteModel = require('../models/listInvite');
const UserNotificationModel = require('../models/userNotification');
const EmailLoginModel = require('../models/mailLogin');
const UserSettingsModel = require('../models/userSettings');
const ShoppingListModel = require('../models/shoppingList');
const ShoppingListItemModel = require('../models/shoppingListItem');
const FinishedListModel = require('../models/finishedShoppingList');


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
        createdBy: user.user_id
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
      () => TodoListModel.findById(listId) as Promise<TodoList>,
      (reason) => notFound()
    ),
    TE.chainW(validateUserAccess(user))
  )
};

export const getLists = (user: UserToken, filter: any): TE.TaskEither<HttpError, TodoList[]> => {
  return TE.tryCatch(
    () => TodoListModel.find({shared: new ObjectId(user.user_id)}).populate('shared') as Promise<TodoList[]>,
    (reason) => internalError()
  );
};

const isListIdValid = (listId: string): boolean => {
  return true;
};

export const getList = (user: UserToken, listId: string): TE.TaskEither<HttpError, TodoList> => {
  return isListIdValid(listId) ?
    validateListAccess(user, listId) :
    TE.left(validationError());
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

// TODO: Update more modular
export async function updateList(user: UserToken, listId: string, name: string, meta: any) {
  //
  const list = await ShoppingListModel.find({shared: new ObjectId(user.user_id), _id: new ObjectId(listId)});
  if (!list) {
    throw new UserAccessException('List not shared with user');
  }
  // Check name and meta against current to see what to update
  const updatedList = await ShoppingListModel.findByIdAndUpdate(listId, {
    $set: {
      name,
      // shared: shared.map((s) => new ObjectId(s))
    }
  }, { new: true }).populate('shared');
  /*
  use {overwrite: true} as 3rd argument or $set: {name, shared} to ensure values are saved
  */
  return updatedList;
};

const getItems = (list: TodoList): TE.TaskEither<HttpError, TodoListItem[]> => {
  return TE.tryCatch(
    () => TodoListItemModel.find({list_id: list._id}),
    (reason) => notFound()
  );
};

export async function getListItems(user: UserToken, listId: string) {
  return pipe(
    getList(user, listId),
    TE.chain(list => getItems(list))
  );
  // const list = await ShoppingListModel.find({shared: new ObjectId(user.user_id), _id: new ObjectId(listId)});
  // if (!list) {
  //   throw new UserAccessException('List not shared with user');
  // }
  // const listItems = await ShoppingListItemModel.find({list_id: listId});
  // return listItems;
};

const addItemFn = (user: UserToken, newItem: any) => {
  return (list: TodoList): TE.TaskEither<HttpError, TodoListItem> => {
    const item = {
      ...newItem,
      list_id: list._id,
      status: 'pending',
      details: {
        ...newItem.details,
        created: Date.now(),
        createdBy: new ObjectId(user.user_id)
      }
    }
    return TE.tryCatch(
      () => TodoListItemModel.create(item),
      (reason) => internalError()
    );
  };
};

export const addListItem = (user: UserToken, listId: string, newItem: any): TE.TaskEither<HttpError, TodoListItem> => {
  //
  return pipe(
    getList(user, listId),
    TE.chain(list => addItemFn(user, newItem)(list))
  );
  // const timestamp = Date.now();
  // const nextItem = {
  //   ...newItem,
  //   list_id: listId,
  //   status: 'pending',
  //   details: {
  //     ...newItem.details,
  //     updated: timestamp,
  //     updatedBy: new ObjectId(user.user_id),
  //     created: timestamp,
  //     createdBy: new ObjectId(user.user_id)
  //   }
  // };
  // // console.log('saving next item: ', nextItem);
  // const item = await ShoppingListItemModel.create(nextItem);
  // return item;
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
    () => TodoListItemModel.findByIdAndUpdate() as Promise<TodoListItem[]>,
    (reason) => internalError()
  );
  // const updatedItem = await ShoppingListItemModel.findByIdAndUpdate(item._id, itemToUpdate, { new: true });
  // return updatedItem;
  //
};

const validateItemStatus = (status: string): E.Either<HttpError, string> => {
  return status !== 'pending' && status !== 'checked' && status !== 'deleted' ? E.left(validationError()) : E.right(status);
};

const updateItemStatus = (user: UserToken, itemId: string): (a: string) => TE.TaskEither<HttpError, TodoListItem> => {
  return (status: string): TE.TaskEither<HttpError, TodoListItem> => {
    return TE.tryCatch(
      () => TodoListItemModel.findByIdAndUpdate(
        itemId,
        {
          $set: {
            status: status,
            "details.updated": Date.now(),
            "details.updatedBy": new ObjectId(user.user_id)
          }
        },
        { new: true }
      ),
      (reason) => internalError()
    );
  }
}

export const updateListItemStatus = (user: UserToken, itemId: string, newStatus: string): TE.TaskEither<HttpError, TodoListItem> => {
  // check for valid status
  return pipe(
    validateItemStatus(newStatus),
    TE.fromEither,
    TE.fold(
      (e) => TE.left(e),
      (status) => updateItemStatus(user, itemId)(status)
    )
  );
  // const updateItemTask = updateItemStatus(user, itemId);
  // return pipe(
  //   validateItemStatus(newStatus),
  //   E.fold(
  //     (e) => e,
  //     (status) => updateItemTask(status)
  //   )
  // );
  // return pipe(
  //   validateItemStatus(newStatus),
  //   TE.fromEither,
  //   E.chain(status => updateItemStatus(user, itemId)(status))
  // );
  // if (status !== 'pending' && status !== 'checked' && status !== 'deleted') {
  //   throw new ValidationError('Status');
  // }
  // const updatedItem = await ShoppingListItemModel.findByIdAndUpdate(
  //   itemId, 
  //   { $set: { status: status, "details.updated": Date.now(), "details.updatedBy": new ObjectId(user.user_id)},  },
  //   { new: true });
  // return updatedItem;
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

export async function finishList(user: UserToken, list_id: string, opts: any) {
  console.log('finishing list: ', list_id);
  //
  // const list = await ShoppingListModel.findById(list_id);
  const list = await getListForUser(list_id, user);
  const items: ShoppingListItem[] = await ShoppingListItemModel.find({list_id: list._id});

  // console.log('saving list');
  items.forEach(i => console.log(JSON.stringify(i)));
  const saved = await FinishedListModel.create({
    name: list.name,
    users: list.shared,
    items: items.map((item: ShoppingListItem) => ({
      name: item.name,
      status: item.status,
      notes: item.notes,
      details: item.details
    }))
  });

  const pending = items.filter(i => i.status === 'pending');
  if (pending.length > 0 && opts.pending === true) {
    // create a new list with the pending items
    const newList = await ShoppingListModel.create({
      name: upName(list.name),
      shared: list.shared
    });
    // change list items
    const changedItems = await ShoppingListItemModel.updateMany(
      { list_id: list._id, status: 'pending' }, // filter
      { $set: { list_id: newList._id } }, // update
      {} // options
    );
  }
  const removedItems = await ShoppingListItemModel.deleteMany({list_id: list._id});
  const removedList = await ShoppingListModel.findByIdAndDelete(list._id);
  return saved;
  //
};

/*
export interface FinishedListItem {
  name: string;
  status: 'deleted' | 'checked' | 'pending' | 'unknown';
  notes: any;
  details: ShoppingListItemDetails;
}
*/

export const removeList = (user: UserToken, listId: string, forEveryone: boolean = false): TE.TaskEither<HttpError, boolean> => {
  return pipe(
    getList(user, listId),
    TE.chain(list => {
      if (list.shared.length === 1 || forEveryone) {
        // delete and remove
      } else {
        // delete for myself only (i.e. delete my access, i.e. remove myself from the shared)
      }
      return TE.right(true)
    })
  )
}

export async function removeList(user: UserToken, list_id: string) {
  // Remove yourself from the list of shared users, if you are the last one, delete the list alltogether
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
    throw new UserAccessException("List access");
  }
  // if (list.shared.length === 1) {
  //   console.log('not-shared owned?: ', list.shared[0], user.user_id, list.shared[0]._id?.toString() === user.user_id);
  //   // TBD remove frmo list
  // }
  if (list.shared.length === 1 && list.shared[0]._id?.toString() === user.user_id) {
    // you are the last one, remove the list and all instances
    const removedItems = await ShoppingListItemModel.deleteMany({list_id: list._id});
    // console.log('removed items: ', removedItems);
    const removedList = await ShoppingListModel.findByIdAndDelete(list._id);
    // console.log('removed list before merging: ', removedList.toObject());
    // removedList.count = removedItems;
    // console.log('removed list: ', { count: removedItems.deletedCount, ...removedList.toObject()} );
    return { count: removedItems.deletedCount, ...removedList.toObject()};
  } else {
    // remove only yourself from the list
    const updatedList = await ShoppingListModel.findByIdAndUpdate(list._id, {
      $set: {shared: list.shared.filter((s: any) => s.toString() !== user.user_id).map((user: User) => user._id)}
    }, { new: true});
    return updatedList;
  }
};
// {new: true} ensure we get the updated object

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