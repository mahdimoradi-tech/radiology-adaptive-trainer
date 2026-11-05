import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestionBankModel as DefaultQuestionBankModel } from './model.js';
import { ImageModel as DefaultImageModel } from '../catalog/model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_BANK_APPROVED_EXPORT_PATH = path.resolve(
  __dirname,
  '../../../seed/question-bank.approved.json',
);

/**
 * Export approved questions to JSON file (text only, committed)
 *
 * @param {Object} [options]
 * @param {string} [options.outFile]
 * @param {any} [options.QuestionBankModel]
 * @returns {Promise<{ count: number, path: string }>}
 */
export async function exportBankApproved({
  outFile = DEFAULT_BANK_APPROVED_EXPORT_PATH,
  QuestionBankModel = DefaultQuestionBankModel,
} = {}) {
  // Query ONLY approved questions
  const approvedDocs = await QuestionBankModel.find({ status: 'approved' })
    .sort({ stableId: 1 })
    .lean();

  const cleanItems = approvedDocs.map((doc) => ({
    stableId: doc.stableId,
    imageId: doc.imageId,
    type: doc.type,
    pair: {
      trueClass: doc.pair.trueClass,
      confusedWith: doc.pair.confusedWith,
    },
    bucket: doc.bucket,
    stem: doc.stem,
    options: doc.options.map((opt) => ({
      text: opt.text,
      key: opt.key ?? null,
    })),
    correctIndex: doc.correctIndex,
    rationale: doc.rationale,
    kbRef: doc.kbRef ?? null,
    tags: doc.tags || [],
    status: 'approved',
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
    analysisSummary: doc.analysisSummary,
  }));

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(cleanItems, null, 2) + '\n', 'utf8');

  return {
    count: cleanItems.length,
    path: outFile,
  };
}

/**
 * Import approved questions from JSON file (upsert by stableId, skips missing images)
 *
 * @param {Object} [options]
 * @param {string} [options.inFile]
 * @param {any} [options.QuestionBankModel]
 * @param {any} [options.ImageModel]
 * @returns {Promise<{ totalRead: number, imported: number, skipped: number }>}
 */
export async function importBankApproved({
  inFile = DEFAULT_BANK_APPROVED_EXPORT_PATH,
  QuestionBankModel = DefaultQuestionBankModel,
  ImageModel = DefaultImageModel,
} = {}) {
  if (!fs.existsSync(inFile)) {
    console.warn(`[bank:import] Seed file ${inFile} not found.`);
    return { totalRead: 0, imported: 0, skipped: 0 };
  }

  const raw = fs.readFileSync(inFile, 'utf8');
  let items;
  try {
    items = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in question bank seed file ${inFile}: ${err.message}`, {
      cause: err,
    });
  }

  if (!Array.isArray(items)) {
    throw new Error(`Expected array in question bank seed file ${inFile}`);
  }

  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.imageId || !item.stableId) {
      skipped++;
      continue;
    }

    // Verify image exists in catalog
    const imageExists = await ImageModel.exists({ _id: item.imageId });
    if (!imageExists) {
      console.warn(
        `[bank:import] Warning: Image ID "${item.imageId}" not found in catalog. Skipping item ${item.stableId}.`,
      );
      skipped++;
      continue;
    }

    await QuestionBankModel.findOneAndUpdate(
      { stableId: item.stableId },
      {
        $set: {
          imageId: item.imageId,
          type: item.type,
          pair: item.pair,
          bucket: item.bucket,
          stem: item.stem,
          options: item.options,
          correctIndex: item.correctIndex,
          rationale: item.rationale,
          kbRef: item.kbRef ?? null,
          tags: item.tags || [],
          status: 'approved',
          edited: Boolean(item.edited),
          source: item.source,
          reviewedBy: item.reviewedBy ?? 'importer',
          reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : new Date(),
          note: item.note ?? null,
          history: item.history || [],
          analysisSummary: item.analysisSummary,
        },
        $setOnInsert: {
          stableId: item.stableId,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    imported++;
  }

  return {
    totalRead: items.length,
    imported,
    skipped,
  };
}
