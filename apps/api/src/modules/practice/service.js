import { selectTargetedQuestions, createRng } from '@radiology/engine';
import {
  PracticeSetResidentSchema,
  PracticeSummarySchema,
  PracticeAnswerResponseSchema,
} from '@radiology/contracts';
import { PracticeSetModel } from './model.js';
import { QuestionBankModel } from '../bank/model.js';
import { SessionModel, ResponseModel } from '../sessions/model.js';
import { ImageModel } from '../catalog/model.js';
import { ConflictError, NotFoundError } from '../../lib/httpErrors.js';

// ---------------------------------------------------------------------------
// Pure Adapter: Build Engine History from Finished Sessions
// ---------------------------------------------------------------------------

/**
 * Builds contract-compliant Response[] array for adaptive engine from finished sessions.
 *
 * @param {Array<any>} finishedSessions
 * @returns {import('@radiology/contracts').Response[]}
 */
export function buildEngineHistory(finishedSessions = []) {
  if (!Array.isArray(finishedSessions)) return [];
  /** @type {import('@radiology/contracts').Response[]} */
  const history = [];

  for (const session of finishedSessions) {
    if (!session || (session.status && session.status !== 'finished')) {
      continue;
    }
    const sessionId = String(session._id || session.id || 'sess');

    // Case 1: Session has a responses array attached
    if (Array.isArray(session.responses) && session.responses.length > 0) {
      const qMap = new Map();
      if (Array.isArray(session.questions)) {
        for (const q of session.questions) {
          qMap.set(q.no, q);
        }
      }
      for (const r of session.responses) {
        const q = qMap.get(r.questionNo) || {};
        const trueClass = r.trueClass || q.trueClass;
        const bucket = r.bucket || q.bucket || 'easy';
        if (r.answer && trueClass) {
          history.push({
            sessionId,
            imageId: String(r.imageId || q.imageId || 'img'),
            trueClass,
            answer: r.answer,
            bucket,
          });
        }
      }
    }
    // Case 2: Session questions array has answers embedded directly
    else if (Array.isArray(session.questions)) {
      for (const q of session.questions) {
        if (q.answer && q.trueClass) {
          history.push({
            sessionId,
            imageId: String(q.imageId || 'img'),
            trueClass: q.trueClass,
            answer: q.answer,
            bucket: q.bucket || 'easy',
          });
        }
      }
    }
  }

  return history;
}

// ---------------------------------------------------------------------------
// Projection & Mapping Functions (Zero Leakage Enforcement)
// ---------------------------------------------------------------------------

/**
 * Maps a PracticeSet document and associated questions into resident-safe view.
 * Strictly adheres to Zero Label Leakage rules (ADR 0008).
 *
 * @param {any} setDoc
 * @param {Array<any>} questions
 * @param {Map<string, string>} imageMap - Map from imageId to publicId
 * @returns {import('@radiology/contracts').PracticeSetResident}
 */
export function toPracticeSetResident(setDoc, questions, imageMap) {
  const questionsById = new Map(questions.map((q) => [String(q._id), q]));
  const answersByQuestionId = new Map((setDoc.answers || []).map((a) => [String(a.questionId), a]));

  let correctCount = 0;

  const residentQuestions = setDoc.questionIds.map((qId, index) => {
    const qDoc = questionsById.get(String(qId));
    if (!qDoc) {
      throw new Error(`Question ${qId} referenced in practice set was not found`);
    }

    const perm = setDoc.optionOrder[index];
    const shuffledOptions = perm.map((origIdx) => qDoc.options[origIdx].text);
    const publicId = imageMap.get(String(qDoc.imageId)) || 'opaque_image';
    const ans = answersByQuestionId.get(String(qDoc._id));

    if (ans) {
      if (ans.correct) {
        correctCount += 1;
      }
      const shuffledCorrectIndex = perm.indexOf(qDoc.correctIndex);
      return {
        no: index + 1,
        type: qDoc.type,
        stem: qDoc.stem,
        options: shuffledOptions,
        imageUrl: `/api/images/${publicId}/file`,
        answered: true,
        answer: {
          selectedIndex: ans.shuffledIndex,
          correct: ans.correct,
          correctIndex: shuffledCorrectIndex,
          rationale: qDoc.rationale,
        },
      };
    }

    return {
      no: index + 1,
      type: qDoc.type,
      stem: qDoc.stem,
      options: shuffledOptions,
      imageUrl: `/api/images/${publicId}/file`,
      answered: false,
    };
  });

  const payload = {
    id: String(setDoc._id),
    status: setDoc.status,
    size: setDoc.size,
    answeredCount: (setDoc.answers || []).length,
    correctCount,
    createdAt: setDoc.createdAt instanceof Date ? setDoc.createdAt.toISOString() : setDoc.createdAt,
    completedAt:
      setDoc.completedAt instanceof Date
        ? setDoc.completedAt.toISOString()
        : setDoc.completedAt || null,
    questions: residentQuestions,
  };

  return PracticeSetResidentSchema.parse(payload);
}

/**
 * Maps a PracticeSet document to summary list projection.
 *
 * @param {any} setDoc
 * @returns {import('@radiology/contracts').PracticeSummary}
 */
export function toPracticeSummary(setDoc) {
  const correctCount = (setDoc.answers || []).filter((a) => a.correct).length;
  const payload = {
    id: String(setDoc._id),
    status: setDoc.status,
    size: setDoc.size,
    answeredCount: (setDoc.answers || []).length,
    correctCount,
    createdAt: setDoc.createdAt instanceof Date ? setDoc.createdAt.toISOString() : setDoc.createdAt,
    completedAt:
      setDoc.completedAt instanceof Date
        ? setDoc.completedAt.toISOString()
        : setDoc.completedAt || null,
  };

  return PracticeSummarySchema.parse(payload);
}

// ---------------------------------------------------------------------------
// Service Methods
// ---------------------------------------------------------------------------

/**
 * Creates a new targeted practice set for the resident.
 *
 * @param {Object} params
 * @param {string | import('mongoose').Types.ObjectId} params.userId
 * @param {number} [params.size=10]
 * @param {number|string} [params.seed]
 * @returns {Promise<import('@radiology/contracts').PracticeSetResident>}
 */
export async function createPracticeSet({ userId, size = 10, seed }) {
  // 1. Check history: resident must have at least one finished session
  const finishedSessions = await SessionModel.find({ userId, status: 'finished' }).lean();
  if (!finishedSessions || finishedSessions.length === 0) {
    throw new ConflictError('No finished session history found', 'NO_HISTORY');
  }

  // Load responses for finished sessions to assemble engine history
  const sessionIds = finishedSessions.map((s) => s._id);
  const responses = await ResponseModel.find({ sessionId: { $in: sessionIds } }).lean();

  const sessionsWithResponses = finishedSessions.map((s) => ({
    ...s,
    responses: responses.filter((r) => String(r.sessionId) === String(s._id)),
  }));
  const history = buildEngineHistory(sessionsWithResponses);

  // 2. Collect answered question IDs across all earlier practice sets for this resident
  const pastSets = await PracticeSetModel.find({ userId }).select('answers.questionId').lean();
  const answeredQuestionIds = new Set(
    pastSets.flatMap((s) => (s.answers || []).map((a) => String(a.questionId))),
  );

  // 3. Load approved questions from QuestionBank
  const approvedQuestions = await QuestionBankModel.find({ status: 'approved' }).lean();
  const availableQuestions = approvedQuestions.filter(
    (q) => !answeredQuestionIds.has(String(q._id)),
  );

  if (availableQuestions.length === 0) {
    throw new ConflictError('No approved practice questions available', 'PRACTICE_POOL_EXHAUSTED');
  }

  const n = Math.min(size, availableQuestions.length);

  // 4. Adapt questions to engine format and execute targeted selection
  const bankForEngine = approvedQuestions.map((q) => ({
    id: String(q._id),
    imageId: q.imageId,
    type: q.type,
    pair: q.pair,
    bucket: q.bucket,
    status: q.status,
  }));

  const targetSeed = seed ?? Date.now();
  const { questionIds: selectedIds, plan } = selectTargetedQuestions(
    bankForEngine,
    history,
    { seed: targetSeed },
    n,
    Array.from(answeredQuestionIds),
  );

  const selectedQuestions = selectedIds
    .map((id) => approvedQuestions.find((q) => String(q._id) === id))
    .filter(Boolean);

  // 5. Build public image URLs mapping
  const imageIds = selectedQuestions.map((q) => q.imageId);
  const images = await ImageModel.find({ _id: { $in: imageIds } }).lean();
  const imageMap = new Map(images.map((img) => [String(img._id), img.publicId]));
  const publicIds = selectedQuestions.map((q) => imageMap.get(String(q.imageId))).filter(Boolean);

  // 6. Build optionOrder permutations using deterministic PRNG
  const optionOrder = selectedQuestions.map((_, idx) => {
    const rng = createRng(`${targetSeed}-shuffle-${idx}`);
    return rng.shuffle([0, 1, 2, 3]);
  });

  // 7. Save PracticeSet document
  const practiceSetDoc = await PracticeSetModel.create({
    userId,
    status: 'in_progress',
    size: selectedQuestions.length,
    questionIds: selectedQuestions.map((q) => q._id),
    publicIds,
    optionOrder,
    plan,
    answers: [],
  });

  return toPracticeSetResident(practiceSetDoc, selectedQuestions, imageMap);
}

/**
 * Lists practice sets for the resident (newest first).
 *
 * @param {Object} params
 * @param {string | import('mongoose').Types.ObjectId} params.userId
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=10]
 */
export async function getPracticeSets({ userId, page = 1, pageSize = 10 }) {
  const skip = (page - 1) * pageSize;
  const [sets, total] = await Promise.all([
    PracticeSetModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    PracticeSetModel.countDocuments({ userId }),
  ]);

  return {
    items: sets.map(toPracticeSummary),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

/**
 * Retrieves a single practice set by ID for resident.
 *
 * @param {Object} params
 * @param {string | import('mongoose').Types.ObjectId} params.userId
 * @param {string} params.setId
 * @returns {Promise<import('@radiology/contracts').PracticeSetResident>}
 */
export async function getPracticeSetById({ userId, setId }) {
  const practiceDoc = await PracticeSetModel.findOne({ _id: setId, userId }).lean();
  if (!practiceDoc) {
    throw new NotFoundError('Practice set not found');
  }

  const questions = await QuestionBankModel.find({
    _id: { $in: practiceDoc.questionIds },
  }).lean();

  const imageIds = questions.map((q) => q.imageId);
  const images = await ImageModel.find({ _id: { $in: imageIds } }).lean();
  const imageMap = new Map(images.map((img) => [String(img._id), img.publicId]));

  return toPracticeSetResident(practiceDoc, questions, imageMap);
}

/**
 * Records an answer for a specific question in an in-progress practice set.
 *
 * @param {Object} params
 * @param {string | import('mongoose').Types.ObjectId} params.userId
 * @param {string} params.setId
 * @param {number} params.questionNo - 1-based question number
 * @param {number} params.selectedIndex - Shuffled option index selected by resident
 * @param {number} [params.timeMs]
 * @returns {Promise<import('@radiology/contracts').PracticeAnswerResponse>}
 */
export async function answerPracticeQuestion({ userId, setId, questionNo, selectedIndex, timeMs }) {
  const practiceDoc = await PracticeSetModel.findOne({ _id: setId, userId });
  if (!practiceDoc) {
    throw new NotFoundError('Practice set not found');
  }

  if (practiceDoc.status !== 'in_progress') {
    throw new ConflictError('Practice set is already completed', 'SET_COMPLETED');
  }

  if (questionNo < 1 || questionNo > practiceDoc.size) {
    throw new NotFoundError('Question not found');
  }

  const qIdx = questionNo - 1;
  const questionId = practiceDoc.questionIds[qIdx];

  const alreadyAnswered = practiceDoc.answers.some(
    (a) => String(a.questionId) === String(questionId),
  );
  if (alreadyAnswered) {
    throw new ConflictError('Question already answered', 'ALREADY_ANSWERED');
  }

  const questionDoc = await QuestionBankModel.findById(questionId).lean();
  if (!questionDoc) {
    throw new NotFoundError('Question not found in question bank');
  }

  const perm = practiceDoc.optionOrder[qIdx];
  const originalIndex = perm[selectedIndex];
  const isCorrect = originalIndex === questionDoc.correctIndex;
  const shuffledCorrectIndex = perm.indexOf(questionDoc.correctIndex);

  practiceDoc.answers.push({
    questionId,
    selectedIndex: originalIndex,
    shuffledIndex: selectedIndex,
    correct: isCorrect,
    timeMs,
    answeredAt: new Date(),
  });

  const isCompleted = practiceDoc.answers.length === practiceDoc.size;
  if (isCompleted) {
    practiceDoc.status = 'completed';
    practiceDoc.completedAt = new Date();
  }

  await practiceDoc.save();

  const response = {
    correct: isCorrect,
    correctIndex: shuffledCorrectIndex,
    rationale: questionDoc.rationale,
    completed: isCompleted,
  };

  return PracticeAnswerResponseSchema.parse(response);
}
