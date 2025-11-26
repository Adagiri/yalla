import mongoose, { Document, Schema } from 'mongoose';

export interface SupportTicketDocument extends Document {
  ticketNumber: string;
  userId: string;
  userType: 'CUSTOMER' | 'DRIVER';
  subject: string;
  description: string;
  category: 'PAYMENT' | 'TRIP' | 'ACCOUNT' | 'TECHNICAL' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedTo?: string;
  messages: {
    senderId: string;
    senderType: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
    message: string;
    createdAt: Date;
  }[];
  attachments?: string[];
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<SupportTicketDocument>(
  {
    ticketNumber: {
      type: String,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userType: {
      type: String,
      enum: ['CUSTOMER', 'DRIVER'],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['PAYMENT', 'TRIP', 'ACCOUNT', 'TECHNICAL', 'OTHER'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    assignedTo: {
      type: String,
      index: true,
    },
    messages: [
      {
        senderId: { type: String, required: true },
        senderType: {
          type: String,
          enum: ['CUSTOMER', 'DRIVER', 'ADMIN'],
          required: true,
        },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    attachments: [String],
    resolvedAt: Date,
    closedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Generate ticket number before save
supportTicketSchema.pre('save', async function (next) {
  if (this.isNew && !this.ticketNumber) {
    try {
      // Count existing tickets
      const SupportTicketModel = this.constructor as any;
      const count = await SupportTicketModel.countDocuments();

      // Generate ticket number with timestamp and count
      const timestamp = Date.now();
      const paddedCount = String(count + 1).padStart(4, '0');
      this.ticketNumber = `TKT-${timestamp}-${paddedCount}`;
    } catch (error) {
      console.error('Error generating ticket number:', error);
      // Fallback to simple timestamp-based number
      this.ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }
  }
  next();
});

const SupportTicket = mongoose.model<SupportTicketDocument>(
  'SupportTicket',
  supportTicketSchema
);

export default SupportTicket;
