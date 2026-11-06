import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// History Entry Schema
// ---------------------------------------------------------------------------
const QuestionBankHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['created', 'approved', 'rejected', 'edited'],
      required: true,
    },
    by: { type: String, required: true },
    at: { type: Date, default: Date.now },
    fromStatus: { type: String, enum: ['pending_review', 'approved', 'rejected'] },
    toStatus: { type: String, enum: ['pending_review', 'approved', 'rejected'] },
    changes: { type: mongoose.Schema.Types.Mixed },
    note: { type: String, default: null },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Option Schema (key is vocabulary term or null for differential)
// ---------------------------------------------------------------------------
const QuestionOptionMongooseSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    key: { type: String, default: null },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// QuestionBank — questions stored for instructor review
// ---------------------------------------------------------------------------
const QuestionBankSchema = new mongoose.Schema(
  {
    stableId: { type: String, required: true, unique: true, index: true },
    imageId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['finding', 'distribution', 'differential'],
      required: true,
      index: true,
    },
    pair: {
      trueClass: { type: String, enum: ['covid19', 'pneumonia', 'normal'], required: true },
      confusedWith: { type: String, enum: ['covid19', 'pneumonia', 'normal'], required: true },
    },
    bucket: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    stem: { type: String, required: true },
    options: {
      type: [QuestionOptionMongooseSchema],
      required: true,
      validate: [
        (opts) => Array.isArray(opts) && opts.length === 4,
        'Question must have exactly 4 options',
      ],
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    rationale: { type: String, required: true, maxlength: 300 },
    kbRef: { type: String, default: null },
    tags: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['pending_review', 'approved', 'rejected'],
      default: 'pending_review',
      required: true,
      index: true,
    },
    edited: { type: Boolean, default: false },
    source: {
      model: { type: String, required: true },
      promptVersion: { type: String, required: true },
      analysisIds: { type: [String], default: [] },
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    note: { type: String, default: null },
    history: { type: [QuestionBankHistorySchema], default: [] },
    analysisSummary: {
      consensus: { type: mongoose.Schema.Types.Mixed },
      certaintyA: { type: String },
      certaintyB: { type: String },
    },
  },
  { timestamps: true },
);

QuestionBankSchema.index({ status: 1, type: 1 });
QuestionBankSchema.index({ 'pair.trueClass': 1, 'pair.confusedWith': 1 });
QuestionBankSchema.index({ createdAt: -1 });

/**
 * Approve question transition
 * @param {Object} params
 * @param {string} params.by
 * @param {string} [params.note]
 */
QuestionBankSchema.methods.approve = function ({ by, note = null }) {
  if (this.status === 'approved') {
    return this;
  }
  const fromStatus = this.status;
  this.status = 'approved';
  this.reviewedBy = by;
  this.reviewedAt = new Date();
  if (note) this.note = note;

  this.history.push({
    action: 'approved',
    by,
    at: new Date(),
    fromStatus,
    toStatus: 'approved',
    note,
  });

  return this;
};

/**
 * Reject question transition
 * @param {Object} params
 * @param {string} params.by
 * @param {string} [params.note]
 */
QuestionBankSchema.methods.reject = function ({ by, note = null }) {
  if (this.status === 'rejected') {
    return this;
  }
  const fromStatus = this.status;
  this.status = 'rejected';
  this.reviewedBy = by;
  this.reviewedAt = new Date();
  if (note) this.note = note;

  this.history.push({
    action: 'rejected',
    by,
    at: new Date(),
    fromStatus,
    toStatus: 'rejected',
    note,
  });

  return this;
};

/**
 * Edit question fields and reset status to pending_review
 * @param {Object} params
 * @param {string} params.by
 * @param {string} params.stem
 * @param {{ text: string }[]} params.options
 * @param {number} params.correctIndex
 * @param {string} params.rationale
 * @param {string} [params.note]
 */
QuestionBankSchema.methods.edit = function ({
  by,
  stem,
  options,
  correctIndex,
  rationale,
  note = null,
}) {
  const fromStatus = this.status;
  const changes = {};

  if (this.stem !== stem) {
    changes.stem = { before: this.stem, after: stem };
    this.stem = stem;
  }

  // Update option texts while preserving keys and length
  const oldOptions = this.options.map((o) => ({ text: o.text, key: o.key }));
  const newOptions = options.map((opt, i) => ({
    text: opt.text,
    key: this.options[i]?.key ?? null,
  }));
  changes.options = { before: oldOptions, after: newOptions };
  this.options = newOptions;

  if (this.correctIndex !== correctIndex) {
    changes.correctIndex = { before: this.correctIndex, after: correctIndex };
    this.correctIndex = correctIndex;
  }

  if (this.rationale !== rationale) {
    changes.rationale = { before: this.rationale, after: rationale };
    this.rationale = rationale;
  }

  this.edited = true;
  this.status = 'pending_review'; // Always reset to pending_review on edit
  if (note) this.note = note;

  this.history.push({
    action: 'edited',
    by,
    at: new Date(),
    fromStatus,
    toStatus: 'pending_review',
    changes,
    note,
  });

  return this;
};

export const QuestionBankModel =
  mongoose.models.QuestionBank ||
  mongoose.model('QuestionBank', QuestionBankSchema, 'question_bank');

// ---------------------------------------------------------------------------
// QuestionGenAttempt — logs rejected generation attempts for T10 evaluation
// ---------------------------------------------------------------------------
const QuestionGenAttemptSchema = new mongoose.Schema(
  {
    imageId: { type: String, required: true, index: true },
    promptVersion: { type: String, required: true },
    type: { type: String, default: null },
    candidate: { type: mongoose.Schema.Types.Mixed },
    reasons: { type: [String], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

QuestionGenAttemptSchema.index({ imageId: 1, promptVersion: 1 });

export const QuestionGenAttemptModel =
  mongoose.models.QuestionGenAttempt ||
  mongoose.model('QuestionGenAttempt', QuestionGenAttemptSchema, 'question_gen_attempts');
