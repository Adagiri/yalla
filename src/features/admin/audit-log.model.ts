import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document } from 'mongoose';

export interface AuditLogDocument extends Document {
  _id: string;

  // Who performed the action
  adminId: string;
  adminEmail: string;
  adminRole: string;

  // What action was performed
  action: string;
  resource: string;
  resourceId?: string;

  // Action details
  changes?: {
    before?: any;
    after?: any;
    fieldsChanged?: string[];
  };

  // Context
  httpMethod?: string;
  endpoint?: string;
  userAgent?: string;
  ipAddress?: string;

  // Result
  success: boolean;
  errorMessage?: string;

  // Metadata
  timestamp: Date;
  sessionId?: string;
  requestId?: string;

  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    _id: { type: String, default: uuidv4 },

    // Actor
    adminId: { type: String, required: true, index: true },
    adminEmail: { type: String, required: true },
    adminRole: { type: String, required: true },

    // Action
    action: { type: String, required: true, index: true },
    resource: { type: String, required: true, index: true },
    resourceId: { type: String, index: true },

    // Changes
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
      fieldsChanged: { type: [String] },
    },

    // Context
    httpMethod: { type: String },
    endpoint: { type: String },
    userAgent: { type: String },
    ipAddress: { type: String, index: true },

    // Result
    success: { type: Boolean, required: true, index: true },
    errorMessage: { type: String },

    // Metadata
    timestamp: { type: Date, default: Date.now, index: true },
    sessionId: { type: String },
    requestId: { type: String },
  },
  {
    timestamps: true,
    // TTL index for automatic deletion after 2 years
    expires: 63072000, // 2 years in seconds
  }
);

// Compound indexes for efficient querying
auditLogSchema.index({ adminId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1, success: 1 });

export default mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
