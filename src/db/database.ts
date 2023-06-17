import mongoose from 'mongoose';
const MONGO_URI = process.env.NODE_ENV === 'testing' ? (process.env.MONGO_TEST || 'mongodb://localhost:27017/fake_goose') : process.env.MONGO_DB || 'mongodb://localhost:27017/goose';

export const connect = () => {
  console.log(`Connecting to ${MONGO_URI}`);
  return mongoose.connect(MONGO_URI);
  /*
  if (process.env.NODE_ENV === 'test') {
    mongod = await MongoMemoryServer.create();
    dbUrl = mongo.geUri();
  }
  conn = await mongoose.connect(dbUrl)
  */
};

export const disconnect = async () => {
  try {
    await mongoose.connection.close();
  } catch(err) {
    console.log("Error disconnecting from DB: ", err);
    process.exit(1);
  }
};