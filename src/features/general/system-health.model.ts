import mongoose, { Schema, Document } from 'mongoose';

// NB: this needs model need to align with  system health data (realtime); this is just placeholder
export interface ISystemHealth {
  // Database Metrics
  totalRecords: number;
  databaseUsagePercent: number;

  // Storage Metrics
  usedSpaceGB: number;
  storageUsagePercent: number;

  // User Metrics
  activeUsersOnline: number;
  peakUsersToday: number;
  userUtilizationPercent: number;

  // System Metrics
  serverUptimeHours: number;
  averageResponseTime: number;
  errorRate: number;

  // Timestamps
  lastUpdated: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISystemHealthDocument extends ISystemHealth, Document {}

const SystemHealthSchema = new Schema<ISystemHealthDocument>(
  {
    totalRecords: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    databaseUsagePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    usedSpaceGB: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    storageUsagePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    activeUsersOnline: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    peakUsersToday: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    userUtilizationPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    serverUptimeHours: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    averageResponseTime: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    errorRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'system_health',
  }
);

// only one active system health record
SystemHealthSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

// export the model with the correct type
export default mongoose.model<ISystemHealthDocument>(
  'SystemHealth',
  SystemHealthSchema
);
