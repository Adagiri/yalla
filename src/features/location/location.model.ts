// src/features/location/location.model.ts
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface LocationDocument extends Document {
  id: string;
  name: string;
  description?: string;
  address?: string;

  // MongoDB GeoJSON format
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  // Estate/Area boundaries using GeoJSON Polygon
  boundary?: {
    type: 'Polygon';
    coordinates: number[][][]; // Array of linear rings
  };

  locationType: 'estate' | 'landmark' | 'general';
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<LocationDocument>(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    description: { type: String },
    address: { type: String },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (coords: number[]) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 && // longitude
              coords[1] >= -90 &&
              coords[1] <= 90
            ); // latitude
          },
          message: 'Invalid coordinates',
        },
      },
    },

    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
      },
      coordinates: {
        type: [[[Number]]],
        validate: {
          validator: function (coords: number[][][]) {
            // Ensure polygon is closed (first and last points are the same)
            if (!coords || coords.length === 0) return true;
            const ring = coords[0];
            return (
              ring.length >= 4 &&
              ring[0][0] === ring[ring.length - 1][0] &&
              ring[0][1] === ring[ring.length - 1][1]
            );
          },
          message: 'Invalid polygon - must be closed',
        },
      },
    },

    locationType: {
      type: String,
      enum: ['estate', 'landmark', 'general'],
      default: 'general',
    },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create geospatial indexes
LocationSchema.index({ location: '2dsphere' });
LocationSchema.index({ boundary: '2dsphere' });

const Location = mongoose.model<LocationDocument>('Location', LocationSchema);
export default Location;
