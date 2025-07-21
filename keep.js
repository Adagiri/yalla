//   static async updateDriverLocation(tripId: string, driverId: string, coordinates: [number, number]) {
//     // ... existing location update logic ...
//     const trip = await Trip.findOneAndUpdate(
//       { _id: tripId, driverId },
//       { driverLocation: { type: 'Point', coordinates, updatedAt: new Date() } },
//       { new: true }
//     );

//     // Publish location update
//     await SubscriptionService.publishDriverLocationUpdate({
//       tripId,
//       driverLocation: { coordinates },
//       estimatedArrival: trip.estimatedArrival,
//       tripStatus: trip.status,
//     });

//     return trip;
//   }
// }


