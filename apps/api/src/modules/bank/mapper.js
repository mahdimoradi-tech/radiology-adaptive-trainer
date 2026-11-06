import { computePublicId } from '../catalog/publicId.js';

/**
 * Maps a QuestionBank Mongoose document to QuestionBankAdmin DTO
 * @param {any} doc
 * @param {Object} [options]
 * @param {Map<string, string>} [options.publicIdMap]
 * @param {string} [options.salt]
 * @returns {any}
 */
export function toAdminQuestionDto(doc, options = {}) {
  const { publicIdMap, salt } = options;
  const imageId = doc.imageId;
  let publicId = publicIdMap?.get(imageId);
  if (!publicId && salt && imageId) {
    try {
      publicId = computePublicId(imageId, salt);
    } catch {
      publicId = undefined;
    }
  }

  const imageUrl = publicId ? `/api/images/${publicId}/file` : undefined;

  return {
    id: doc._id.toString(),
    stableId: doc.stableId,
    imageId: doc.imageId,
    type: doc.type,
    pair: {
      trueClass: doc.pair.trueClass,
      confusedWith: doc.pair.confusedWith,
    },
    bucket: doc.bucket,
    stem: doc.stem,
    options: (doc.options || []).map((opt) => ({
      text: opt.text,
      key: opt.key ?? null,
    })),
    correctIndex: doc.correctIndex,
    rationale: doc.rationale,
    kbRef: doc.kbRef ?? null,
    tags: doc.tags || [],
    status: doc.status,
    edited: Boolean(doc.edited),
    source: doc.source,
    reviewedBy: doc.reviewedBy ?? null,
    reviewedAt: doc.reviewedAt ? new Date(doc.reviewedAt).toISOString() : null,
    note: doc.note ?? null,
    history: (doc.history || []).map((h) => ({
      action: h.action,
      by: h.by,
      at: new Date(h.at).toISOString(),
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changes: h.changes,
      note: h.note ?? null,
    })),
    imageUrl,
    analysisSummary: doc.analysisSummary,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}
