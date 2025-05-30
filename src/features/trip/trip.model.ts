import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface TripDocument extends Document {
  id: string;
  tripNumber: string;

  // Users
  driverId: string;
  customerId: string;

  // Locations with GeoJSON
  pickup: {
    address: string;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
    estateId?: string; // Reference to estate if within estate
  };

  destination: {
    address: string;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
    estateId?: string;
  };

  // Route information
  route: {
    distance: number; // in meters
    duration: number; // in seconds
    polyline?: string; // Encoded polyline from Amazon Location
  };

  // Pricing
  pricing: {
    baseAmount: number;
    surgeMultiplier: number;
    finalAmount: number;
    currency: string;
    breakdown: {
      baseFare: number;
      distanceCharge: number;
      timeCharge: number;
      surgeFee: number;
      discount: number;
    };
  };

  // Status
  status:
    | 'searching'
    | 'driver_assigned'
    | 'driver_arrived'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

  // Payment
  paymentMethod: 'cash' | 'card' | 'wallet';
  paymentStatus: 'pending' | 'completed' | 'failed';

  // Timestamps
  requestedAt: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // Real-time tracking
  driverLocation?: {
    type: 'Point';
    coordinates: [number, number];
    heading?: number;
    speed?: number;
    updatedAt: Date;
  };

  // PIN for ride verification
  verificationPin: string;

  // Ratings
  driverRating?: number;
  customerRating?: number;
  driverReview?: string;
  customerReview?: string;

  // Metadata
  tripType: 'within_estate' | 'outside_estate';
  estimatedArrival?: Date;
  actualPath?: Array<{
    type: 'Point';
    coordinates: [number, number];
    timestamp: Date;
  }>;

  assignedBy: string;
  timeline: object[];
}

const TripSchema = new Schema<TripDocument>(
  {
    _id: { type: String, default: uuidv4 },
    tripNumber: {
      type: String,
      unique: true,
      default: function () {
        return 'TRIP' + Date.now().toString(36).toUpperCase();
      },
    },

    driverId: { type: String, required: true, ref: 'Driver' },
    customerId: { type: String, required: true, ref: 'Customer' },

    pickup: {
      address: { type: String, required: true },
      location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true },
      },
      estateId: { type: String, ref: 'Location' },
    },

    destination: {
      address: { type: String, required: true },
      location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true },
      },
      estateId: { type: String, ref: 'Location' },
    },

    route: {
      distance: { type: Number, required: true },
      duration: { type: Number, required: true },
      polyline: { type: String },
    },

    pricing: {
      baseAmount: { type: Number, required: true },
      surgeMultiplier: { type: Number, default: 1 },
      finalAmount: { type: Number, required: true },
      currency: { type: String, default: 'NGN' },
      breakdown: {
        baseFare: { type: Number, required: true },
        distanceCharge: { type: Number, required: true },
        timeCharge: { type: Number, required: true },
        surgeFee: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
      },
    },

    status: {
      type: String,
      enum: [
        'searching',
        'driver_assigned',
        'driver_arrived',
        'in_progress',
        'completed',
        'cancelled',
      ],
      default: 'searching',
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'wallet'],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },

    requestedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },

    driverLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
      heading: { type: Number },
      speed: { type: Number },
      updatedAt: { type: Date },
    },

    verificationPin: {
      type: String,
      default: function () {
        return Math.floor(1000 + Math.random() * 9000).toString();
      },
    },

    driverRating: { type: Number, min: 1, max: 5 },
    customerRating: { type: Number, min: 1, max: 5 },
    driverReview: { type: String },
    customerReview: { type: String },

    tripType: {
      type: String,
      enum: ['within_estate', 'outside_estate'],
      required: true,
    },

    estimatedArrival: { type: Date },

    actualPath: [
      {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
        timestamp: { type: Date },
      },
    ],

    assignedBy: { type: String, ref: 'Admin' }, // For manual assignments
    timeline: [
      {
        event: {
          type: String,
          enum: [
            'created',
            'driver_assigned',
            'driver_arrived',
            'trip_started',
            'trip_completed',
            'cancelled',
          ],
        },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: mongoose.Schema.Types.Mixed },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for geospatial queries
TripSchema.index({ 'pickup.location': '2dsphere' });
TripSchema.index({ 'destination.location': '2dsphere' });
TripSchema.index({ driverLocation: '2dsphere' });
TripSchema.index({ status: 1, requestedAt: -1 });
TripSchema.index({ driverId: 1, status: 1 });
TripSchema.index({ customerId: 1, status: 1 });

// Virtual for trip duration
TripSchema.virtual('actualDuration').get(function () {
  if (this.startedAt && this.completedAt) {
    return Math.floor(
      (this.completedAt.getTime() - this.startedAt.getTime()) / 1000
    );
  }
  return null;
});

const Trip = mongoose.model<TripDocument>('Trip', TripSchema);
export default Trip;
