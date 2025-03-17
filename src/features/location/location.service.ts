import Location from './location.model';
import { ErrorResponse } from '../../utils/responses';
import { filterNullAndUndefined } from '../../utils/general';
import { CreateLocationInput, UpdateLocationInput } from './location.types';

class LocationService {
  /**
   * List all locations.
   */
  static async listLocations() {
    try {
      return await Location.find();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching locations', error.message);
    }
  }

  /**
   * Get a single location by ID.
   */
  static async getLocationById(id: string) {
    try {
      const location = await Location.findById(id);
      if (!location) {
        throw new ErrorResponse(404, 'Location not found');
      }
      return location;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching location', error.message);
    }
  }

  /**
   * Create a new location.
   */
  static async createLocation(data: CreateLocationInput) {
    try {
      return await Location.create(data);
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error creating location', error.message);
    }
  }

  /**
   * Update an existing location by ID.
   */
  static async updateLocation(id: string, data: UpdateLocationInput) {
    try {
      const filteredData = filterNullAndUndefined(data);
      const updatedLocation = await Location.findByIdAndUpdate(
        id,
        filteredData,
        { new: true }
      );
      if (!updatedLocation) {
        throw new ErrorResponse(404, 'Location not found');
      }
      return updatedLocation;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error updating location', error.message);
    }
  }

  /**
   * Delete a location by ID.
   */
  static async deleteLocation(id: string) {
    try {
      const result = await Location.findByIdAndDelete(id);
      if (!result) {
        throw new ErrorResponse(404, 'Location not found');
      }
      return true;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error deleting location', error.message);
    }
  }
}

export default LocationService;
