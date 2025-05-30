import { combineResolvers } from 'graphql-resolvers';
import TripController from './trip.controller';
import { protectEntities } from '../../utils/auth-middleware';

const tripResolvers = {
  Query: {
    // Get single trip by ID
    getTrip: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER', 'ADMIN']),
      TripController.getTrip
    ),

    // Get trip history for logged in user
    getTripHistory: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER']),
      TripController.getTripHistory
    ),

    // Get active trip for driver
    getActiveTrip: combineResolvers(
      protectEntities(['DRIVER']),
      TripController.getActiveTrip
    ),

    // Get nearby trips for driver
    getNearbyTrips: combineResolvers(
      protectEntities(['DRIVER']),
      TripController.getNearbyTrips
    ),

    // Get driver earnings
    getDriverEarnings: combineResolvers(
      protectEntities(['DRIVER']),
      TripController.getDriverEarnings
    ),

    // Find nearby drivers (for customers)
    findNearbyDrivers: combineResolvers(
      protectEntities(['CUSTOMER', 'ADMIN']),
      TripController.findNearbyDrivers
    ),

    // Calculate trip pricing estimate
    calculateTripPricing: combineResolvers(
      protectEntities(['CUSTOMER', 'ADMIN']),
      TripController.calculateTripPricing
    ),

    // List all trips (Admin only)
    listTrips: combineResolvers(
      protectEntities(['ADMIN']),
      TripController.listTrips
    ),
  },

  Mutation: {
    // Create a new trip (Customer)
    createTrip: combineResolvers(
      protectEntities(['CUSTOMER']),
      TripController.createTrip
    ),

    // Driver accepts trip
    acceptTrip: combineResolvers(
      protectEntities(['DRIVER']),
      TripController.acceptTrip
    ),

    // Update driver location during trip
    updateDriverLocation: combineResolvers(
      protectEntities(['DRIVER']),
      TripController.updateDriverLocation
    ),

    // Mark driver as arrived at pickup
    arrivedAtPickup: combineResolvers(
      protectEntities(['DRIVER']),
      TripController.arrivedAtPickup
    ),

    // Start trip with PIN verification
    startTrip: combineResolvers(
      protectEntities(['DRIVER']),
      TripController.startTrip
    ),

    // Complete trip
    completeTrip: combineResolvers(
      protectEntities(['DRIVER']),
      TripController.completeTrip
    ),

    // Cancel trip
    cancelTrip: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER']),
      TripController.cancelTrip
    ),

    // Rate trip
    rateTrip: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER']),
      TripController.rateTrip
    ),

    // Admin: Manually assign trip to driver
    assignTripToDriver: combineResolvers(
      protectEntities(['ADMIN']),
      TripController.assignTripToDriver
    ),
  },

  // Subscription resolvers for real-time updates
  Subscription: {
    // Trip status updates
    // tripUpdated: {
    //   // This would need to be implemented with your subscription system
    //   // subscribe: () => pubsub.asyncIterator(['TRIP_UPDATED']),
    //   resolve: (payload: any) => payload.tripUpdated,
    // },

    // // Driver location updates during trip
    // driverLocationUpdated: {
    //   // subscribe: () => pubsub.asyncIterator(['DRIVER_LOCATION_UPDATED']),
    //   resolve: (payload: any) => payload.driverLocationUpdated,
    // },

    // // New trip requests for drivers
    // newTripRequest: {
    //   // subscribe: () => pubsub.asyncIterator(['NEW_TRIP_REQUEST']),
    //   resolve: (payload: any) => payload.newTripRequest,
    // },
  },
};

export default tripResolvers;
