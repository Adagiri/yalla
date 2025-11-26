// Create and run: src/scripts/create-admin.ts
import mongoose from 'mongoose';
import { seedInitialAdmin } from '../seeds/admin.seed';
import { ENV } from '../config/env';

async function createInitialAdmin() {
  try {
    await mongoose.connect(ENV.MONGO_URI);
    await seedInitialAdmin();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

createInitialAdmin();
