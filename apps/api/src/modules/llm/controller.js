import mongoose from 'mongoose';
import { NotFoundError, ConflictError } from '../../lib/httpErrors.js';
import { SessionModel, ResponseModel } from '../sessions/model.js';
import { getSessionExplanations, getSessionNarrative } from './llm.service.js';
import { getUsageStatus } from './budget.js';
import { countCacheEntries } from './cache.js';

/**
 * Creates controller for LLM endpoints
 * @param {any} config
 */
export function createLlmController(config) {
  return {
    /**
     * POST /api/sessions/:id/explanations
     * Returns explanations for wrong questions of a completed session.
     */
    async getExplanations(req, res, next) {
      try {
        const { id } = req.params;
        const lang = req.body?.lang || 'fa';

        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new NotFoundError('Session not found');
        }

        const session = await SessionModel.findOne({
          _id: id,
          userId: req.user._id,
        }).lean();

        if (!session) {
          throw new NotFoundError('Session not found');
        }

        if (session.status !== 'finished') {
          throw new ConflictError(
            'Cannot generate explanations for an unfinished session',
            'SESSION_NOT_FINISHED',
          );
        }

        const responses = await ResponseModel.find({ sessionId: session._id }).lean();

        const result = await getSessionExplanations({
          session,
          responses,
          lang,
        });

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/sessions/:id/report-narrative
     * Returns a personalized AI pedagogical narrative for a completed session.
     */
    async getReportNarrative(req, res, next) {
      try {
        const { id } = req.params;
        const lang = req.body?.lang || 'fa';

        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new NotFoundError('Session not found');
        }

        const session = await SessionModel.findOne({
          _id: id,
          userId: req.user._id,
        }).lean();

        if (!session) {
          throw new NotFoundError('Session not found');
        }

        if (session.status !== 'finished') {
          throw new ConflictError(
            'Cannot generate report narrative for an unfinished session',
            'SESSION_NOT_FINISHED',
          );
        }

        // Build rawStats from session.report
        const report = session.report || {};
        const rawStats = {
          totalQuestions: report.summary?.total ?? 0,
          correctCount: report.summary?.correct ?? 0,
          overallAccuracyPercent: Math.round((report.summary?.accuracy ?? 0) * 100),
          classMetrics: report.classMetrics || [],
          topConfusions: report.topConfusions || [],
          trend: 'stable',
        };

        const result = await getSessionNarrative({
          session,
          rawStats,
          lang,
          env: config,
        });

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/admin/llm/status
     * Instructor status check for model, today's budget and cache counts.
     */
    async getAdminStatus(_req, res, next) {
      try {
        const budget = config.LLM_DAILY_REQUEST_BUDGET;
        const usage = await getUsageStatus({ budget });
        const cacheCounts = await countCacheEntries();

        res.status(200).json({
          mode: config.LLM_MODE,
          model: config.GEMINI_MODEL,
          today: {
            count: usage.count,
            budget: usage.budget,
            exhausted: usage.exhausted,
            lastCallAt: usage.lastCallAt ? new Date(usage.lastCallAt).toISOString() : null,
          },
          cache: {
            totalEntries: cacheCounts.totalEntries,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  };
}
