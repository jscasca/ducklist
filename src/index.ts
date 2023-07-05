/**
 * Required External Modules
 */
 import * as dotenv from "dotenv";
 import express from "express";
 import cors from "cors";
 import helmet from "helmet";
 import { connect } from './db/database';

 import { router as ListRouter } from './routing/lists';
 import { router as SettingsRouter } from './routing/settings';
 import { router as LoginRouter } from './routing/login';

 import * as routes from './routes';
 
 dotenv.config();

/**
 * App Variables
 */
 if (!process.env.PORT) {
  process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);

const app = express();

/**
 *  App Configuration
 */
const corsOptions = {
  // origin: 'http://localhost:3000'
  origin: '*'
};
 app.use(helmet());
 app.use(cors(corsOptions));
 app.use(express.json());

 app.use('/lists', ListRouter);
 app.use('/settings', SettingsRouter)
//  app.use('/login')

//  routes.register(app as express.Application);

/**
 * Server Activation
 */
connect().then(() => {
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
});

process.on('SIGINT', () => {
  console.log('closing gracefully');
  process.exit(0);
});

export default app;