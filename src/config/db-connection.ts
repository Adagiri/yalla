import mongoose from 'mongoose';
import { ENV } from './env';
import { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

function customPlugin(schema: Schema, options?: any): void {
  schema.add({
    _id: {
      type: String,
      default: uuidv4,
    },
  });

  schema.virtual('id').get(function (this: any) {
    return this._id;
  });

  schema.set('toJSON', { virtuals: true });
  schema.set('toObject', { virtuals: true });
  schema.set('timestamps', true);
}
mongoose.plugin(customPlugin);

export const connectDB = async () => {
  try {
    await mongoose.connect(ENV.MONGO_URI);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};
