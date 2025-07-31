import { addDriverLocationUpdateJob, addDriverStatusUpdateJob } from '../../services/job-processors.service';
import { cacheService } from '../../services/redis-cache.service';
import { ContextType } from '../../types';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import { AuthPayload, ErrorResponse } from '../../utils/responses';
import DriverService from './driver.service';
import {
  RegisterDriverInput,
  DriverFilter,
  DriverSort,
  UpdateDriverPersonalInfoInput,
  UpdateDriverLicenseInput,
  UpdateProfilePhotoInput,
} from './driver.type';

class DriverController {
  static async listDrivers(
    _: any,
    {
      pagination,
      filter,
      sort,
    }: { pagination?: Pagination; filter?: DriverFilter; sort?: DriverSort },
    { res }: ContextType
  ) {
    const { data, paginationResult } = await DriverService.listDrivers(
      pagination,
      filter,
      sort
    );
    setPagePaginationHeaders(res, paginationResult);
    return data;
  }

  static async getDriver(_: any, { id }: { id: string }) {
    return await DriverService.getDriverById(id);
  }

  static async loggedInDriver(_: any, __: any, { user }: ContextType) {
    return await DriverService.getDriverById(user.id);
  }

  static async registerDriver(
    _: any,
    { input }: { input: RegisterDriverInput }
  ) {
    const response = await DriverService.registerDriver(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async updateDriverPersonalInfo(
    _: any,
    { input }: { input: UpdateDriverPersonalInfoInput },
    { user }: ContextType
  ) {
    // Use the logged in driver's id for the update
    const updatedDriver = await DriverService.updateDriverPersonalInfo(
      user.id,
      input
    );
    return updatedDriver;
  }

  static async updateDriverLicense(
    _: any,
    { input }: { input: UpdateDriverLicenseInput },
    { user }: ContextType
  ) {
    const updatedDriver = await DriverService.updateDriverLicense(
      user.id,
      input
    );
    return updatedDriver;
  }

  static async updateProfilePhoto(
    _: any,
    { input }: { input: UpdateProfilePhotoInput },
    { user }: ContextType
  ) {
    const updatedDriver = await DriverService.updateProfilePhoto(
      user.id,
      input
    );
    return updatedDriver;
  }

  /**
   * Update driver location - now uses background jobs
   */
  static async updateDriverLocation(
    _: any,
    {
      input,
    }: {
      input: {
        coordinates: [number, number];
        heading?: number;
        speed?: number;
      };
    },
    { user }: ContextType
  ) {
    // Add location update to background job queue
    await addDriverLocationUpdateJob(user.id, {
      coordinates: input.coordinates,
      heading: input.heading,
      speed: input.speed,
      isOnline: true,
      isAvailable: true, // This should be determined by driver's current state
    });

    // Return immediate response
    return {
      success: true,
      message: 'Location update queued for processing',
      timestamp: new Date(),
    };
  }

  /**
   * Update driver online/offline status
   */
  static async updateDriverStatus(
    _: any,
    {
      input,
    }: {
      input: {
        isOnline: boolean;
        isAvailable?: boolean;
      };
    },
    { user }: ContextType
  ) {
    // If going offline, set unavailable as well
    const isAvailable = input.isOnline ? (input.isAvailable ?? true) : false;

    // Add status update to background job queue
    await addDriverStatusUpdateJob(user.id, {
      isOnline: input.isOnline,
      isAvailable,
    });

    // If going offline, also update location to remove from geo index
    if (!input.isOnline) {
      await cacheService.removeDriverLocation(user.id);
    }

    return {
      success: true,
      message: `Driver status updated: ${input.isOnline ? 'online' : 'offline'}`,
      timestamp: new Date(),
    };
  }

  /**
   * Get nearby drivers (for admin/testing)
   */
  static async getNearbyDrivers(
    _: any,
    {
      coordinates,
      radius = 5,
    }: {
      coordinates: [number, number];
      radius?: number;
    },
    { user }: ContextType
  ) {
    // Get from Redis cache
    const driverIds = await cacheService.findNearbyDrivers(coordinates, radius);

    // Get full driver details from database
    const drivers = await DriverService.getDriversByIds(driverIds);

    return drivers.map((driver) => ({
      ...driver,
      distance: 0, // Could calculate actual distance if needed
    }));
  }

  /**
   * Get driver's current location from cache
   */
  static async getDriverLocation(
    _: any,
    { driverId }: { driverId?: string },
    { user }: ContextType
  ) {
    const targetDriverId = driverId || user.id;

    // Only allow drivers to see their own location, or admins to see any
    if (user.role !== 'ADMIN' && targetDriverId !== user.id) {
      throw new ErrorResponse(403, 'Unauthorized to view this driver location');
    }

    const location = await cacheService.getDriverLocation(targetDriverId);

    if (!location) {
      return null;
    }

    return {
      driverId: location.driverId,
      coordinates: location.coordinates,
      heading: location.heading,
      speed: location.speed,
      isOnline: location.isOnline,
      isAvailable: location.isAvailable,
      lastUpdated: location.updatedAt,
    };
  }
}

export default DriverController;
