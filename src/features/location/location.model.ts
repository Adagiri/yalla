import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Bounds {
  northeast: Coordinates;
  southwest: Coordinates;
}

export interface LocationData {
  lat: number;
  lng: number;
  bounds: Bounds | null;
  address?: string; // Optional address field
}

export interface LocationDocument extends Document {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  bounds?: Bounds | null;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<LocationDocument>(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    description: { type: String },

    // Coordinates for the location
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },

    // Optional bounds object, useful for representing an area
    bounds: {
      northeast: {
        lat: { type: Number },
        lng: { type: Number },
      },
      southwest: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },

    // Optional formatted address (from geocoding results)
    address: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Location = mongoose.model<LocationDocument>('Location', LocationSchema);

export default Location;
