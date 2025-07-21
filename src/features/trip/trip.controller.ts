import { PaymentModel } from '../../constants/payment-models';
import PaymentModelService from '../payment-model/payment-model.services';
import { ContextType } from '../../types';
import { ContextUser } from '../../types/auth';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import { ErrorResponse } from '../../utils/responses';
import Driver from '../driver/driver.model';
import TripService from './trip.service';

interface CreateTripInput {
  customerId: string;
  pickup: {
    address: string;
    coordinates: [number, number];
  };
  destination: {
    address: string;
    coordinates: [number, number];
  };
  paymentMethod: 'cash' | 'card' | 'wallet';
  priceOffered?: number;
}

interface UpdateDriverLocationInput {
  tripId: string;
  location: [number, number];
  metadata?: {
    heading?: number;
    speed?: number;
  };
}

interface StartTripInput {
  tripId: string;
  pin: string;
}

interface RateTripInput {
  tripId: string;
  rating: number;
  review?: string;
}

interface CancelTripInput {
  tripId: string;
  reason?: string;
}

class TripController {
  // Create a new trip
  static async createTrip(
    _: any,
    { input }: { input: CreateTripInput },
    { user }: { user: ContextUser }
  ) {
    try {
      // Validate coordinates are numbers
      const pickupCoords = input.pickup.coordinates;
      const destCoords = input.destination.coordinates;

      if (
        pickupCoords.some((coord) => typeof coord !== 'number' || isNaN(coord))
      ) {
        throw new ErrorResponse(400, 'Invalid pickup coordinates');
      }

      if (
        destCoords.some((coord) => typeof coord !== 'number' || isNaN(coord))
      ) {
        throw new ErrorResponse(400, 'Invalid destination coordinates');
      }

      input.customerId = user.id;
      return await TripService.createTrip(input);
    } catch (error: any) {
      if (error instanceof ErrorResponse) {
        throw error;
      }
      console.error('Trip creation controller error:', error);
      throw new ErrorResponse(500, 'Failed to create trip', error.message);
    }
  }
  // Driver accepts a trip
  static async acceptTrip(
    _: any,
    { tripId }: { tripId: string },
    { user }: ContextType
  ) {
    if (user.accountType !== 'DRIVER') {
      throw new ErrorResponse(403, 'Only drivers can accept trips');
    }

    // Check if driver can accept rides based on their payment model
    const canAcceptRides = await PaymentModelService.canDriverAcceptRides(
      user.id
    );
    if (!canAcceptRides) {
      // Get driver details to provide specific message
      const driver = await Driver.findById(user.id);

      if (driver?.paymentModel === PaymentModel.SUBSCRIPTION) {
        throw new ErrorResponse(
          403,
          'Active subscription required to accept rides. Please subscribe to a plan or contact support.'
        );
      } else {
        throw new ErrorResponse(
          403,
          'Your account is not eligible to accept rides. Please contact support.'
        );
      }
    }
    return await TripService.acceptTrip(tripId, user.id);
  }

  // Update driver location during trip
  static async updateDriverLocation(
    _: any,
    { input }: { input: UpdateDriverLocationInput },
    { user }: ContextType
  ) {
    return await TripService.updateDriverLocation(
      input.tripId,
      user.id,
      input.location,
      input.metadata
    );
  }

  // Start trip with PIN verification
  static async startTrip(
    _: any,
    { input }: { input: StartTripInput },
    { user }: ContextType
  ) {
    return await TripService.startTrip(input.tripId, user.id, input.pin);
  }

  // Complete trip
  static async completeTrip(
    _: any,
    { tripId }: { tripId: string },
    { user }: ContextType
  ) {
    return await TripService.completeTrip(tripId, user.id);
  }

  // Cancel trip
  static async cancelTrip(
    _: any,
    { input }: { input: CancelTripInput },
    { user }: ContextType
  ) {
    const cancelledBy = user.role === 'DRIVER' ? 'driver' : 'customer';
    return await TripService.cancelTrip(
      input.tripId,
      cancelledBy,
      input.reason
    );
  }

  // Rate trip
  static async rateTrip(
    _: any,
    { input }: { input: RateTripInput },
    { user }: ContextType
  ) {
    const ratedBy = user.role === 'DRIVER' ? 'driver' : 'customer';
    return await TripService.rateTrip(
      input.tripId,
      ratedBy,
      input.rating,
      input.review
    );
  }

  // Get trip history
  static async getTripHistory(
    _: any,
    { pagination }: { pagination?: Pagination },
    { user, res }: ContextType
  ) {
    const userType = user.role === 'DRIVER' ? 'driver' : 'customer';
    const paginationParams = {
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
    };

    const result = await TripService.getTripHistory(
      user.id,
      userType,
      paginationParams
    );

    // Set pagination headers
    if (res) {
      setPagePaginationHeaders(res, {
        totalDocs: result.total,
        docsRetrieved: result.trips.length,
        hasNextPage: result.page < result.totalPages,
        hasPreviousPage: result.page > 1,
        nextPage: result.page < result.totalPages ? result.page + 1 : undefined,
        previousPage: result.page > 1 ? result.page - 1 : undefined,
      });
    }

    return result.trips;
  }

  // Get single trip by ID
  static async getTrip(_: any, { id }: { id: string }, { user }: ContextType) {
    console.log(user);
    const userType =
      user.accountType === 'ADMIN'
        ? 'admin'
        : user.accountType === 'DRIVER'
          ? 'driver'
          : 'customer';

    return await TripService.getTripById(id, user.id, userType);
  }

  // Get active trip for driver
  static async getActiveTrip(_: any, __: any, { user }: ContextType) {
    return await TripService.getActiveTrip(user.id);
  }

  // Get nearby trips for driver
  static async getNearbyTrips(
    _: any,
    { location, radius }: { location: [number, number]; radius?: number },
    { user }: ContextType
  ) {
    return await TripService.getNearbyTrips(location, radius);
  }

  // Mark driver as arrived at pickup
  static async arrivedAtPickup(
    _: any,
    { tripId }: { tripId: string },
    { user }: ContextType
  ) {
    return await TripService.arrivedAtPickup(tripId, user.id);
  }

  // Calculate driver earnings
  static async getDriverEarnings(
    _: any,
    { period }: { period: 'today' | 'week' | 'month' | 'all' },
    { user }: ContextType
  ) {
    return await TripService.calculateDriverEarnings(user.id, period);
  }

  // Admin: Manually assign trip to driver
  static async assignTripToDriver(
    _: any,
    { tripId, driverId }: { tripId: string; driverId: string },
    { user }: ContextType
  ) {
    return await TripService.assignTripToDriver(tripId, driverId, user.id);
  }

  // Calculate trip pricing (for estimates)
  static async calculateTripPricing(
    _: any,
    {
      distance,
      duration,
      surgeMultiplier,
    }: {
      distance: number;
      duration: number;
      surgeMultiplier?: number;
    }
  ) {
    return TripService.calculatePricing(distance, duration, surgeMultiplier);
  }

  // Find nearby drivers
  static async findNearbyDrivers(
    _: any,
    { location, radius }: { location: [number, number]; radius?: number }
  ) {
    return await TripService.findNearbyDrivers(location, radius || 5000);
  }

  // Get all trips (Admin only)
  static async listTrips(
    _: any,
    {
      pagination,
      filter,
    }: {
      pagination?: Pagination;
      filter?: any;
    },
    { res }: ContextType
  ) {
    // This would need to be implemented in TripService for admin listing
    // For now, return empty implementation
    const paginationParams = {
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
    };

    // Placeholder - implement listTrips in TripService
    const result = {
      trips: [],
      total: 0,
      page: paginationParams.page,
      totalPages: 0,
    };

    if (res) {
      setPagePaginationHeaders(res, {
        totalDocs: result.total,
        docsRetrieved: result.trips.length,
        hasNextPage: result.page < result.totalPages,
        hasPreviousPage: result.page > 1,
        nextPage: result.page < result.totalPages ? result.page + 1 : undefined,
        previousPage: result.page > 1 ? result.page - 1 : undefined,
      });
    }

    return result.trips;
  }
}

export default TripController;
