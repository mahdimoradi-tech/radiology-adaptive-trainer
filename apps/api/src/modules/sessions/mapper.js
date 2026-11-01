/**
 * Map internal session question and optional resident response to secure public DTO.
 * Strictly redacts trueClass, bucket, difficulty, confusedWith, source, internal imageId.
 *
 * @param {any} question
 * @param {any} [response]
 * @returns {import('@radiology/contracts').QuestionPublic}
 */
export function toQuestionPublic(question, response) {
  return {
    no: question.no,
    imageUrl: `/api/images/${question.publicId}/file`,
    answered: Boolean(response),
    answer: response ? response.answer : null,
  };
}

/**
 * Map Session document and responses to SessionPublic projection.
 *
 * @param {any} session
 * @param {Array<any>} [responses=[]]
 * @returns {import('@radiology/contracts').SessionPublic}
 */
export function toSessionPublic(session, responses = []) {
  const responseMap = new Map();
  for (const r of responses) {
    responseMap.set(r.questionNo, r);
  }

  const questions = (session.questions || []).map((q) =>
    toQuestionPublic(q, responseMap.get(q.no)),
  );

  return {
    id: String(session._id),
    index: session.index,
    kind: session.kind,
    status: session.status,
    size: session.size,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    answeredCount: responses.length,
    questions,
  };
}

/**
 * Map Session document to compact SessionSummary projection for session history listings.
 *
 * @param {any} session
 * @returns {import('@radiology/contracts').SessionSummary}
 */
export function toSessionSummary(session) {
  return {
    id: String(session._id),
    index: session.index,
    kind: session.kind,
    status: session.status,
    size: session.size,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    answeredCount: session.metrics?.answeredCount ?? 0,
    overallAccuracy: session.metrics?.overall?.accuracy ?? null,
  };
}
