import { GenerationOutputSchema } from '@radiology/contracts';
import { AnalysisValidationModel } from '../analysis/model.js';
import { ImageModel } from '../catalog/model.js';
import { QuestionBankModel, QuestionGenAttemptModel } from './model.js';
import { validateQuestionCandidate, computeStableId } from './validate.js';
import { SYSTEM_INSTRUCTION, buildGenerationPrompt } from './prompts/v1/generate-questions.js';
import { retrieveKbSnippets } from '../llm/retrieval.js';
import { reserveUsage, enforceThrottle, markExhausted } from '../llm/budget.js';
import { LlmError } from '../llm/provider.js';
import { loadEnv } from '../../config/env.js';

/**
 * Plan question types to generate for each image
 * Rules:
 * - 'finding' always
 * - 'distribution' if consensus distribution is not null/none and trueClass != 'normal'
 * - 'differential' otherwise, capped at maxDifferentialPerPair per ordered pair
 *
 * @param {Object} params
 * @param {Array<{ image: Object, consensus: Object }>} params.candidates
 * @param {number} [params.maxDifferentialPerPair=4]
 * @returns {Array<{ image: Object, consensus: Object, requiredTypes: Array<'finding' | 'distribution' | 'differential'> }>}
 */
export function planCandidateQuestionTypes({ candidates, maxDifferentialPerPair = 4 }) {
  const pairDifferentialCounts = new Map();

  return candidates.map((item) => {
    const { image, consensus } = item;
    const requiredTypes = ['finding'];

    const hasDistribution =
      consensus?.distribution && consensus.distribution !== 'none' && image.trueClass !== 'normal';

    if (hasDistribution) {
      requiredTypes.push('distribution');
    } else {
      const pairKey = `${image.trueClass}:${image.confusedWith}`;
      const currentPairCount = pairDifferentialCounts.get(pairKey) || 0;
      if (currentPairCount < maxDifferentialPerPair) {
        requiredTypes.push('differential');
        pairDifferentialCounts.set(pairKey, currentPairCount + 1);
      }
    }

    return {
      image,
      consensus,
      requiredTypes,
    };
  });
}

/**
 * Split candidates into batches of up to batchSize
 * @template T
 * @param {T[]} items
 * @param {number} batchSize
 * @returns {T[][]}
 */
export function chunkIntoBatches(items, batchSize) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Helper to build simulated valid questions for dry-run mode
 * @param {Object} item
 * @returns {Object[]}
 */
function buildDryRunQuestions(item) {
  const { consensus, requiredTypes } = item;
  const questions = [];

  for (const type of requiredTypes) {
    if (type === 'finding') {
      const targetPattern = consensus.patterns[0] || 'clear_lungs';
      questions.push({
        type: 'finding',
        stem: 'کدام یافته پاتولوژیک اولیه در نمای رادیوگرافی قفسه سینه بیمار مشاهده می‌شود؟',
        options: [
          { text: 'الگوی اولیه درگیر', key: targetPattern },
          {
            text: 'کدورت منتشر ثانویه',
            key: 'opacity' === targetPattern ? 'consolidation' : 'opacity',
          },
          {
            text: 'هوابرونکوگرام محیطی',
            key: 'air_bronchograms' === targetPattern ? 'interstitial' : 'air_bronchograms',
          },
          {
            text: 'ریه کاملا شفاف',
            key: 'clear_lungs' === targetPattern ? 'pleural_thickening' : 'clear_lungs',
          },
        ],
        correctIndex: 0,
        rationale: 'بر اساس بررسی اجماع تحلیل، الگوی مشخص شده دیده می‌شود.',
        kbRef: null,
        tags: ['finding', targetPattern],
      });
    } else if (type === 'distribution') {
      const targetDist = consensus.distribution || 'peripheral';
      questions.push({
        type: 'distribution',
        stem: 'توزیع آناتومیک ضایعه مشهود در کدام دسته‌بندی قرار می‌گیرد؟',
        options: [
          { text: 'توزیع اصلی ضایعه', key: targetDist },
          {
            text: 'درگیری منتشره ریه',
            key: 'diffuse' === targetDist ? 'central_perihilar' : 'diffuse',
          },
          {
            text: 'درگیری نافی مرکزی',
            key: 'central_perihilar' === targetDist ? 'focal_lobar' : 'central_perihilar',
          },
          {
            text: 'درگیری لوبی موضعی',
            key: 'focal_lobar' === targetDist ? 'peripheral' : 'focal_lobar',
          },
        ],
        correctIndex: 0,
        rationale: 'توزیع تعیین شده در بررسی تصویر مطابقت دارد.',
        kbRef: null,
        tags: ['distribution', targetDist],
      });
    } else if (type === 'differential') {
      questions.push({
        type: 'differential',
        stem: 'کدام نما در سی‌تی یا کلیشه سینه، تشخیص افتراقی را به نفع بیماری اولیه تقویت می‌کند؟',
        options: [
          { text: 'درگیری محیطی و دوطرفه تحتانی', key: null },
          { text: 'تراکم تک‌لوب همراه با افیوژن پلورال بارز', key: null },
          { text: 'کاویتاسیون سریع پارانشیم', key: null },
          { text: 'بزرگ‌شدگی بارز غدد لنفاوی نافی', key: null },
        ],
        correctIndex: 0,
        rationale: 'نمای درگیری دوطرفه به نفع این بیماری است.',
        kbRef: 'covid-vs-pneumonia-distribution',
        tags: ['differential'],
      });
    }
  }

  return questions;
}

/**
 * Execute question generation pipeline
 *
 * @param {Object} options
 * @param {Object} options.provider - GeminiProvider or FakeProvider
 * @param {string} [options.promptVersion='v1']
 * @param {string} [options.model='gemini-3.8-flash']
 * @param {number} [options.batchSize=8]
 * @param {number} [options.maxRequests=12]
 * @param {number} [options.maxDifferentialPerPair=4]
 * @param {number} [options.limit]
 * @param {boolean} [options.dryRun=false]
 * @param {number} [options.delayMs]
 * @param {Array<Object>} [options.candidateItems] - Injected candidates for unit testing
 * @returns {Promise<Object>} Run summary
 */
export async function generateQuestions(options) {
  let config;
  try {
    config = loadEnv();
  } catch {
    config = {};
  }

  const {
    provider,
    promptVersion = 'v1',
    model = config?.GEMINI_MODEL || 'gemini-3.8-flash',
    batchSize = 8,
    maxRequests = 12,
    maxDifferentialPerPair = 4,
    limit,
    dryRun = false,
    delayMs = config?.LLM_MIN_INTERVAL_MS || 13000,
    candidateItems = null,
  } = options;

  let candidates = [];

  if (candidateItems) {
    candidates = candidateItems;
  } else {
    // 1. Fetch passed validations
    const passedValidations = await AnalysisValidationModel.find({
      status: 'auto_passed',
      promptVersion,
    }).lean();

    // 2. Filter out images already in QuestionBank for this promptVersion (idempotency)
    const existingImageIds = new Set(
      await QuestionBankModel.distinct('imageId', {
        'source.promptVersion': promptVersion,
      }),
    );

    const pendingValidations = passedValidations.filter((v) => !existingImageIds.has(v.imageId));

    // 3. Fetch catalog image metadata
    const imageIds = pendingValidations.map((v) => v.imageId);
    const catalogImages = await ImageModel.find({ _id: { $in: imageIds } }).lean();
    const catalogMap = new Map(catalogImages.map((img) => [img._id, img]));

    for (const validation of pendingValidations) {
      const catalog = catalogMap.get(validation.imageId);
      candidates.push({
        image: {
          id: validation.imageId,
          trueClass: catalog?.trueClass || validation.datasetLabel,
          confusedWith:
            catalog?.confusedWith ||
            (validation.datasetLabel === 'covid19' ? 'pneumonia' : 'covid19'),
          bucket: catalog?.bucket || 'medium',
        },
        consensus: validation.consensus || {},
        analysisIds: [],
      });
    }
  }

  if (limit && limit > 0) {
    candidates = candidates.slice(0, limit);
  }

  if (candidates.length === 0) {
    return {
      requestsMade: 0,
      batchesProcessed: 0,
      imagesProcessed: 0,
      itemsCreated: { total: 0, byType: { finding: 0, distribution: 0, differential: 0 } },
      attemptsRejected: { total: 0, byReason: {} },
      exitReason: 'NO_CANDIDATES',
    };
  }

  // Plan question types for candidates
  const plannedCandidates = planCandidateQuestionTypes({
    candidates,
    maxDifferentialPerPair,
  });

  const batches = chunkIntoBatches(plannedCandidates, batchSize);

  let requestsMade = 0;
  let batchesProcessed = 0;
  let imagesProcessed = 0;
  const itemsCreated = {
    total: 0,
    byType: { finding: 0, distribution: 0, differential: 0 },
  };
  const attemptsRejected = {
    total: 0,
    byReason: {},
  };
  let exitReason = 'COMPLETED';

  for (const batch of batches) {
    if (requestsMade >= maxRequests) {
      exitReason = 'MAX_REQUESTS_REACHED';
      break;
    }

    // Collect KB snippets for the pairs in this batch
    const uniquePairs = new Set(batch.map((b) => `${b.image.trueClass}:${b.image.confusedWith}`));
    const kbSnippets = [];
    const kbSlugs = [];

    for (const pairStr of uniquePairs) {
      const [cls1, cls2] = pairStr.split(':');
      const snippets = retrieveKbSnippets({ classes: [cls1, cls2], limit: 3 });
      for (const snip of snippets) {
        if (!kbSlugs.includes(snip.slug)) {
          kbSlugs.push(snip.slug);
          kbSnippets.push(snip);
        }
      }
    }

    let parsedOutput = null;

    if (dryRun) {
      // Simulate valid questions output in dryRun
      parsedOutput = {
        items: batch.map((item, idx) => ({
          imageIndex: idx,
          questions: buildDryRunQuestions(item),
        })),
      };
      requestsMade++;
    } else {
      // Live / Provider execution
      // Check Pacific budget reservation
      const slot = await reserveUsage({
        budget: config?.LLM_DAILY_REQUEST_BUDGET || 16,
      });

      if (!slot.ok) {
        exitReason = 'BUDGET_EXHAUSTED';
        break;
      }

      await enforceThrottle({ minIntervalMs: delayMs });

      const promptText = buildGenerationPrompt({ batch, kbSnippets });

      try {
        const result = await provider.generateJson({
          promptId: 'generate-questions',
          version: promptVersion,
          system: SYSTEM_INSTRUCTION,
          input: promptText,
          schema: GenerationOutputSchema,
        });

        requestsMade++;

        if (result && result.data) {
          parsedOutput = result.data;
        } else if (result && result.rawText) {
          parsedOutput = JSON.parse(result.rawText);
        }
      } catch (err) {
        requestsMade++;
        if (err instanceof LlmError && err.status === 429) {
          await markExhausted();
          exitReason = 'QUOTA_429';
          break;
        }
        console.error(`[Question Generation Error] Batch failed: ${err.message}`);
        continue;
      }
    }

    batchesProcessed++;
    imagesProcessed += batch.length;

    if (!parsedOutput || !Array.isArray(parsedOutput.items)) {
      continue;
    }

    // Process output items
    for (const itemOutput of parsedOutput.items) {
      const batchItem = batch[itemOutput.imageIndex];
      if (!batchItem) continue;

      const { image, consensus } = batchItem;
      const questions = Array.isArray(itemOutput.questions) ? itemOutput.questions : [];

      let slotIndex = 0;
      for (const qCandidate of questions) {
        const validation = validateQuestionCandidate(qCandidate, {
          image,
          consensus,
          kbSlugs,
        });

        if (validation.valid) {
          const stableId = computeStableId({
            imageId: image.id,
            type: qCandidate.type,
            promptVersion,
            slot: slotIndex++,
          });

          if (!dryRun) {
            await QuestionBankModel.create({
              stableId,
              imageId: image.id,
              type: qCandidate.type,
              pair: {
                trueClass: image.trueClass,
                confusedWith: image.confusedWith,
              },
              bucket: image.bucket,
              stem: qCandidate.stem,
              options: qCandidate.options,
              correctIndex: qCandidate.correctIndex,
              rationale: qCandidate.rationale,
              kbRef: qCandidate.kbRef ?? null,
              tags: qCandidate.tags || [],
              status: 'pending_review',
              edited: false,
              source: {
                model,
                promptVersion,
                analysisIds: batchItem.analysisIds || [],
              },
              history: [
                {
                  action: 'created',
                  by: 'system',
                  at: new Date(),
                  toStatus: 'pending_review',
                },
              ],
              analysisSummary: {
                consensus,
              },
            });
          }

          itemsCreated.total++;
          if (itemsCreated.byType[qCandidate.type] !== undefined) {
            itemsCreated.byType[qCandidate.type]++;
          }
        } else {
          // Rejection logged to attempts
          if (!dryRun) {
            await QuestionGenAttemptModel.create({
              imageId: image.id,
              promptVersion,
              type: qCandidate?.type,
              candidate: qCandidate,
              reasons: validation.reasons,
            });
          }

          attemptsRejected.total++;
          for (const reason of validation.reasons) {
            attemptsRejected.byReason[reason] = (attemptsRejected.byReason[reason] || 0) + 1;
          }
        }
      }
    }
  }

  return {
    requestsMade,
    batchesProcessed,
    imagesProcessed,
    itemsCreated,
    attemptsRejected,
    exitReason,
  };
}
