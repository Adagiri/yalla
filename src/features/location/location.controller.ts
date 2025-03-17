import LocationService from './location.service';
import { CreateLocationInput, UpdateLocationInput } from './location.types';

class LocationController {
  static async listLocations(_: any, __: any) {
    const locations = await LocationService.listLocations();
    return locations;
  }

  static async getLocation(_: any, { id }: { id: string }) {
    const location = await LocationService.getLocationById(id);
    return location;
  }

  static async createLocation(
    _: any,
    {
      input,
    }: {
      input: CreateLocationInput;
    }
  ) {
    const newLocation = await LocationService.createLocation(input);
    return newLocation;
  }

  static async updateLocation(
    _: any,
    {
      id,
      input,
    }: {
      id: string;
      input: UpdateLocationInput;
    }
  ) {
    const updatedLocation = await LocationService.updateLocation(id, input);
    return updatedLocation;
  }

  static async deleteLocation(_: any, { id }: { id: string }) {
    const response = await LocationService.deleteLocation(id);
    return response;
  }
}

export default LocationController;
