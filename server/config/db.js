const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI не задан в .env');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('MongoDB подключена');
}

module.exports = connectDB;