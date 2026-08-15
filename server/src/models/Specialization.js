import mongoose from 'mongoose';
import { SPECIALIZATION_STATUS } from '../config/constants.js';

const specializationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Specialization name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
    },
    aliases: {
      type: [String],
      default: [],
      // Store lowercase for case-insensitive matching
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: Object.values(SPECIALIZATION_STATUS),
      default: SPECIALIZATION_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
specializationSchema.index({ status: 1 });
// Normalize aliases to lowercase before saving
specializationSchema.pre('save', function (next) {
  if (this.aliases && this.aliases.length > 0) {
    this.aliases = this.aliases.map((a) => a.toLowerCase().trim());
  }
  next();
});

// Safe serialization for API responses
specializationSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    aliases: this.aliases,
    description: this.description,
    status: this.status,
  };
};

const Specialization = mongoose.model('Specialization', specializationSchema);

export default Specialization;
