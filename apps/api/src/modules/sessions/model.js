import mongoose from 'mongoose';

const SessionQuestionSchema = new mongoose.Schema(
  {
    no: {
      type: Number,
      required: true,
    },
    imageId: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    trueClass: {
      type: String,
      enum: ['covid19', 'pneumonia', 'normal'],
      required: true,
    },
    bucket: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    difficulty: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    confusedWith: {
      type: String,
      enum: ['covid19', 'pneumonia', 'normal'],
      required: true,
    },
  },
  { _id: false },
);

const SessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    index: {
      type: Number,
      required: true,
      min: 1,
    },
    kind: {
      type: String,
      enum: ['baseline', 'adaptive'],
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'finished'],
      default: 'in_progress',
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 45,
    },
    configSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    plan: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    questions: {
      type: [SessionQuestionSchema],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

SessionSchema.index({ userId: 1, index: 1 }, { unique: true });
SessionSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'in_progress' } },
);
SessionSchema.index({ userId: 1, 'questions.publicId': 1 });

const ResponseSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    questionNo: {
      type: Number,
      required: true,
      min: 1,
    },
    imageId: {
      type: String,
      required: true,
    },
    trueClass: {
      type: String,
      enum: ['covid19', 'pneumonia', 'normal'],
      required: true,
    },
    answer: {
      type: String,
      enum: ['covid19', 'pneumonia', 'normal'],
      required: true,
    },
    bucket: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    correct: {
      type: Boolean,
      required: true,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    timeMs: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

ResponseSchema.index({ sessionId: 1, questionNo: 1 }, { unique: true });

export const SessionModel =
  mongoose.models.Session || mongoose.model('Session', SessionSchema, 'sessions');

export const ResponseModel =
  mongoose.models.Response || mongoose.model('Response', ResponseSchema, 'responses');
