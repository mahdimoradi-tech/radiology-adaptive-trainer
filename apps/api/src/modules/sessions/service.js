import { ConflictError, NotFoundError, HttpError } from '../../lib/httpErrors.js';
import { SessionModel, ResponseModel } from './model.js';
import { UserModel } from '../auth/model.js';
import { loadPool, loadHistory, buildTest } from './engine.adapter.js';
import { buildReport, buildProgress } from './metrics.js';
import { toSessionPublic, toSessionSummary } from './mapper.js';

/**
 * Service orchestrating training session lifecycle, question answering, metrics and progress.
 */
export const sessionService = {
  /**
   * Create a new training session (baseline or adaptive).
   *
   * @param {Object} params
   * @param {string | import('mongoose').Types.ObjectId} params.userId
   * @param {number} [params.size=60]
   * @param {boolean} [params.allowRepeats=false]
   * @returns {Promise<import('@radiology/contracts').SessionPublic>}
   */
  async createSession({ userId, size = 60, allowRepeats = false }) {
    // 1. Ensure at most one in_progress session exists per user
    const active = await SessionModel.findOne({ userId, status: 'in_progress' });
    if (active) {
      throw new ConflictError('A session is already in progress', 'SESSION_IN_PROGRESS', {
        sessionId: String(active._id),
      });
    }

    // 2. Determine next session index
    const lastSession = await SessionModel.findOne({ userId }).sort({ index: -1 }).select('index');
    const index = lastSession ? lastSession.index + 1 : 1;

    // 3. Load catalog pool and user response history from finished sessions
    const [pool, history] = await Promise.all([loadPool(), loadHistory(userId)]);

    const kind = history.length === 0 ? 'baseline' : 'adaptive';

    // 4. Run question selection engine
    const testResult = buildTest({
      pool,
      history,
      size,
      allowRepeats,
      userId: String(userId),
      index,
    });

    // 5. Handle pool deficit
    if (testResult.plan.deficit > 0) {
      throw new ConflictError('Not enough images in pool to fulfill request', 'POOL_EXHAUSTED', {
        requested: size,
        available: testResult.imageIds.length,
      });
    }

    // 6. Map selected image IDs to question records with publicIds
    const poolMap = new Map(pool.map((img) => [img.id, img]));
    const questions = testResult.imageIds.map((id, i) => {
      const img = poolMap.get(id);
      return {
        no: i + 1,
        imageId: img.id,
        publicId: img.publicId,
        trueClass: img.trueClass,
        bucket: img.bucket,
        difficulty: img.difficulty,
        confusedWith: img.confusedWith,
      };
    });

    // 7. Save session document
    try {
      const session = await SessionModel.create({
        userId,
        index,
        kind,
        status: 'in_progress',
        size,
        configSnapshot: {
          totalQuestions: size,
          allowRepeats,
          seed: `${userId}:${index}`,
        },
        plan: testResult.plan,
        questions,
        startedAt: new Date(),
      });

      return toSessionPublic(session, []);
    } catch (err) {
      if (err?.code === 11000) {
        throw new ConflictError('A session is already in progress', 'SESSION_IN_PROGRESS');
      }
      throw err;
    }
  },

  /**
   * List sessions belonging to user with pagination.
   *
   * @param {Object} params
   * @param {string | import('mongoose').Types.ObjectId} params.userId
   * @param {number} [params.page=1]
   * @param {number} [params.pageSize=20]
   */
  async getSessions({ userId, page = 1, pageSize = 20 }) {
    const filter = { userId };
    const [total, sessions] = await Promise.all([
      SessionModel.countDocuments(filter),
      SessionModel.find(filter)
        .sort({ index: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const items = sessions.map(toSessionSummary);

    return {
      items,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Get single session by ID (must belong to calling resident).
   *
   * @param {Object} params
   * @param {string | import('mongoose').Types.ObjectId} params.userId
   * @param {string} params.sessionId
   * @returns {Promise<import('@radiology/contracts').SessionPublic>}
   */
  async getSessionById({ userId, sessionId }) {
    const session = await SessionModel.findOne({ _id: sessionId, userId });
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    const responses = await ResponseModel.find({ sessionId: session._id }).lean();
    return toSessionPublic(session, responses);
  },

  /**
   * Record answer for a question in an in-progress session.
   *
   * @param {Object} params
   * @param {string | import('mongoose').Types.ObjectId} params.userId
   * @param {string} params.sessionId
   * @param {number} params.questionNo
   * @param {import('@radiology/contracts').ClassId} params.answer
   * @param {number} [params.timeMs]
   */
  async answerQuestion({ userId, sessionId, questionNo, answer, timeMs }) {
    const session = await SessionModel.findOne({ _id: sessionId, userId });
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    if (session.status !== 'in_progress') {
      throw new ConflictError('Session is not in progress', 'SESSION_NOT_IN_PROGRESS');
    }

    const question = session.questions.find((q) => q.no === questionNo);
    if (!question) {
      throw new HttpError(404, 'QUESTION_NOT_FOUND', 'Question not found');
    }

    const correct = question.trueClass === answer;

    await ResponseModel.findOneAndUpdate(
      { sessionId: session._id, questionNo },
      {
        $set: {
          userId,
          imageId: question.imageId,
          trueClass: question.trueClass,
          answer,
          bucket: question.bucket,
          correct,
          answeredAt: new Date(),
          timeMs: timeMs ?? null,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    return { no: questionNo, answered: true };
  },

  /**
   * Finish an in-progress session, compute metrics, and return final report.
   *
   * @param {Object} params
   * @param {string | import('mongoose').Types.ObjectId} params.userId
   * @param {string} params.sessionId
   * @returns {Promise<import('@radiology/contracts').SessionReport>}
   */
  async finishSession({ userId, sessionId }) {
    const session = await SessionModel.findOne({ _id: sessionId, userId });
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    if (session.status === 'finished') {
      throw new ConflictError('Session has already been finished', 'SESSION_ALREADY_FINISHED');
    }

    const responses = await ResponseModel.find({ sessionId: session._id }).lean();
    const report = buildReport({ session, responses });

    // Store metrics without redundant review items in session document
    const { review: _review, ...metricsToStore } = report;

    const updated = await SessionModel.findOneAndUpdate(
      { _id: session._id, status: 'in_progress' },
      {
        $set: {
          status: 'finished',
          finishedAt: new Date(),
          metrics: metricsToStore,
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) {
      throw new ConflictError('Session has already been finished', 'SESSION_ALREADY_FINISHED');
    }

    return report;
  },

  /**
   * Retrieve report of a finished session.
   *
   * @param {Object} params
   * @param {string | import('mongoose').Types.ObjectId} [params.userId]
   * @param {string} params.sessionId
   * @param {boolean} [params.isInstructor=false]
   * @returns {Promise<import('@radiology/contracts').SessionReport>}
   */
  async getSessionReport({ userId, sessionId, isInstructor = false }) {
    const filter = isInstructor ? { _id: sessionId } : { _id: sessionId, userId };
    const session = await SessionModel.findOne(filter);

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    if (session.status !== 'finished') {
      throw new ConflictError('Session is not finished yet', 'SESSION_NOT_FINISHED');
    }

    const responses = await ResponseModel.find({ sessionId: session._id }).lean();
    return buildReport({ session, responses });
  },

  /**
   * Get progress trajectory for a resident.
   *
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @returns {Promise<import('@radiology/contracts').Progress>}
   */
  async getProgress(userId) {
    const finishedSessions = await SessionModel.find({ userId, status: 'finished' }).sort({
      index: 1,
    });
    const sessionIds = finishedSessions.map((s) => s._id);
    const allFinishedResponses = await ResponseModel.find({
      sessionId: { $in: sessionIds },
    }).lean();

    return buildProgress({ finishedSessions, allFinishedResponses });
  },

  /**
   * List resident students with progress metrics for instructor dashboard.
   *
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.pageSize=20]
   */
  async getAdminResidents({ page = 1, pageSize = 20 }) {
    const filter = { role: 'resident' };
    const [total, residents] = await Promise.all([
      UserModel.countDocuments(filter),
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const items = await Promise.all(
      residents.map(async (u) => {
        const [lastFinishedSession, finishedCount, lastActive] = await Promise.all([
          SessionModel.findOne({ userId: u._id, status: 'finished' }).sort({ index: -1 }).lean(),
          SessionModel.countDocuments({ userId: u._id, status: 'finished' }),
          ResponseModel.findOne({ userId: u._id }).sort({ answeredAt: -1 }).select('answeredAt'),
        ]);

        return {
          id: String(u._id),
          email: u.email,
          displayName: u.displayName,
          sessionsFinished: finishedCount,
          lastAccuracy: lastFinishedSession?.metrics?.overall?.accuracy ?? null,
          lastActiveAt: lastActive?.answeredAt ?? lastFinishedSession?.finishedAt ?? null,
          createdAt: u.createdAt,
        };
      }),
    );

    return {
      items,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },
};
