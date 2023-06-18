import express, { Express, Request, Response, Router} from 'express';
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import * as E from "fp-ts/lib/Either";
import { ValidationError } from '../exceptions';
import { HttpError, validationError } from '../httpError';
import { verifyToken } from '../middleware/auth';
import { addListItem, finishList, getListItems, getLists, getList, inviteToList, newList, removeList, updateList, updateListItem, updateListItemStatus } from '../middleware/lists';
import { TodoList, UserToken } from '../types';
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
  // getLists(user, {}).then((l) => {
  //   res.json(l);
  // }).catch((e) => {
  //   res.status(400).send(e.message);
  // });
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
        console.log('Failed with error: ', e);
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
    console.log('deleting lists');
    const user = (req as any).user;
    const list_id = req.params.id;
    console.log('id: ', list_id);
    // pipe(
      
    // )();
    removeList(user, list_id).then((list) => {
      return res.status(200).json(list);
    }).catch((e) => {
      console.log(e);
      return handleException(res, e);
    });
  });

  // Update existing list
  router.post('/:id', verifyToken, (req, res) => {
    const user = (req as any).user;
    console.log('updating existing');
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

  // TO-DO

  // Update list details

  // Update list name

  // Update shared

  // Insert new list tiem
  router.post('/lists/:id/items', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    const { item } = req.body;
    if (!(user && listId)) {
      return handleException(res, new ValidationError('Missing parameters'), () => false);
    }
    addListItem(user, listId, item).then((newItem) => {
      res.status(200).json(newItem);
    }).catch((e) => {
      handleException(res, e, () => false);
    });
  });

  router.get('/lists/:id/items', verifyToken, (req: Request, res: Response) => {
    const user = (req as any).user;
    const listId = req.params.id;
    if (!(user && listId)) {
      // return res.status(400).send('Missing parameters');
      handleException(res, new ValidationError('Missing parameters'), () => false);
    }
    getListItems(user, listId).then((listItems) => {
      res.status(200).json(listItems);
    }).catch((e) => {
      handleException(res, e, () => false);
    });
  });

  router.delete('/lists/items/:item', verifyToken, (req, res) => {
    const user = (req as any).user;
    const itemId = req.params.item;
    updateListItemStatus(user, itemId, 'deleted').then(updatedItem => {
      return res.status(200).json(updatedItem);
    }).catch(e => {
      return handleException(res, e);
    });
  });

  router.post('/lists/items/:item/status', verifyToken, (req, res) => {
    console.log('updating item');
    const user = (req as any).user;
    const itemId = req.params.item;
    const { item } = req.body;
    if (!(user && itemId && item) || itemId !== item._id) {
      return handleException(res, new ValidationError('Missing or incorrect parameters'));
    }
    updateListItem(user, item).then((updatedItem) => {
      return res.status(200).json(updatedItem);
    }).catch((e) => {
      return handleException(res, e);
    });
  });

  // Update list item
  router.post('/lists/items/:item', verifyToken, (req, res) => {
    console.log('updating item');
    const user = (req as any).user;
    const itemId = req.params.item;
    const { item } = req.body;
    if (!(user && itemId && item) || itemId !== item._id) {
      return handleException(res, new ValidationError('Missing or incorrect parameters'));
    }
    updateListItem(user, item).then((updatedItem) => {
      return res.status(200).json(updatedItem);
    }).catch((e) => {
      return handleException(res, e);
    });
  });

  router.delete('/lists/:id/collaborator', verifyToken, (req, res) => {
    // removeFromList
  });

  router.post('/lists/:id/invite', verifyToken, (req, res) => {
    const user = (req as any).user;
    const listId = req.params.id;
    const { invited_id, invited_name } = req.body;
    if (!(user && (invited_id || invited_name ))) {
      return handleException(res, new ValidationError('Missing parameters'));
    }
    inviteToList(user, listId, invited_id, invited_name).then((updatedList) => {
      return res.status(200).json(updatedList);
    }).catch(e => {
      return handleException(res, e);
    });
  });

  router.post('/lists/:id/finish', verifyToken, (req, res) => {
    //
    const user = (req as any).user;
    const listId = req.params.id;
    const { opts } = req.body;
    finishList(user, listId, opts || {}).then((finished) => {
      return res.status(200).json(finished);
    }).catch(e => {
      return handleException(res, e);
    });
  });

  router.post('/lists/accept', verifyToken, (req, res) => {
    const user = (req as any).user;
  });

  router.post('/lists/deny', verifyToken, (req, res) => {
    const user = (req as any).user;
  });

export {
  router
}