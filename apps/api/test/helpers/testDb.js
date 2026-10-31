import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

/**
 * Setup isolated test database for a test file
 * @param {{ uri?: string }} [options]
 */
export async function setupTestDb(options = {}) {
  const baseUri = options.uri || process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017';
  const dbName = `radiology_test_${randomUUID().replace(/-/g, '')}`;

  const parsedUrl = new URL(baseUri);
  parsedUrl.pathname = `/${dbName}`;
  const uri = parsedUrl.toString();

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
  } catch (err) {
    throw new Error(`Start the MongoDB service (failed to connect to ${uri}): ${err.message}`, {
      cause: err,
    });
  }

  return {
    uri,
    dbName,
    /**
     * Clear all documents in all collections
     */
    async clearCollections() {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        const collections = await mongoose.connection.db.collections();
        for (const collection of collections) {
          await collection.deleteMany({});
        }
      }
    },
    /**
     * Drop the entire test database and disconnect
     */
    async teardown() {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        await mongoose.connection.db.dropDatabase();
      }
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    },
  };
}
