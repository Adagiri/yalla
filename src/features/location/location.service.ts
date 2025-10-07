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

class LocationService {
  /**
   * List all locations with pagination, filtering, and sorting.
   */
  static async listLocations(
    pagination?: Pagination,
    filter?: LocationFilter,
    sort?: LocationSort
  ) {
    try {
      // Remove the baseFilter that doesn't apply to locations
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

  /**
   * Get a single location by ID.
   */
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

  /**
   * Create a new location.
   */
  // static async createLocation(data: CreateLocationInput) {
  //   try {
  //     let locationData: any = { ...data };

  //     // If Google Services are available and name is provided, try to geocode
  //     if (data.name && !data.location) {
  //       try {
  //         const geocodedData = await GoogleServices.geocodeLocation(data.name);
  //         if (geocodedData) {
  //           locationData.location = {
  //             type: "Point",
  //             coordinates: [geocodedData.lng, geocodedData.lat],
  //           };
  //           if (!data.address && geocodedData.address) {
  //             locationData.address = geocodedData.address;
  //           }
  //         }
  //       } catch (geocodeError) {
  //         console.warn(
  //           "Geocoding failed, proceeding without coordinates:",
  //           geocodeError
  //         );
  //       }
  //     }

  //     return await Location.create(locationData);
  //   } catch (error: any) {
  //     throw new ErrorResponse(500, "Error creating location", error.message);
  //   }
  // }
  /**
   * Create a new location with duplicate checks.
   */
  static async createLocation(data: CreateLocationInput) {
    try {
      let locationData: any = { ...data };

      // If Google Services are available and name is provided, try to geocode
      if (data.name && !data.location) {
        try {
          const geocodedData = await GoogleServices.geocodeLocation(data.name);
          if (geocodedData) {
            locationData.location = {
              type: "Point",
              coordinates: [geocodedData.lng, geocodedData.lat],
            };
            if (!data.address && geocodedData.address) {
              locationData.address = geocodedData.address;
            }
          }
        } catch (geocodeError) {
          console.warn(
            "Geocoding failed, proceeding without coordinates:",
            geocodeError
          );
        }
      }

      // Prepare data for Mongoose
      const mongooseData: any = {
        name: locationData.name,
        description: locationData.description,
        address: locationData.address,
        location: locationData.location || { type: "Point", coordinates: [] },
        locationType: locationData.locationType || "GENERAL",
        isActive: locationData.isActive ?? true,
      };

      // DUPLICATE CHECK: Check for existing location by name (case-insensitive)
      const existingByName = await Location.findOne({
        name: { $regex: `^${mongooseData.name}$`, $options: "i" }, // Case-insensitive match
      });

      if (existingByName) {
        throw new ErrorResponse(
          409,
          `Location with name "${mongooseData.name}" already exists (ID: ${existingByName._id})`
        );
      }

      // Optional: Check for existing by coordinates (if provided, with tolerance)
      if (mongooseData.location.coordinates.length === 2) {
        const [lng, lat] = mongooseData.location.coordinates;
        const existingByCoords = await Location.findOne({
          "location.coordinates": {
            $near: {
              $geometry: { type: "Point", coordinates: [lng, lat] },
              $maxDistance: 10, // ~10 meters in MongoDB (meters, not degrees)
            },
          },
        });

        if (existingByCoords) {
          throw new ErrorResponse(
            409,
            `Location at coordinates [${lng}, ${lat}] already exists (Name: "${existingByCoords.name}")`
          );
        }
      }

      // No duplicates found—create the location
      const location = await Location.create(mongooseData);

      // Map to GraphQL format
      return {
        id: location.id.toString(),
        name: location.name,
        description: location.description,
        address: location.address,
        location: location.location.coordinates.length
          ? location.location
          : null,
        locationType: location.locationType,
        isActive: location.isActive,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
      };
    } catch (error: any) {
      // Handle Mongoose unique index error (if name has unique: true)
      if (error.code === 11000 && error.keyPattern?.name) {
        throw new ErrorResponse(
          409,
          `Location with name "${data.name}" already exists`
        );
      }
      throw new ErrorResponse(500, "Error creating location", error.message);
    }
  }
  /**
   * Update an existing location by ID.
   */
  static async updateLocation(id: string, data: UpdateLocationInput) {
    try {
      const filteredData = filterNullAndUndefined(data);
      let updateData: any = { ...filteredData };

      // If name is being updated and no location coordinates provided, try to geocode
      if (data.name && !data.location) {
        try {
          const geocodedData = await GoogleServices.geocodeLocation(data.name);
          if (geocodedData) {
            updateData.location = {
              type: "Point",
              coordinates: [geocodedData.lng, geocodedData.lat],
            };
            if (!data.address && geocodedData.address) {
              updateData.address = geocodedData.address;
            }
          }
        } catch (geocodeError) {
          console.warn("Geocoding failed during update:", geocodeError);
        }
      }

      const updatedLocation = await Location.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      if (!updatedLocation) {
        throw new ErrorResponse(404, "Location not found");
      }
      return updatedLocation;
    } catch (error: any) {
      throw new ErrorResponse(500, "Error updating location", error.message);
    }
  }

  /**
   * Delete a location by ID.
   */
  static async deleteLocation(id: string) {
    try {
      const result = await Location.findByIdAndDelete(id);
      if (!result) {
        throw new ErrorResponse(404, "Location not found");
      }
      return true;
    } catch (error: any) {
      throw new ErrorResponse(500, "Error deleting location", error.message);
    }
  }

  /**
   * Find nearby locations within a certain distance from a point.
   */
  static async findNearbyLocations(
    longitude: number,
    latitude: number,
    maxDistance: number,
    locationType?: string
  ) {
    try {
      const query: any = {
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistance,
          },
        },
        isActive: true,
      };

      if (locationType) {
        query.locationType = locationType;
      }

      const locations = await Location.find(query).limit(20);
      return locations;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Error finding nearby locations",
        error.message
      );
    }
  }

  /**
   * Find locations that contain a given point within their boundaries.
   */
  static async findLocationsByPoint(longitude: number, latitude: number) {
    try {
      const locations = await Location.find({
        boundary: {
          $geoIntersects: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
          },
        },
        isActive: true,
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

  /**
   * Toggle the active status of a location.
   */
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
}

export default LocationService;
