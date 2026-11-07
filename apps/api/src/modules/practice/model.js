import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Practice Answer Subdocument Schema
// ---------------------------------------------------------------------------
const PracticeAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionBank',
      required: true,
    },
    selectedIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    shuffledIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    correct: {
      type: Boolean,
      required: true,
    },
    timeMs: {
      type: Number,
      min: 0,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// PracticeSet Document Schema
// ---------------------------------------------------------------------------
const PracticeSetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
      required: true,
      index: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },
    questionIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' }],
      required: true,
      validate: [(v) => Array.isArray(v) && v.length > 0, 'Must have at least one question'],
    },
    publicIds: {
      type: [String],
      default: [],
      index: true,
    },
    optionOrder: {
      type: [[Number]],
      required: true,
      validate: [(v) => Array.isArray(v) && v.length > 0, 'Option order permutation required'],
    },
    plan: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    answers: {
      type: [PracticeAnswerSchema],
      default: [],
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

PracticeSetSchema.index({ userId: 1, createdAt: -1 });

export const PracticeSetModel =
  mongoose.models.PracticeSet || mongoose.model('PracticeSet', PracticeSetSchema, 'practice_sets');
