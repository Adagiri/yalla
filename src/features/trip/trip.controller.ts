import { PaymentModel } from '../../constants/payment-models';
import PaymentModelService from '../payment-model/payment-model.services';
import { ContextType } from '../../types';
import { ContextUser } from '../../types/auth';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import { ErrorResponse } from '../../utils/responses';
import Driver from '../driver/driver.model';
import TripService from './trip.service';
import {
  addDriverLocationUpdateJob,
  addTripUpdateJob,
} from '../../services/job-processors.service';
import { CreateTripInput, TripFilter, TripSort } from './trip.type';
import { BackgroundRunnersService } from '../../services/background-runners.service';
import { cacheService } from '../../services/redis-cache.service';
import { AccountType } from '../../constants/general';



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

  // Get all trips (Admin only)
  static async listTrips(
    _: any,
    {
      pagination,
      filter,
      sort,
    }: { pagination?: Pagination; filter?: TripFilter; sort?: TripSort },
    { res }: ContextType
  ) {
    const { data, paginationResult } = await TripService.listTrips(
      pagination,
      filter,
      sort
    );

    setPagePaginationHeaders(res, paginationResult);
    return data;
  }

  ///////////////////////
  static async createTrip(
    _: any,
    { input }: { input: CreateTripInput },
    { user }: ContextType
  ) {
    // Use the customer ID from the authenticated user
    const tripInput = {
      ...input,
      customerId: user.id,
    };

    return await TripService.createTrip(tripInput);
  }

  // Updated driver location - now uses background job
  static async updateDriverLocationForTrip(
    _: any,
    { input }: { input: UpdateDriverLocationInput },
    { user }: ContextType
  ) {
    // Add to background job queue for processing
    await addDriverLocationUpdateJob(user.id, {
      coordinates: input.location,
      heading: input.metadata?.heading,
      speed: input.metadata?.speed,
      isOnline: true,
      isAvailable: true,
    });

    // Return immediate response
    return {
      success: true,
      message: 'Location update queued for processing',
    };
  }

  // Driver accepts trip - now uses background processing
  static async acceptTrip(
    _: any,
    { tripId }: { tripId: string },
    { user }: ContextType
  ) {
    return await TripService.acceptTrip(tripId, user.id);
  }

  // Mark driver as arrived - uses background job
  static async arrivedAtPickup(
    _: any,
    { tripId }: { tripId: string },
    { user }: ContextType
  ) {
    await addTripUpdateJob(tripId, 'driver_arrived', {
      message: 'Driver has arrived at pickup location',
      arrivedAt: new Date(),
    });

    return {
      success: true,
      message: 'Arrival status updated',
    };
  }

  static async getTripEstimate(
    _: any,
    {
      input,
    }: {
      input: {
        pickup: { coordinates: [number, number] };
        destination: { coordinates: [number, number] };
      };
    },
    { user }: ContextType
  ) {
    return await TripService.calculateTripEstimate(
      input.pickup.coordinates,
      input.destination.coordinates
    );
  }

  /**
   * Get incoming trips for driver (from Redis)
   */
  static async getIncomingTrips(_: any, __: any, { user }: ContextType) {
    if (user.accountType === AccountType.DRIVER) {
      throw new ErrorResponse(403, 'Only drivers can access incoming trips');
    }

    return await BackgroundRunnersService.getIncomingTripsForDriver(user.id);
  }

  /**
   * Get driver's queue stats
   */
  static async getDriverQueueStats(_: any, __: any, { user }: ContextType) {
    if (user.accountType === AccountType.DRIVER) {
      throw new ErrorResponse(403, 'Only drivers can access queue stats');
    }

    const incomingTrips =
      await BackgroundRunnersService.getIncomingTripsForDriver(user.id);
    const driverLocation = await cacheService.getDriverLocation(user.id);

    return {
      incomingTripsCount: incomingTrips.length,
      isOnline: driverLocation?.isOnline || false,
      isAvailable: driverLocation?.isAvailable || false,
      lastLocationUpdate: driverLocation?.updatedAt || null,
    };
  }
}

export default TripController;
