import mongoose from 'mongoose';

/**
 * Returns the Pacific (America/Los_Angeles) calendar date string 'YYYY-MM-DD'.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getPacificDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const llmUsageSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastCallAt: {
      type: Date,
      default: null,
    },
    exhausted: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: 'llm_usage',
    timestamps: true,
  },
);

export const LlmUsage = mongoose.models.LlmUsage || mongoose.model('LlmUsage', llmUsageSchema);

/**
 * Default sleep implementation
 * @param {number} ms
 * @returns {Promise<void>}
 */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Atomically reserves 1 request count against the daily Pacific budget.
 *
 * @param {Object} options
 * @param {number} options.budget - Max allowed requests for the day
 * @param {Date} [options.date=new Date()] - Reference date for Pacific day computation
 * @returns {Promise<{ ok: boolean, reason?: string, day: string, count: number, budget: number, lastCallAt?: Date | null }>}
 */
export async function reserveUsage({ budget, date = new Date() }) {
  const day = getPacificDay(date);
  const now = new Date(date);

  // 1. Ensure the day record exists without race conditions
  try {
    await LlmUsage.updateOne(
      { day },
      { $setOnInsert: { count: 0, exhausted: false, lastCallAt: null } },
      { upsert: true },
    );
  } catch (err) {
    if (err && err.code !== 11000) {
      throw err;
    }
  }

  // 2. Atomically increment count if not exhausted and count < budget
  const doc = await LlmUsage.findOneAndUpdate(
    { day, exhausted: false, count: { $lt: budget } },
    { $inc: { count: 1 }, $set: { lastCallAt: now } },
    { returnDocument: 'after' },
  );

  if (!doc) {
    const current = await LlmUsage.findOne({ day }).lean();
    const isExhausted = current?.exhausted ?? false;
    return {
      ok: false,
      reason: isExhausted ? 'EXHAUSTED' : 'BUDGET_REACHED',
      day,
      count: current?.count ?? budget,
      budget,
      lastCallAt: current?.lastCallAt ?? null,
    };
  }

  return {
    ok: true,
    day,
    count: doc.count,
    budget,
    lastCallAt: doc.lastCallAt,
  };
}

/**
 * Throttles execution to ensure at least minIntervalMs has passed since the last call.
 *
 * @param {Object} options
 * @param {number} options.minIntervalMs - Minimum milliseconds between calls
 * @param {Date} [options.date=new Date()]
 * @param {(ms: number) => Promise<void>} [options.sleepFn=defaultSleep]
 * @returns {Promise<number>} Milliseconds waited
 */
export async function enforceThrottle({
  minIntervalMs,
  date = new Date(),
  sleepFn = defaultSleep,
}) {
  if (!minIntervalMs || minIntervalMs <= 0) {
    return 0;
  }

  const day = getPacificDay(date);
  const doc = await LlmUsage.findOne({ day }).lean();
  if (!doc || !doc.lastCallAt) {
    return 0;
  }

  const elapsed = date.getTime() - new Date(doc.lastCallAt).getTime();
  if (elapsed < minIntervalMs) {
    const waitMs = minIntervalMs - elapsed;
    await sleepFn(waitMs);
    return waitMs;
  }

  return 0;
}

/**
 * Marks today's usage as exhausted (e.g. after consecutive 429 errors).
 *
 * @param {Date} [date=new Date()]
 * @returns {Promise<void>}
 */
export async function markExhausted(date = new Date()) {
  const day = getPacificDay(date);
  await LlmUsage.updateOne({ day }, { $set: { exhausted: true } }, { upsert: true });
}

/**
 * Returns current Pacific day usage status.
 *
 * @param {Object} options
 * @param {number} options.budget
 * @param {Date} [options.date=new Date()]
 * @returns {Promise<{ day: string, count: number, budget: number, exhausted: boolean, lastCallAt: Date | null }>}
 */
export async function getUsageStatus({ budget, date = new Date() }) {
  const day = getPacificDay(date);
  const doc = await LlmUsage.findOne({ day }).lean();
  return {
    day,
    count: doc?.count ?? 0,
    budget,
    exhausted: doc?.exhausted ?? false,
    lastCallAt: doc?.lastCallAt ?? null,
  };
}
