
import Location from "./location.model";
import { ErrorResponse } from "../../utils/responses";
import { filterNullAndUndefined } from "../../utils/general";
import {
  CreateLocationInput,
  LocationFilter,
  LocationSort,
  UpdateLocationInput,
} from "./location.types";
import GoogleServices from "../../services/google.services";
import { Pagination } from "../../types/list-resources";
import { listResourcesPagination } from "../../helpers/list-resources-pagination.helper";

export class LocationService {
  static async listLocations(
    pagination?: Pagination,
    filter?: LocationFilter,
    sort?: LocationSort
  ) {
    try {
      // No baseFilter needed for locations
      const baseFilter = {};

      const data = await listResourcesPagination({
        model: Location,
        baseFilter,
        additionalFilter: filter,
        sortParam: sort,
        pagination,
      });

      return data;
    } catch (error: any) {
      throw new ErrorResponse(500, "Error fetching locations", error.message);
    }
  }

  // Other location-related methods (unchanged)
  static async getLocation(id: string) {
    try {
      const location = await Location.findById(id);
      if (!location) {
        throw new ErrorResponse(404, "Location not found");
      }
      return location;
    } catch (error: any) {
      throw new ErrorResponse(500, "Error fetching location", error.message);
    }
  }

  static async createLocation(input: any) {
    try {
      const location = new Location(input);
      await location.save();
      return location;
    } catch (error: any) {
      throw new ErrorResponse(500, "Error creating location", error.message);
    }
  }

  static async updateLocation(id: string, input: any) {
    try {
      const location = await Location.findByIdAndUpdate(id, input, {
        new: true,
      });
      if (!location) {
        throw new ErrorResponse(404, "Location not found");
      }
      return location;
    } catch (error: any) {
      throw new ErrorResponse(500, "Error updating location", error.message);
    }
  }

  static async deleteLocation(id: string) {
    try {
      const location = await Location.findByIdAndDelete(id);
      if (!location) {
        throw new ErrorResponse(404, "Location not found");
      }
      return true;
    } catch (error: any) {
      throw new ErrorResponse(500, "Error deleting location", error.message);
    }
  }

  static async toggleLocationStatus(id: string) {
    try {
      const location = await Location.findById(id);
      if (!location) {
        throw new ErrorResponse(404, "Location not found");
      }
      location.isActive = !location.isActive;
      await location.save();
      return location;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Error toggling location status",
        error.message
      );
    }
  }

  //   /**
  //    * Get a single location by ID.
  //    */
  static async getLocationById(id: string) {
    try {
      const location = await Location.findById(id);
      if (!location) {
        throw new ErrorResponse(404, "Location not found");
      }
      return location;
    } catch (error: any) {
      throw new ErrorResponse(500, "Error fetching location", error.message);
    }
  }

  static async findNearbyLocations(
    longitude: number,
    latitude: number,
    maxDistance: number,
    locationType?: string
  ) {
    try {
      const filter: any = {
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [longitude, latitude] },
            $maxDistance: maxDistance,
          },
        },
      };
      if (locationType) {
        filter.locationType = locationType;
      }
      const locations = await Location.find(filter);
      return locations;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Error finding nearby locations",
        error.message
      );
    }
  }

  static async findLocationsByPoint(longitude: number, latitude: number) {
    try {
      const locations = await Location.find({
        boundary: {
          $geoIntersects: {
            $geometry: { type: "Point", coordinates: [longitude, latitude] },
          },
        },
      });
      return locations;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Error finding locations by point",
        error.message
      );
    }
  }
}
