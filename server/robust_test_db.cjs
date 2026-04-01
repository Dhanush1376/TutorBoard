
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.MONGODB_URI;

console.log('--- DB Connection Test ---');
console.log('URI:', uri ? uri.replace(/:([^@]+)@/, ':****@') : 'MISSING');

mongoose.connect(uri)
  .then(() => {
    console.log('SUCCESS: Connected to DB');
    process.exit(0);
  })
  .catch(err => {
    console.error('FAILURE: Could not connect to DB');
    console.error('NAME:', err.name);
    console.error('MESSAGE:', err.message);
    if (err.reason) console.error('REASON:', err.reason);
    process.exit(1);
  });
