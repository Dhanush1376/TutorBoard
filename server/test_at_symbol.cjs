
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const uri = "mongodb+srv://tutorboardUser:Tutor@12345@cluster0.obcbi5q.mongodb.net/tutorboard?retryWrites=true&w=majority";

console.log('--- DB Connection Test (Hardcoded Password) ---');

mongoose.connect(uri)
  .then(() => {
    console.log('SUCCESS: Connected with @');
    process.exit(0);
  })
  .catch(err => {
    console.error('FAILURE with @:', err.message);
    process.exit(1);
  });
