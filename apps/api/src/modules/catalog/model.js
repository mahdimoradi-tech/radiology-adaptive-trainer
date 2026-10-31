import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema(
  {
    _id: {
      type: String, // Catalog unique ID (e.g. kermany_f9ddce356c7b)
      required: true,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    trueClass: {
      type: String,
      enum: ['covid19', 'pneumonia', 'normal'],
      required: true,
    },
    source: {
      type: String,
      required: true,
    },
    difficulty: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    bucket: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    confusedWith: {
      type: String,
      enum: ['covid19', 'pneumonia', 'normal'],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

ImageSchema.index({ trueClass: 1, bucket: 1 });

export const ImageModel = mongoose.models.Image || mongoose.model('Image', ImageSchema, 'images');
