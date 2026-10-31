import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    role: {
      type: String,
      enum: ['resident', 'instructor'],
      default: 'resident',
      required: true,
    },
    language: {
      type: String,
      enum: ['fa', 'en'],
      default: 'fa',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
