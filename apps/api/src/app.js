import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createHttpLogger, logger as defaultLogger } from './lib/logger.js';
import { jsonOnly } from './middleware/jsonOnly.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createHealthRouter } from './modules/health/routes.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createCatalogRouter } from './modules/catalog/routes.js';
import { createImagesRouter } from './modules/images/routes.js';
import { createSessionsRouter } from './modules/sessions/routes.js';
import { createAdminSessionsRouter } from './modules/sessions/admin.routes.js';
import { createAdminBankRouter } from './modules/bank/routes.js';
import { createLlmRouter } from './modules/llm/routes.js';
import { createPracticeRouter } from './modules/practice/routes.js';

/**
 * Express application factory
 * @param {{ config: import('./config/env.js').loadEnv extends () => infer T ? T : any, logger?: import('pino').Logger }} options
 */
export function createApp({ config, logger = defaultLogger }) {
  const app = express();

  // Security headers via Helmet
  app.use(helmet());

  // HTTP Request logger
  app.use(createHttpLogger(logger));

  // Optional CORS header handling
  if (config.CORS_ORIGIN) {
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', config.CORS_ORIGIN);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });
  }

  // Parse JSON payloads up to 100kb
  app.use(express.json({ limit: '100kb' }));

  // Parse cookies
  app.use(cookieParser());

  // Enforce application/json for state-changing routes
  app.use(jsonOnly);

  // Mount API router
  const apiRouter = express.Router();
  apiRouter.use(createHealthRouter());
  apiRouter.use(createAuthRouter(config));
  apiRouter.use(createCatalogRouter(config));
  apiRouter.use(createImagesRouter(config));
  apiRouter.use(createSessionsRouter(config));
  apiRouter.use(createAdminSessionsRouter(config));
  apiRouter.use(createAdminBankRouter(config));
  apiRouter.use(createLlmRouter(config));
  apiRouter.use(createPracticeRouter(config));

  app.use('/api', apiRouter);

  // 404 handler
  app.use(notFound);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
