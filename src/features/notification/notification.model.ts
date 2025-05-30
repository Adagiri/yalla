import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const NotificationSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  userId: { type: String, required: true },
  userType: { type: String, enum: ['driver', 'customer'], required: true },
  type: {
    type: String,
    enum: [
      'new_request',
      'trip_accepted',
      'driver_arrived',
      'trip_started',
      'trip_completed',
      'trip_cancelled',
      'payment_received',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification
