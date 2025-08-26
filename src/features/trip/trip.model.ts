import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { PaymentModel, PaymentModelEnum } from '../../constants/payment-models';

export interface TripDocument extends Document {
  _id: string;
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
    | 'drivers_found'
    | 'driver_assigned'
    | 'driver_arrived'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

  // Payment
  paymentMethod: 'cash' | 'card' | 'wallet';

  // Timestamps
  requestedAt: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: 'customer' | 'driver';
  cancellationReason?: String;

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
  estimatedArrival?: Date;
  actualPath?: Array<{
    type: 'Point';
    coordinates: [number, number];
    timestamp: Date;
  }>;

  assignedBy: string;
  timeline: object[];

  // Payment-related fields
  paymentReference?: string; // Paystack or other payment reference
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';

  // Commission and earnings breakdown
  driverEarnings?: number; // Amount driver receives (in kobo)
  platformCommission?: number; // Platform commission (in kobo)

  // Payment processing
  paymentProcessedAt?: Date;
  paymentFailureReason?: string;

  // Refund information
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;

  // Add to TripDocument interface and schema
  paymentModel: PaymentModel;

  commissionRate: number;

  // Cash payment specific
  cashReceived?: boolean; // Driver confirms cash receipt
  cashReceivedAt?: Date;

  // Card payment specific
  cardPaymentData?: {
    authorizationCode?: string;
    lastFour?: string;
    brand?: string;
    bank?: string;
  };
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

    driverId: { type: String, ref: 'Driver' },
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
      duration: {
        type: Number,
        required: true,
        set: function (value: number) {
          return Math.round(value);
        },
      },
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
        'drivers_found',
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

    requestedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['driver', 'customer'] },
    cancellationReason: { type: String },

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

    paymentReference: { type: String, index: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },

    driverEarnings: { type: Number }, // in kobo
    platformCommission: { type: Number }, // in kobo

    // Add to TripDocument interface and schema
    paymentModel: {
      type: String,
      enum: PaymentModelEnum
    },

    commissionRate: { type: Number }, // Commission rate used

    paymentProcessedAt: { type: Date },
    paymentFailureReason: { type: String },

    refundAmount: { type: Number },
    refundReason: { type: String },
    refundedAt: { type: Date },

    cashReceived: { type: Boolean, default: false },
    cashReceivedAt: { type: Date },

    cardPaymentData: {
      authorizationCode: String,
      lastFour: String,
      brand: String,
      bank: String,
    },
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

TripSchema.index({ paymentReference: 1 });
TripSchema.index({ paymentStatus: 1 });
TripSchema.index({ paymentProcessedAt: -1 });
TripSchema.index({ driverId: 1, paymentStatus: 1 });
TripSchema.index({ customerId: 1, paymentStatus: 1 });

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
