import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import mongoose from 'mongoose';

const config = loadEnv();
const app = createApp({ config });

async function start() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info({ uri: config.MONGODB_URI }, 'Connected to MongoDB');

    app.listen(config.PORT, () => {
      logger.info(
        { port: config.PORT },
        `Radiology API server listening on http://127.0.0.1:${config.PORT}`,
      );
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start API server');
    process.exit(1);
  }
}

// Only start listening if run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  start();
}
