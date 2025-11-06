import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface VehicleDocument extends Document {
  _id: string;
  brand: string;
  modelName: string;
  manufactureYear: string;
  color: string;
  identificationNumber: string;
  plateNumber: string;

  // ONLY INSPECTION FIELDS
  driverId?: string;
  inspectionStatus: 'pending' | 'approved' | 'rejected' | 'expired';
  lastInspectionDate?: Date;
  nextInspectionDue?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

const VehicleSchema = new Schema<VehicleDocument>(
  {
    _id: { type: String, default: uuidv4 },
    brand: { type: String, required: true },
    modelName: { type: String, required: true },
    manufactureYear: { type: String, required: true },
    color: { type: String, required: true },
    identificationNumber: { type: String, required: true },
    plateNumber: { type: String, required: true, unique: true },

    // INSPECTION FIELDS
    driverId: { type: String, ref: 'Driver' },
    inspectionStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },
    lastInspectionDate: { type: Date },
    nextInspectionDue: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
VehicleSchema.index({ plateNumber: 1 });
VehicleSchema.index({ driverId: 1 });
VehicleSchema.index({ inspectionStatus: 1 });

// Auto-expire inspection if due date passed
VehicleSchema.pre<VehicleDocument>('save', function (next) {
  if (this.nextInspectionDue && this.nextInspectionDue < new Date()) {
    if (this.inspectionStatus === 'approved') {
      this.inspectionStatus = 'expired';
    }
  }
  next();
});

const Vehicle = mongoose.model<VehicleDocument>('Vehicle', VehicleSchema);

export default Vehicle;
