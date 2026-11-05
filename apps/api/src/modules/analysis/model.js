import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// AnalysisBatch — one planned API call covering 6 images, run A or B
// batchId format: "v1-g07-A" (promptVersion-groupIndex-run)
// ---------------------------------------------------------------------------
const AnalysisBatchSchema = new mongoose.Schema(
  {
    _id: { type: String }, // batchId is the _id for easy idempotent upserts
    batchId: { type: String, required: true, unique: true },
    group: { type: Number, required: true, min: 0 },
    run: { type: String, enum: ['A', 'B'], required: true },
    // imageIds: catalog image ids in the ORDER sent to the LLM for this batch.
    // Run B uses the same 6 images reversed-then-rotated vs run A.
    imageIds: { type: [String], required: true },
    status: {
      type: String,
      enum: ['pending', 'done', 'failed'],
      default: 'pending',
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: null },
    requestedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    // Stored so we know which model/prompt produced these results
    model: { type: String, default: '' },
    promptVersion: { type: String, default: 'v1' },
  },
  { timestamps: true },
);

AnalysisBatchSchema.index({ status: 1 });
AnalysisBatchSchema.index({ group: 1, run: 1 });

AnalysisBatchSchema.pre('validate', function () {
  if (!this._id && this.batchId) {
    this._id = this.batchId;
  }
});

export const AnalysisBatchModel =
  mongoose.models.AnalysisBatch ||
  mongoose.model('AnalysisBatch', AnalysisBatchSchema, 'analysis_batches');

// ---------------------------------------------------------------------------
// ImageAnalysis — one validated per-image result, stored after a done batch.
// Unique compound index: { imageId, run, promptVersion } prevents duplicates.
// ---------------------------------------------------------------------------
const ImageAnalysisSchema = new mongoose.Schema(
  {
    imageId: { type: String, required: true },
    run: { type: String, enum: ['A', 'B'], required: true },
    promptVersion: { type: String, required: true, default: 'v1' },
    model: { type: String, required: true },
    batchId: { type: String, required: true },
    // output is stored as a plain mixed object (already Zod-validated before save)
    output: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

ImageAnalysisSchema.index({ imageId: 1, run: 1, promptVersion: 1 }, { unique: true });
ImageAnalysisSchema.index({ batchId: 1 });

export const ImageAnalysisModel =
  mongoose.models.ImageAnalysis ||
  mongoose.model('ImageAnalysis', ImageAnalysisSchema, 'image_analyses');

// ---------------------------------------------------------------------------
// AnalysisValidation — computed once both runs exist for an image.
// One doc per (imageId, promptVersion).
// ---------------------------------------------------------------------------
const AnalysisValidationSchema = new mongoose.Schema(
  {
    imageId: { type: String, required: true },
    promptVersion: { type: String, required: true, default: 'v1' },
    status: {
      type: String,
      enum: ['auto_passed', 'auto_rejected'],
      required: true,
    },
    reasons: { type: [String], default: [] },
    // consensus: intersection of run A and run B fields
    consensus: {
      patterns: { type: [String], default: [] },
      distribution: { type: String, default: null },
      laterality: { type: String, default: null },
      zones: { type: [String], default: [] },
    },
    datasetLabel: {
      type: String,
      enum: ['covid19', 'pneumonia', 'normal'],
      required: true,
    },
    validatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

AnalysisValidationSchema.index({ imageId: 1, promptVersion: 1 }, { unique: true });
AnalysisValidationSchema.index({ status: 1 });

export const AnalysisValidationModel =
  mongoose.models.AnalysisValidation ||
  mongoose.model('AnalysisValidation', AnalysisValidationSchema, 'analysis_validations');
