import mongoose, { Schema,  } from 'mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface VehicleDocument extends Document {
  id?: string;
  brand: string;
  model: string;
  manufactureYear: string;
  color: string;
  identificationNumber: string;
  plateNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<VehicleDocument>(
  {
    _id: { type: String, default: uuidv4 },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    manufactureYear: { type: String, required: true },
    color: { type: String, required: true },
    identificationNumber: { type: String, required: true },
    plateNumber: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Vehicle = mongoose.model<VehicleDocument>('Vehicle', VehicleSchema);

export default Vehicle;
