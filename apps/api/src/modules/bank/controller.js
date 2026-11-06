import mongoose from 'mongoose';
import { QuestionBankModel } from './model.js';
import { ImageModel } from '../catalog/model.js';
import { AnalysisValidationModel, ImageAnalysisModel } from '../analysis/model.js';
import { toAdminQuestionDto } from './mapper.js';
import { validateQuestionCandidate } from './validate.js';
import { retrieveKbSnippets } from '../llm/retrieval.js';
import { NotFoundError, BadRequestError } from '../../lib/httpErrors.js';

export function createBankController(config) {
  const salt = config.PUBLIC_ID_SALT;

  return {
    /**
     * List questions with filters and pagination
     */
    async listQuestions(req, res, next) {
      try {
        const { status, type, trueClass, confusedWith, page = 1, pageSize = 20 } = req.valid.query;

        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (trueClass) filter['pair.trueClass'] = trueClass;
        if (confusedWith) filter['pair.confusedWith'] = confusedWith;

        const total = await QuestionBankModel.countDocuments(filter);
        const docs = await QuestionBankModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize);

        // Batch lookup publicIds
        const imageIds = [...new Set(docs.map((d) => d.imageId))];
        const images = await ImageModel.find(
          { _id: { $in: imageIds } },
          { _id: 1, publicId: 1 },
        ).lean();
        const publicIdMap = new Map(images.map((img) => [img._id, img.publicId]));

        const items = docs.map((doc) => toAdminQuestionDto(doc, { publicIdMap, salt }));

        res.json({
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * Get review panel statistics
     */
    async getStats(_req, res, next) {
      try {
        const [pending, approved, rejected, total] = await Promise.all([
          QuestionBankModel.countDocuments({ status: 'pending_review' }),
          QuestionBankModel.countDocuments({ status: 'approved' }),
          QuestionBankModel.countDocuments({ status: 'rejected' }),
          QuestionBankModel.countDocuments(),
        ]);

        const [finding, distribution, differential] = await Promise.all([
          QuestionBankModel.countDocuments({ type: 'finding' }),
          QuestionBankModel.countDocuments({ type: 'distribution' }),
          QuestionBankModel.countDocuments({ type: 'differential' }),
        ]);

        const pairAggregation = await QuestionBankModel.aggregate([
          {
            $group: {
              _id: { $concat: ['$pair.trueClass', ':', '$pair.confusedWith'] },
              count: { $sum: 1 },
            },
          },
        ]);

        const countsByPair = {};
        for (const p of pairAggregation) {
          countsByPair[p._id] = p.count;
        }

        res.json({
          countsByStatus: {
            pending_review: pending,
            approved,
            rejected,
            total,
          },
          countsByType: {
            finding,
            distribution,
            differential,
          },
          countsByPair,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * Get single question by ID with full analysis summary and image URL
     */
    async getQuestionById(req, res, next) {
      try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new NotFoundError('Question not found');
        }

        const doc = await QuestionBankModel.findById(id);
        if (!doc) {
          throw new NotFoundError('Question not found');
        }

        const image = await ImageModel.findById(doc.imageId).lean();
        const publicIdMap = image ? new Map([[image._id, image.publicId]]) : undefined;

        // Enhance analysis summary with run certanties if available
        if (!doc.analysisSummary?.certaintyA || !doc.analysisSummary?.certaintyB) {
          const analyses = await ImageAnalysisModel.find({ imageId: doc.imageId }).lean();
          const runA = analyses.find((a) => a.run === 'A');
          const runB = analyses.find((a) => a.run === 'B');

          if (runA || runB) {
            doc.analysisSummary = {
              consensus: doc.analysisSummary?.consensus || {},
              certaintyA: runA?.output?.certainty || undefined,
              certaintyB: runB?.output?.certainty || undefined,
            };
          }
        }

        res.json(toAdminQuestionDto(doc, { publicIdMap, salt }));
      } catch (err) {
        next(err);
      }
    },

    /**
     * Approve question
     */
    async approveQuestion(req, res, next) {
      try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new NotFoundError('Question not found');
        }

        const doc = await QuestionBankModel.findById(id);
        if (!doc) {
          throw new NotFoundError('Question not found');
        }

        const by = req.user?.displayName || req.user?.email || req.user?.id || 'instructor';
        const note = req.valid.body?.note || null;

        doc.approve({ by, note });
        await doc.save();

        const image = await ImageModel.findById(doc.imageId).lean();
        const publicIdMap = image ? new Map([[image._id, image.publicId]]) : undefined;

        res.json(toAdminQuestionDto(doc, { publicIdMap, salt }));
      } catch (err) {
        next(err);
      }
    },

    /**
     * Reject question
     */
    async rejectQuestion(req, res, next) {
      try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new NotFoundError('Question not found');
        }

        const doc = await QuestionBankModel.findById(id);
        if (!doc) {
          throw new NotFoundError('Question not found');
        }

        const by = req.user?.displayName || req.user?.email || req.user?.id || 'instructor';
        const note = req.valid.body?.note || null;

        doc.reject({ by, note });
        await doc.save();

        const image = await ImageModel.findById(doc.imageId).lean();
        const publicIdMap = image ? new Map([[image._id, image.publicId]]) : undefined;

        res.json(toAdminQuestionDto(doc, { publicIdMap, salt }));
      } catch (err) {
        next(err);
      }
    },

    /**
     * Edit question and reset status to pending_review
     */
    async editQuestion(req, res, next) {
      try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new NotFoundError('Question not found');
        }

        const doc = await QuestionBankModel.findById(id);
        if (!doc) {
          throw new NotFoundError('Question not found');
        }

        const { stem, options, correctIndex, rationale, note } = req.valid.body;

        // Re-construct candidate using existing immutable fields (type, keys, kbRef)
        const candidateOptions = options.map((opt, i) => ({
          text: opt.text,
          key: doc.options[i]?.key ?? null,
        }));

        const candidate = {
          type: doc.type,
          stem,
          options: candidateOptions,
          correctIndex,
          rationale,
          kbRef: doc.kbRef,
        };

        // Fetch validation consensus and KB slugs for re-validation
        const validation = await AnalysisValidationModel.findOne({
          imageId: doc.imageId,
        }).lean();
        const consensus = validation?.consensus || doc.analysisSummary?.consensus || {};

        const kbSnippets = retrieveKbSnippets({
          classes: [doc.pair.trueClass, doc.pair.confusedWith],
          limit: 4,
        });
        const kbSlugs = kbSnippets.map((s) => s.slug);

        const valResult = validateQuestionCandidate(candidate, {
          image: {
            id: doc.imageId,
            trueClass: doc.pair.trueClass,
            confusedWith: doc.pair.confusedWith,
            bucket: doc.bucket,
          },
          consensus,
          kbSlugs,
        });

        if (!valResult.valid) {
          throw new BadRequestError('Validation error', valResult.reasons);
        }

        const by = req.user?.displayName || req.user?.email || req.user?.id || 'instructor';
        doc.edit({
          by,
          stem,
          options,
          correctIndex,
          rationale,
          note,
        });

        await doc.save();

        const image = await ImageModel.findById(doc.imageId).lean();
        const publicIdMap = image ? new Map([[image._id, image.publicId]]) : undefined;

        res.json(toAdminQuestionDto(doc, { publicIdMap, salt }));
      } catch (err) {
        next(err);
      }
    },
  };
}
