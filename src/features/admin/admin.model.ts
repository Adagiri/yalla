import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

interface Admin extends Document {
  name: string;
  email: string;
  phone: string;
  accountType: string;
}

const adminSchema = new Schema<Admin>(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    accountType: { type: String, required: true, default: 'ADMIN' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Admin = mongoose.model<Admin>('Admin', adminSchema);

export default Admin;
