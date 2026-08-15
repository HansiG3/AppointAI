import mongoose from 'mongoose';
import { DOCTOR_STATUS } from '../config/constants.js';

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    specialization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Specialization',
      required: [true, 'Specialization is required'],
    },
    experience: {
      type: Number,
      min: [0, 'Experience cannot be negative'],
      default: 0,
    },
    qualification: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    status: {
      type: String,
      enum: Object.values(DOCTOR_STATUS),
      default: DOCTOR_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common query patterns
doctorSchema.index({ specialization: 1, status: 1 });
doctorSchema.index({ location: 1, status: 1 });
doctorSchema.index({ name: 'text' }); // Text index for name search

// Safe serialization
doctorSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    specialization: this.specialization,
    experience: this.experience,
    qualification: this.qualification,
    location: this.location,
    status: this.status,
  };
};

const Doctor = mongoose.model('Doctor', doctorSchema);

export default Doctor;
