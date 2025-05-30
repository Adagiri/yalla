import { ContextType } from '../../types';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import LocationService from './location.service';
import {
  CreateLocationInput,
  LocationFilter,
  LocationSort,
  UpdateLocationInput,
} from './location.types';

class LocationController {
  static async listLocations(
    _: any,
    {
      pagination,
      filter,
      sort,
    }: {
      pagination?: Pagination;
      filter?: LocationFilter;
      sort?: LocationSort;
    },
    { res }: ContextType
  ) {
    const { data, paginationResult } = await LocationService.listLocations(
      pagination,
      filter,
      sort
    );
    setPagePaginationHeaders(res, paginationResult);
    return data;
  }

  static async getLocation(_: any, { id }: { id: string }) {
    return await LocationService.getLocationById(id);
  }

  static async createLocation(
    _: any,
    { input }: { input: CreateLocationInput }
  ) {
    return await LocationService.createLocation(input);
  }

  static async updateLocation(
    _: any,
    { id, input }: { id: string; input: UpdateLocationInput }
  ) {
    return await LocationService.updateLocation(id, input);
  }

  static async deleteLocation(_: any, { id }: { id: string }) {
    return await LocationService.deleteLocation(id);
  }

  static async findNearbyLocations(
    _: any,
    {
      longitude,
      latitude,
      maxDistance,
      locationType,
    }: {
      longitude: number;
      latitude: number;
      maxDistance: number;
      locationType?: string;
    }
  ) {
    return await LocationService.findNearbyLocations(
      longitude,
      latitude,
      maxDistance,
      locationType
    );
  }

  static async findLocationsByPoint(
    _: any,
    { longitude, latitude }: { longitude: number; latitude: number }
  ) {
    return await LocationService.findLocationsByPoint(longitude, latitude);
  }

  static async toggleLocationStatus(_: any, { id }: { id: string }) {
    return await LocationService.toggleLocationStatus(id);
  }
}

export default LocationController;
