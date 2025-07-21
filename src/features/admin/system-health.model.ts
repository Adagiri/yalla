import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document } from 'mongoose';

export interface SystemHealthDocument extends Document {
  _id: string;

  // System metrics
  timestamp: Date;

  // API Performance
  apiMetrics: {
    responseTime: number; // Average response time in ms
    requestCount: number; // Requests in last minute
    errorRate: number; // Error percentage
    activeConnections: number;
  };

  // Database metrics
  databaseMetrics: {
    connectionCount: number;
    queryTime: number; // Average query time
    slowQueries: number;
    storage: {
      used: number; // GB
      available: number; // GB
      percentage: number;
    };
  };

  // Business metrics
  businessMetrics: {
    activeTrips: number;
    onlineDrivers: number;
    pendingRequests: number;
    systemErrors: number;
  };

  // External services
  externalServices: {
    paystack: { status: 'up' | 'down' | 'degraded'; responseTime: number };
    aws: { status: 'up' | 'down' | 'degraded'; responseTime: number };
    maps: { status: 'up' | 'down' | 'degraded'; responseTime: number };
    sms: { status: 'up' | 'down' | 'degraded'; responseTime: number };
  };

  // Overall health
  overallStatus: 'healthy' | 'warning' | 'critical';
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    component: string;
  }>;

  createdAt: Date;
}

const systemHealthSchema = new Schema<SystemHealthDocument>(
  {
    _id: { type: String, default: uuidv4 },
    timestamp: { type: Date, default: Date.now, index: true },

    apiMetrics: {
      responseTime: { type: Number, required: true },
      requestCount: { type: Number, required: true },
      errorRate: { type: Number, required: true },
      activeConnections: { type: Number, required: true },
    },

    databaseMetrics: {
      connectionCount: { type: Number, required: true },
      queryTime: { type: Number, required: true },
      slowQueries: { type: Number, required: true },
      storage: {
        used: { type: Number, required: true },
        available: { type: Number, required: true },
        percentage: { type: Number, required: true },
      },
    },

    businessMetrics: {
      activeTrips: { type: Number, required: true },
      onlineDrivers: { type: Number, required: true },
      pendingRequests: { type: Number, required: true },
      systemErrors: { type: Number, required: true },
    },

    externalServices: {
      paystack: {
        status: {
          type: String,
          enum: ['up', 'down', 'degraded'],
          required: true,
        },
        responseTime: { type: Number, required: true },
      },
      aws: {
        status: {
          type: String,
          enum: ['up', 'down', 'degraded'],
          required: true,
        },
        responseTime: { type: Number, required: true },
      },
      maps: {
        status: {
          type: String,
          enum: ['up', 'down', 'degraded'],
          required: true,
        },
        responseTime: { type: Number, required: true },
      },
      sms: {
        status: {
          type: String,
          enum: ['up', 'down', 'degraded'],
          required: true,
        },
        responseTime: { type: Number, required: true },
      },
    },

    overallStatus: {
      type: String,
      enum: ['healthy', 'warning', 'critical'],
      required: true,
    },

    alerts: [
      {
        type: { type: String, enum: ['warning', 'critical'], required: true },
        message: { type: String, required: true },
        component: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
    // TTL index for automatic deletion after 30 days
    expires: 2592000, // 30 days in seconds
  }
);

// Index for efficient time-based queries
systemHealthSchema.index({ timestamp: -1 });

export default mongoose.model<SystemHealthDocument>(
  'SystemHealth',
  systemHealthSchema
);
