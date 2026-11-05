import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImageAnalysisResultSchema } from '@radiology/contracts';
import {
  ImageAnalysisModel as DefaultImageAnalysisModel,
  AnalysisValidationModel as DefaultAnalysisValidationModel,
  AnalysisBatchModel as DefaultAnalysisBatchModel,
} from './model.js';
import { ImageModel as DefaultImageModel } from '../catalog/model.js';
import { validateAnalysis } from './validate.js';
import { getUsageStatus } from '../llm/budget.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_ANALYSES_EXPORT_PATH = path.resolve(
  __dirname,
  '../../../seed/image-analyses.json',
);

/**
 * Validates all images that have both run A and run B analyses recorded.
 *
 * @param {Object} [deps]
 * @param {string} [deps.promptVersion='v1']
 * @param {any} [deps.ImageModel]
 * @param {any} [deps.ImageAnalysisModel]
 * @param {any} [deps.AnalysisValidationModel]
 * @returns {Promise<{ totalValidated: number, passedCount: number, rejectedCount: number, reasonsTally: Record<string, number> }>}
 */
export async function validateAllAnalyses({
  promptVersion = 'v1',
  ImageModel = DefaultImageModel,
  ImageAnalysisModel = DefaultImageAnalysisModel,
  AnalysisValidationModel = DefaultAnalysisValidationModel,
} = {}) {
  // Find all distinct imageIds having analyses with this promptVersion
  const imageIds = await ImageAnalysisModel.distinct('imageId', { promptVersion });

  let totalValidated = 0;
  let passedCount = 0;
  let rejectedCount = 0;
  /** @type {Record<string, number>} */
  const reasonsTally = {};

  for (const imageId of imageIds) {
    const [docA, docB, imgDoc] = await Promise.all([
      ImageAnalysisModel.findOne({ imageId, run: 'A', promptVersion }).lean(),
      ImageAnalysisModel.findOne({ imageId, run: 'B', promptVersion }).lean(),
      ImageModel.findById(imageId).lean(),
    ]);

    // Task rule: compute AnalysisValidation for all images having both runs
    if (!docA || !docB) {
      continue;
    }

    const datasetLabel = imgDoc?.trueClass;
    if (!datasetLabel) {
      console.warn(`[WARN] Image ${imageId} not found in catalog, skipping validation.`);
      continue;
    }

    const validation = validateAnalysis({
      runA: docA.output,
      runB: docB.output,
      datasetLabel,
    });

    await AnalysisValidationModel.findOneAndUpdate(
      { imageId, promptVersion },
      {
        $set: {
          imageId,
          promptVersion,
          status: validation.status,
          reasons: validation.reasons,
          consensus: validation.consensus,
          datasetLabel,
          validatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    totalValidated++;
    if (validation.status === 'auto_passed') {
      passedCount++;
    } else {
      rejectedCount++;
    }

    for (const r of validation.reasons) {
      reasonsTally[r] = (reasonsTally[r] || 0) + 1;
    }
  }

  return {
    totalValidated,
    passedCount,
    rejectedCount,
    reasonsTally,
  };
}

/**
 * Exports all completed analyses (both runs + validation) to a JSON file.
 *
 * @param {Object} [options]
 * @param {string} [options.outputPath=DEFAULT_ANALYSES_EXPORT_PATH]
 * @param {string} [options.promptVersion='v1']
 * @param {any} [options.ImageModel]
 * @param {any} [options.ImageAnalysisModel]
 * @param {any} [options.AnalysisValidationModel]
 * @returns {Promise<{ exportedCount: number, outputPath: string }>}
 */
export async function exportImageAnalyses({
  outputPath = DEFAULT_ANALYSES_EXPORT_PATH,
  promptVersion = 'v1',
  ImageModel = DefaultImageModel,
  ImageAnalysisModel = DefaultImageAnalysisModel,
  AnalysisValidationModel = DefaultAnalysisValidationModel,
} = {}) {
  const validations = await AnalysisValidationModel.find({ promptVersion })
    .sort({ imageId: 1 })
    .lean();

  const exported = [];

  for (const v of validations) {
    const [docA, docB, imgDoc] = await Promise.all([
      ImageAnalysisModel.findOne({ imageId: v.imageId, run: 'A', promptVersion }).lean(),
      ImageAnalysisModel.findOne({ imageId: v.imageId, run: 'B', promptVersion }).lean(),
      ImageModel.findById(v.imageId).lean(),
    ]);

    exported.push({
      imageId: v.imageId,
      datasetLabel: v.datasetLabel,
      bucket: imgDoc?.bucket ?? 'unknown',
      source: imgDoc?.source ?? 'unknown',
      promptVersion,
      model: docA?.model || docB?.model || 'unknown',
      runA: docA?.output ?? null,
      runB: docB?.output ?? null,
      validation: {
        status: v.status,
        reasons: v.reasons,
        consensus: v.consensus,
        validatedAt: v.validatedAt,
      },
    });
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(exported, null, 2), 'utf8');

  return {
    exportedCount: exported.length,
    outputPath,
  };
}

/**
 * Imports image analyses and validations from a JSON seed file.
 *
 * @param {Object} [options]
 * @param {string} [options.inputPath=DEFAULT_ANALYSES_EXPORT_PATH]
 * @param {any} [options.ImageAnalysisModel]
 * @param {any} [options.AnalysisValidationModel]
 * @returns {Promise<{ importedCount: number, inputPath: string }>}
 */
export async function importImageAnalyses({
  inputPath = DEFAULT_ANALYSES_EXPORT_PATH,
  ImageAnalysisModel = DefaultImageAnalysisModel,
  AnalysisValidationModel = DefaultAnalysisValidationModel,
} = {}) {
  if (!fs.existsSync(inputPath)) {
    return { importedCount: 0, inputPath };
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const entries = JSON.parse(raw);

  if (!Array.isArray(entries)) {
    throw new Error('Image analyses file must contain an array of records');
  }

  let count = 0;
  for (const entry of entries) {
    if (!entry.imageId || !entry.datasetLabel) {
      continue;
    }

    const promptVersion = entry.promptVersion || 'v1';
    const model = entry.model || 'gemini-3.8-flash';

    if (entry.runA) {
      await ImageAnalysisModel.findOneAndUpdate(
        { imageId: entry.imageId, run: 'A', promptVersion },
        {
          $set: {
            imageId: entry.imageId,
            run: 'A',
            promptVersion,
            model,
            batchId: `imported-${entry.imageId}-A`,
            output: entry.runA,
          },
        },
        { upsert: true },
      );
    }

    if (entry.runB) {
      await ImageAnalysisModel.findOneAndUpdate(
        { imageId: entry.imageId, run: 'B', promptVersion },
        {
          $set: {
            imageId: entry.imageId,
            run: 'B',
            promptVersion,
            model,
            batchId: `imported-${entry.imageId}-B`,
            output: entry.runB,
          },
        },
        { upsert: true },
      );
    }

    if (entry.validation) {
      await AnalysisValidationModel.findOneAndUpdate(
        { imageId: entry.imageId, promptVersion },
        {
          $set: {
            imageId: entry.imageId,
            promptVersion,
            status: entry.validation.status,
            reasons: entry.validation.reasons || [],
            consensus: entry.validation.consensus || {
              patterns: [],
              distribution: null,
              laterality: null,
              zones: [],
            },
            datasetLabel: entry.datasetLabel,
            validatedAt: entry.validation.validatedAt
              ? new Date(entry.validation.validatedAt)
              : new Date(),
          },
        },
        { upsert: true },
      );
    }

    count++;
  }

  return {
    importedCount: count,
    inputPath,
  };
}

/**
 * Computes comprehensive analysis status statistics.
 *
 * @param {Object} [options]
 * @param {string} [options.promptVersion='v1']
 * @param {number} [options.budget=16]
 * @param {any} [options.ImageModel]
 * @param {any} [options.ImageAnalysisModel]
 * @param {any} [options.AnalysisValidationModel]
 * @param {any} [options.AnalysisBatchModel]
 * @returns {Promise<Object>}
 */
export async function getAnalysisStatusSummary({
  promptVersion = 'v1',
  budget = 16,
  ImageModel = DefaultImageModel,
  ImageAnalysisModel = DefaultImageAnalysisModel,
  AnalysisValidationModel = DefaultAnalysisValidationModel,
  AnalysisBatchModel = DefaultAnalysisBatchModel,
} = {}) {
  // 1. Batch status
  const batches = await AnalysisBatchModel.find({ promptVersion }).lean();
  const batchStats = {
    total: batches.length,
    done: batches.filter((b) => b.status === 'done').length,
    pending: batches.filter((b) => b.status === 'pending').length,
    failed: batches.filter((b) => b.status === 'failed').length,
    runA: {
      total: batches.filter((b) => b.run === 'A').length,
      done: batches.filter((b) => b.run === 'A' && b.status === 'done').length,
    },
    runB: {
      total: batches.filter((b) => b.run === 'B').length,
      done: batches.filter((b) => b.run === 'B' && b.status === 'done').length,
    },
  };

  // 2. Images coverage
  const allAnalyses = await ImageAnalysisModel.find({ promptVersion }).lean();
  /** @type {Record<string, { A?: any, B?: any }>} */
  const byImage = {};
  for (const a of allAnalyses) {
    if (!byImage[a.imageId]) byImage[a.imageId] = {};
    if (a.run === 'A') byImage[a.imageId].A = a.output;
    if (a.run === 'B') byImage[a.imageId].B = a.output;
  }

  const distinctImages = Object.keys(byImage);
  const bothRunsImages = distinctImages.filter((id) => byImage[id].A && byImage[id].B);
  const runAOnlyImages = distinctImages.filter((id) => byImage[id].A && !byImage[id].B);
  const runBOnlyImages = distinctImages.filter((id) => !byImage[id].A && byImage[id].B);

  // 3. Schema validity
  let schemaValidCount = 0;
  for (const a of allAnalyses) {
    if (ImageAnalysisResultSchema.safeParse(a.output).success) {
      schemaValidCount++;
    }
  }
  const schemaValidRate = allAnalyses.length > 0 ? schemaValidCount / allAnalyses.length : 1.0;

  // 4. Accuracy & agreement vs dataset labels
  // Look up catalog metadata for all distinct images
  const imageDocs = await ImageModel.find(
    { _id: { $in: distinctImages } },
    '_id trueClass bucket source',
  ).lean();
  const labelMap = new Map(imageDocs.map((d) => [d._id, d]));

  let runATotal = 0;
  let runACorrect = 0;
  const runAByClass = {
    covid19: { total: 0, correct: 0 },
    pneumonia: { total: 0, correct: 0 },
    normal: { total: 0, correct: 0 },
  };

  let runBTotal = 0;
  let runBCorrect = 0;
  const runBByClass = {
    covid19: { total: 0, correct: 0 },
    pneumonia: { total: 0, correct: 0 },
    normal: { total: 0, correct: 0 },
  };

  let agreementCount = 0;
  let agreementTotal = 0;

  for (const id of distinctImages) {
    const pair = byImage[id];
    const img = labelMap.get(id);
    const trueClass = img?.trueClass;

    if (pair.A && trueClass) {
      runATotal++;
      const isCorrect = pair.A.predictedClass === trueClass;
      if (isCorrect) runACorrect++;
      if (runAByClass[trueClass]) {
        runAByClass[trueClass].total++;
        if (isCorrect) runAByClass[trueClass].correct++;
      }
    }

    if (pair.B && trueClass) {
      runBTotal++;
      const isCorrect = pair.B.predictedClass === trueClass;
      if (isCorrect) runBCorrect++;
      if (runBByClass[trueClass]) {
        runBByClass[trueClass].total++;
        if (isCorrect) runBByClass[trueClass].correct++;
      }
    }

    if (pair.A && pair.B) {
      agreementTotal++;
      if (pair.A.predictedClass === pair.B.predictedClass) {
        agreementCount++;
      }
    }
  }

  // 5. Validations breakdown
  const validations = await AnalysisValidationModel.find({ promptVersion }).lean();
  const autoPassed = validations.filter((v) => v.status === 'auto_passed').length;
  const autoRejected = validations.filter((v) => v.status === 'auto_rejected').length;

  /** @type {Record<string, { passed: number, rejected: number }>} */
  const byClassBucket = {};
  /** @type {Record<string, number>} */
  const rejectReasons = {};

  for (const v of validations) {
    const img = labelMap.get(v.imageId);
    const cbKey = `${v.datasetLabel}:${img?.bucket || 'unknown'}`;
    if (!byClassBucket[cbKey]) byClassBucket[cbKey] = { passed: 0, rejected: 0 };
    if (v.status === 'auto_passed') {
      byClassBucket[cbKey].passed++;
    } else {
      byClassBucket[cbKey].rejected++;
    }

    for (const r of v.reasons) {
      rejectReasons[r] = (rejectReasons[r] || 0) + 1;
    }
  }

  // 6. Today's budget status
  const usage = await getUsageStatus({ budget });

  return {
    batches: batchStats,
    images: {
      distinctCount: distinctImages.length,
      bothRuns: bothRunsImages.length,
      runAOnly: runAOnlyImages.length,
      runBOnly: runBOnlyImages.length,
    },
    schemaValidRate,
    runA: {
      total: runATotal,
      accuracy: runATotal > 0 ? runACorrect / runATotal : 0,
      byClass: runAByClass,
    },
    runB: {
      total: runBTotal,
      accuracy: runBTotal > 0 ? runBCorrect / runBTotal : 0,
      byClass: runBByClass,
    },
    agreement: {
      total: agreementTotal,
      rate: agreementTotal > 0 ? agreementCount / agreementTotal : 0,
    },
    validations: {
      total: validations.length,
      autoPassed,
      autoRejected,
      byClassBucket,
      topRejectReasons: Object.entries(rejectReasons)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
    },
    budget: usage,
  };
}
