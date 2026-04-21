import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const usages = await mongoose.connection.collection('usagelogs').find({}).sort({timestamp: -1}).limit(5).toArray();
    console.log(JSON.stringify(usages, null, 2));
    process.exit(0);
  });
