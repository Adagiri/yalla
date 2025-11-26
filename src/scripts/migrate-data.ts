import mongoose from 'mongoose';
import Vehicle from '../features/vehicle/vehicle.model';
import Customer from '../features/customer/customer.model';
import { ENV } from '../config/env';

async function migrate() {
  try {
    console.log('🚀 Starting migration...');
    await mongoose.connect(ENV.MONGO_URI);
    console.log('✅ Connected');

    // Migrate vehicles
    const vehicles = await Vehicle.updateMany(
      { inspectionStatus: { $exists: false } },
      { $set: { inspectionStatus: 'pending' } }
    );
    console.log(`✅ Updated ${vehicles.modifiedCount} vehicles`);

    // Migrate customers
    const customers = await Customer.updateMany(
      { outstandingBalance: { $exists: false } },
      { $set: { outstandingBalance: 0, accountStatus: 'active' } }
    );
    console.log(`✅ Updated ${customers.modifiedCount} customers`);

    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrate().then(() => process.exit(0));
