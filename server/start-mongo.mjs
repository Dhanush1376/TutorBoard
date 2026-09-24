import { MongoMemoryServer } from 'mongodb-memory-server';

(async () => {
  try {
    const mongod = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'test'
      }
    });
    console.log(`MongoDB Memory Server running at ${mongod.getUri()}`);
    
    // Keep alive
    setInterval(() => {}, 1000);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
