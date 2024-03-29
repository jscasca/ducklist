import express, { Express, Request, Response, Router} from 'express';
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import * as E from "fp-ts/lib/Either";
import { ValidationError } from '../exceptions';
import { HttpError } from '../httpError';
import { verifyToken } from '../middleware/auth';
import { addListItem, finishList, getListItems, getLists, getList, newList, removeList, updateList, updateListItem, updateListItemStatus, updateItemAttributes, inviteByUsers, updateListStatusCount, inviteToList } from '../middleware/lists';
import { FinishedListDetails, TodoList, TodoListItem, UserToken } from '../types';
import { handleException } from './exceptionHandler';
import { pipe } from 'fp-ts/lib/function';

const router = Router();

// GET all lists for user
router.get('/', verifyToken, (req, res) => {
  const user = (req as any).user;
  pipe(
    getLists(user, {}),
    TE.fold(
      (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
      (lists: TodoList[]) => T.of(res.status(200).json(lists))
    )
  )();
});

// Create new list
router.post('/', verifyToken, (req, res) => {
  const { name, sharedWith } = req.body;
  const user = (req as any).user as UserToken;
  // let shared = (sharedWith && sharedWith.length !== 0) ? sharedWith : [user.user_id];
  console.log(newList(user, name, sharedWith));
  pipe(
    newList(user, name, sharedWith),
    T.map(E.fold(
      (e: HttpError) => {
        return T.of(res.status(e.code()).send(e.message()))
      },
      (list: TodoList) => T.of(res.status(200).json(list))
    )
  ))();
});

  // Get specific list '/lists/:id'
  router.get('/:id', verifyToken, (req, res) => {
    const listId = req.params.id;
    const user = (req as any).user;
    pipe(
      getList(user, listId),
      TE.fold(
        (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
        (list: TodoList) => T.of(res.status(200).json(list))
      )
    )();
  });

  router.delete('/:id', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    const opts = req.body ?? {};
    pipe(
      removeList(user, listId, opts),
      TE.fold(
        (e: HttpError) => {
          return T.of(res.status(e.code()).send(e.message()));
        },
        (_) => {
          return T.of(res.sendStatus(200));
        }
      )
    )();
  });

  // Update existing list
  router.put('/:id', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    const { updates } = req.body;
    pipe(
      updateList(user, listId, updates),
      TE.fold(
        (e: HttpError) => T.of( res.status(e.code()).send(e.message()) ),
        (list: TodoList) => T.of(res.status(200).json(list))
      )
    )();
  });

  // Finish list
  router.post('/:id/finish', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    const { opts } = req.body;
    pipe(
      finishList(user, listId, opts),
      TE.fold(
        (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
        (finished: FinishedListDetails) => T.of(res.status(200).json(finished))
      )
    )();
  });

  // Get list items
  router.get('/:id/items', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    pipe(
      getListItems(user, listId),
      TE.fold(
        (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
        (items: TodoListItem[]) => T.of(res.status(200).json(items))
      )
    )();
  });

  // Insert new list tiem
  router.post('/:id/items', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    const newItem = req.body;
    pipe(
      addListItem(user, listId, newItem),
      TE.fold(
        (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
        (item: TodoListItem) => {
          updateListStatusCount(item.list_id);
          return T.of(res.status(200).json(item))
        }
      )
    )();
  });

  // Update item
  router.put('/items/:id', verifyToken, (req, res) => {
    const user = (req as any).user;
    const itemId = req.params.id;
    const { updates } = req.body;
    res.status(503).send('Not implemented');
  });

  // Update item status
  router.put('/items/:id/status', verifyToken, (req, res) => {
    const user = (req as any).user;
    const itemId = req.params.id;
    const { status } = req.body;
    pipe(
      updateListItemStatus(user, itemId, status),
      TE.fold(
        (e: HttpError) => {
          // console.log('failure: ', e);
          return T.of(res.status(e.code()).send(e.message()))
        },
        (item: TodoListItem) => {
          // console.log('returning: ', item);
          updateListStatusCount(item.list_id);
          return T.of(res.status(200).json(item));
        }
      )
    )();
  });

  // Update item status
  router.put('/items/:id/attributes', verifyToken, (req, res) => {
    const user = (req as any).user;
    const itemId = req.params.id;
    const { updates } = req.body;
    pipe(
      updateItemAttributes(user, itemId, updates),
      TE.fold(
        (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
        (item: TodoListItem) => T.of(res.status(200).json(item))
      )
    )();
  });

  router.post('/:id/invite/users', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    const { invites } = req.body;
    pipe(
      inviteToList(user, listId, invites),
      TE.fold(
        (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
        (list: TodoList) => T.of(res.status(200).json(list))
      )
    )
  });

  // router.post('/lists/:id/invite', verifyToken, (req, res) => {
  //   const user = (req as any).user;
  //   const listId = req.params.id;
  //   const { invites } = req.body;
  //   // [invites]
  //   if (!(user && (invited_id || invited_name ))) {
  //     return handleException(res, new ValidationError('Missing parameters'));
  //   }
  //   inviteToList(user, listId, invited_id, invited_name).then((updatedList) => {
  //     return res.status(200).json(updatedList);
  //   }).catch(e => {
  //     return handleException(res, e);
  //   });
  // });

  router.post('/lists/:id/finish', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    const { opts } = req.body;
    pipe(
      finishList(user, listId, opts),
      TE.fold(
        (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
        (r) => T.of(res.status(200).json(r))
      )
    )();
  });

  router.post('/lists/accept', verifyToken, (req, res) => {
    const user = (req as any).user;
  });

  router.post('/lists/deny', verifyToken, (req, res) => {
    const user = (req as any).user;
  });

  router.post('/invite/:id/accept', verifyToken, (req, res) => {
    const user = (req as any).user;
    const { opts } = req.body; // accept: true/false, forAll: true/false
    pipe(

    )();
  });

  router.post('/invite/:id/deny', verifyToken, (req, res) => {
    const user = (req as any).user;
    const { opts } = req.body; // accept: true/false, forAll: true/false
    pipe(

    )();
  });

export {
  router
}