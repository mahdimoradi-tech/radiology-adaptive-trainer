import mongoose from 'mongoose';
import { logger } from './logger.js';

/**
 * Connect to MongoDB using Mongoose
 * @param {string} uri
 * @param {import('mongoose').ConnectOptions} [options]
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDb(uri, options = {}) {
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      ...options,
    });
    return conn;
  } catch (err) {
    logger.error({ err, uri }, 'Failed to connect to MongoDB');
    throw err;
  }
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
export async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
