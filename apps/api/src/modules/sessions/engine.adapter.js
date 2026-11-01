import { EngineConfigSchema } from '@radiology/contracts';
import {
  selectFirstTest,
  selectNextTest,
  confusionMatrix,
  rates,
  classWeights,
  isMastered,
} from '@radiology/engine';
import { ImageModel } from '../catalog/model.js';
import { SessionModel, ResponseModel } from './model.js';

// Re-export pure engine math helpers so engine.adapter is the ONLY file importing @radiology/engine
export { confusionMatrix, rates, classWeights, isMastered };

/**
 * Load entire image pool from database into engine-compatible format with publicId preserved.
 *
 * @returns {Promise<Array<import('@radiology/contracts').ImageMeta & { publicId: string }>>}
 */
export async function loadPool() {
  const images = await ImageModel.find().lean();
  return images.map((img) => ({
    id: img._id,
    trueClass: img.trueClass,
    difficulty: img.difficulty,
    bucket: img.bucket,
    confusedWith: img.confusedWith,
    publicId: img.publicId,
  }));
}

/**
 * Load historical answered responses from finished sessions for a given resident.
 *
 * @param {string | import('mongoose').Types.ObjectId} userId
 * @returns {Promise<import('@radiology/contracts').Response[]>}
 */
export async function loadHistory(userId) {
  const finishedSessions = await SessionModel.find({ userId, status: 'finished' }, '_id').lean();
  if (!finishedSessions || finishedSessions.length === 0) {
    return [];
  }

  const sessionIds = finishedSessions.map((s) => s._id);
  const responses = await ResponseModel.find({ sessionId: { $in: sessionIds } }).lean();

  return responses.map((r) => ({
    sessionId: String(r.sessionId),
    imageId: r.imageId,
    trueClass: r.trueClass,
    answer: r.answer,
    bucket: r.bucket,
  }));
}

/**
 * Execute adaptive question selection engine (first test baseline or adaptive next test).
 *
 * @param {Object} params
 * @param {Array<import('@radiology/contracts').ImageMeta>} params.pool
 * @param {Array<import('@radiology/contracts').Response>} [params.history=[]]
 * @param {number} [params.size=60]
 * @param {boolean} [params.allowRepeats=false]
 * @param {string | number} [params.seed]
 * @param {string} [params.userId]
 * @param {number} [params.index]
 * @returns {{ imageIds: string[], plan: any }}
 */
export function buildTest({
  pool,
  history = [],
  size = 60,
  allowRepeats = false,
  seed,
  userId,
  index,
}) {
  const deterministicSeed = seed ?? (userId && index ? `${userId}:${index}` : undefined);
  const config = EngineConfigSchema.parse({
    totalQuestions: size,
    allowRepeats,
    seed: deterministicSeed,
  });

  const imagePool = pool.map((img) => ({
    id: img.id,
    trueClass: img.trueClass,
    difficulty: img.difficulty,
    bucket: img.bucket,
    confusedWith: img.confusedWith,
  }));

  if (history.length === 0) {
    return selectFirstTest(imagePool, config);
  }

  return selectNextTest(imagePool, history, config);
}
