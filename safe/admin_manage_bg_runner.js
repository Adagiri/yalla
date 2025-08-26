// // src/services/background-runners.service.ts - Add monitoring methods

// /**
//  * Get background runners status and statistics
//  */
// static async getStatus() {
//   const searchingTripsCount = await Trip.countDocuments({ status: 'searching' });
//   const driversFoundTripsCount = await Trip.countDocuments({ status: 'drivers_found' });
  
//   // Get incoming trips count across all drivers
//   const pattern = 'incoming_trips:*';
//   const keys = await cacheService.redis.keys(pattern);
  
//   const stats = {
//     isRunning: this.isRunning,
//     searchingTrips: searchingTripsCount,
//     driversFoundTrips: driversFoundTripsCount,
//     totalIncomingTripsInRedis: keys.length,
//     lastRunTime: new Date(),
//     uptimeSeconds: this.isRunning ? Math.floor(process.uptime()) : 0,
//   };

//   return stats;
// }

// /**
//  * Get detailed Redis inspection for debugging
//  */
// static async getRedisInspection() {
//   try {
//     // Get all incoming trips
//     const incomingTripsPattern = 'incoming_trips:*';
//     const incomingKeys = await cacheService.redis.keys(incomingTripsPattern);
    
//     // Get all driver locations
//     const driverLocationPattern = 'driver:location:*';
//     const driverLocationKeys = await cacheService.redis.keys(driverLocationPattern);
    
//     // Group incoming trips by driver
//     const tripsByDriver: Record<string, number> = {};
//     incomingKeys.forEach(key => {
//       const parts = key.split(':');
//       const driverId = parts[1];
//       tripsByDriver[driverId] = (tripsByDriver[driverId] || 0) + 1;
//     });

//     return {
//       totalIncomingTrips: incomingKeys.length,
//       totalOnlineDrivers: driverLocationKeys.length,
//       tripsByDriver,
//       sampleIncomingTrips: incomingKeys.slice(0, 10), // First 10 keys for debugging
//       timestamp: new Date(),
//     };
//   } catch (error: any) {
//     return {
//       error: error.message,
//       timestamp: new Date(),
//     };
//   }
// }

// // ============================================
// // src/features/admin/admin.controller.ts - Add admin controls

// /**
//  * Get background runners status (Admin only)
//  */
// static async getBackgroundRunnersStatus(_: any, __: any, { user }: ContextType) {
//   if (user.role !== 'ADMIN') {
//     throw new ErrorResponse(403, 'Admin access required');
//   }

//   return await BackgroundRunnersService.getStatus();
// }

// /**
//  * Manually trigger driver search runner (Admin only)
//  */
// static async triggerDriverSearchRunner(_: any, __: any, { user }: ContextType) {
//   if (user.role !== 'ADMIN') {
//     throw new ErrorResponse(403, 'Admin access required');
//   }

//   try {
//     // Manually run the driver search process
//     await BackgroundRunnersService['runDriverSearchRunner']();
//     return {
//       success: true,
//       message: 'Driver search runner executed manually',
//       timestamp: new Date(),
//     };
//   } catch (error: any) {
//     throw new ErrorResponse(500, 'Failed to trigger driver search runner', error.message);
//   }
// }

// /**
//  * Manually trigger cleanup runner (Admin only)
//  */
// static async triggerCleanupRunner(_: any, __: any, { user }: ContextType) {
//   if (user.role !== 'ADMIN') {
//     throw new ErrorResponse(403, 'Admin access required');
//   }

//   try {
//     await BackgroundRunnersService['runCleanupRunner']();
//     return {
//       success: true,
//       message: 'Cleanup runner executed manually',
//       timestamp: new Date(),
//     };
//   } catch (error: any) {
//     throw new ErrorResponse(500, 'Failed to trigger cleanup runner', error.message);
//   }
// }

// /**
//  * Get Redis inspection data (Admin only)
//  */
// static async getRedisInspection(_: any, __: any, { user }: ContextType) {
//   if (user.role !== 'ADMIN') {
//     throw new ErrorResponse(403, 'Admin access required');
//   }

//   return await BackgroundRunnersService.getRedisInspection();
// }

// // ============================================
// // src/routes/admin.ts - Add admin API endpoints

// import { BackgroundRunnersService } from '../services/background-runners.service';

// // Add to your admin routes
// adminRouter.get('/background-runners/status', async (req, res) => {
//   try {
//     const status = await BackgroundRunnersService.getStatus();
//     res.json(status);
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// });

// adminRouter.post('/background-runners/trigger/search', async (req, res) => {
//   try {
//     // Manually trigger search runner
//     await BackgroundRunnersService['runDriverSearchRunner']();
//     res.json({ success: true, message: 'Search runner triggered' });
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// });

// adminRouter.post('/background-runners/trigger/cleanup', async (req, res) => {
//   try {
//     // Manually trigger cleanup runner
//     await BackgroundRunnersService['runCleanupRunner']();
//     res.json({ success: true, message: 'Cleanup runner triggered' });
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// });

// adminRouter.get('/redis/inspection', async (req, res) => {
//   try {
//     const inspection = await BackgroundRunnersService.getRedisInspection();
//     res.json(inspection);
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============================================
// // src/routes/health.ts - Add background runners health check

// healthRouter.get('/health/background-runners', async (req, res) => {
//   try {
//     const status = await BackgroundRunnersService.getStatus();
    
//     const healthStatus = status.isRunning ? 'healthy' : 'unhealthy';
//     const statusCode = status.isRunning ? 200 : 503;
    
//     res.status(statusCode).json({
//       status: healthStatus,
//       timestamp: new Date(),
//       runners: status,
//     });
//   } catch (error: any) {
//     res.status(503).json({
//       status: 'unhealthy',
//       timestamp: new Date(),
//       error: error.message,
//     });
//   }
// });