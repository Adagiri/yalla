// FILE: src/services/driver-eligibility.service.ts

import { ErrorResponse } from '../utils/responses';
import Driver from '../features/driver/driver.model';
import Vehicle from '../features/vehicle/vehicle.model';

class DriverEligibilityService {
  /**
   * Check if driver can accept trips
   * Validates: license verified AND vehicle inspection approved
   */
  static async canDriverAcceptTrips(driverId: string): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    try {
      const driver = await Driver.findById(driverId);

      if (!driver) {
        return {
          eligible: false,
          reason: 'Driver not found',
        };
      }

      // Check license
      if (!driver.driverLicenseVerified) {
        return {
          eligible: false,
          reason:
            'Your driver license must be verified before accepting trips.',
        };
      }

      // Check vehicle exists
      if (!driver.vehicleId) {
        return {
          eligible: false,
          reason: 'You must register a vehicle before accepting trips.',
        };
      }

      // Check vehicle inspection
      const vehicle = await Vehicle.findById(driver.vehicleId);

      if (!vehicle) {
        return {
          eligible: false,
          reason: 'Vehicle not found.',
        };
      }

      if (vehicle.inspectionStatus !== 'approved') {
        return {
          eligible: false,
          reason: `Your vehicle inspection is ${vehicle.inspectionStatus}. Only approved vehicles can accept trips.`,
        };
      }

      return { eligible: true };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error checking driver eligibility',
        error.message
      );
    }
  }
}

export default DriverEligibilityService;
