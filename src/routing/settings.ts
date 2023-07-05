import { Express, Request, Response, Router} from 'express';
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import { pipe } from 'fp-ts/lib/function';
import { verifyToken } from '../middleware/auth';
import { HttpError } from '../httpError';
import { getSettings, setPrivacy, updateSettingsList } from '../middleware/settings';

const router = Router();

router.get('/', verifyToken, (req, res) => {
  const user = (req as any).user;
  pipe(
    getSettings(user),
    TE.fold(
      (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
      (settings: any) => T.of(res.status(200).json(settings))
    )
  )();
});

router.put('/', verifyToken, (req, res) => {
  const user = (req as any).user;
  pipe(
    getSettings(user),
    TE.fold(
      (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
      (settings: any) => T.of(res.status(200).json(settings))
    )
  )();
});

router.put('/privacy/status', verifyToken, (req, res) => {
  const user = (req as any).user;
  const { status } = req.body;
  pipe(
    setPrivacy(user, status),
    TE.fold(
      (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
      (settings: any) => T.of(res.status(200).json(settings))
    )
  )();
});

router.post('/privacy/updates/:list', verifyToken, (req, res) => {
  const user = (req as any).user;
  const list = req.params.list;
  const { updates } = req.body;
  pipe(
    updateSettingsList(user, list, updates),
    TE.fold(
      (e: HttpError) => T.of(res.status(e.code()).send(e.message())),
      (settings: any) => T.of(res.status(200).json(settings))
    )
  )();

});

export {
  router
}