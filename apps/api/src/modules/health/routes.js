import { Router } from 'express';
import mongoose from 'mongoose';
import { CONTRACTS_VERSION } from '@radiology/contracts';

/**
 * Create health module router
 * @returns {Router}
 */
export function createHealthRouter() {
  const router = Router();

  router.get('/health', async (_req, res) => {
    let dbStatus = 'down';

    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.connection.db) {
          await mongoose.connection.db.admin().ping();
          dbStatus = 'up';
        }
      } catch {
        dbStatus = 'down';
      }
    }

    res.json({
      data: {
        status: 'ok',
        db: dbStatus,
        version: CONTRACTS_VERSION,
      },
    });
  });

  return router;
}
