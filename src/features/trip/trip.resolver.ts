import { combineResolvers } from 'graphql-resolvers';
import TripController from './trip.controller';
import { protectEntities } from '../../utils/auth-middleware';
import { pubsub } from '../../graphql/pubsub';
import { withFilter } from 'graphql-subscriptions';
import { SUBSCRIPTION_EVENTS } from '../../graphql/subscription-events';

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

  Subscription: {
    // Driver receives new trip requests
    newTripRequest: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.NEW_TRIP_REQUEST),
        (payload, variables, context) => {
          // Only send to the targeted driver
          return payload.newTripRequest.targetDriverId === variables.driverId;
        }
      ),
    },

    // Customer gets notified when trip is accepted
    tripAccepted: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.TRIP_ACCEPTED),
        (payload, variables, context) => {
          // Only notify the customer who requested the trip
          return payload.tripAccepted.customerId === variables.customerId;
        }
      ),
    },

    // Real-time trip status updates
    tripStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.TRIP_STATUS_CHANGED),
        (payload, variables, context) => {
          // Filter by tripId and ensure user is involved in the trip
          const trip = payload.tripStatusChanged;
          const { userId, userType } = context.user || {};

          return (
            trip._id === variables.tripId &&
            (trip.customerId === userId || trip.driverId === userId)
          );
        }
      ),
    },

    // Customer tracks driver location
    driverLocationUpdate: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.DRIVER_LOCATION_UPDATE),
        (payload, variables, context) => {
          // Only for the specific trip
          return payload.driverLocationUpdate.tripId === variables.tripId;
        }
      ),
    },
  },
};

export default tripResolvers;
