import mongoose from 'mongoose';
import Vehicle from './vehicle.model';
import { ErrorResponse } from '../../utils/responses';
import { filterNullAndUndefined } from '../../utils/general';
import {
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleFilter,
  VehicleSort,
} from './vehicle.types';
import GoogleServices from '../../services/google.services';
import { Pagination } from '../../types/list-resources';
import { listResourcesPagination } from '../../helpers/list-resources-pagination.helper';
import Driver from '../driver/driver.model';

class VehicleService {
  /**
   * List all vehicles.
   */
  static async listVehicles(
    pagination?: Pagination,
    filter?: VehicleFilter,
    sort?: VehicleSort
  ) {
    try {
      const baseFilter = {};

      const data = await listResourcesPagination({
        model: Vehicle,
        baseFilter,
        additionalFilter: filter,
        sortParam: sort,
        pagination,
      });

      return data;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching vehicles', error.message);
    }
  }

  /**
   * Get a single vehicle by ID.
   */
  static async getVehicleById(id: string) {
    try {
      const vehicle = await Vehicle.findById(id);
      if (!vehicle) {
        throw new ErrorResponse(404, 'Vehicle not found');
      }
      return vehicle;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching vehicle', error.message);
    }
  }

  /**
   * Create a new vehicle.
   */
  static async createVehicle(data: CreateVehicleInput, userId: string) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Create a new vehicle instance and save it within the transaction session
      const vehicle = new Vehicle(data);
      await vehicle.save({ session });

      // Update the driver to associate with the newly created vehicle within the same session
      await Driver.findByIdAndUpdate(
        userId,
        { vehicle: vehicle._id },
        { session }
      );

      // Commit the transaction if all operations were successful
      await session.commitTransaction();
      return vehicle;
    } catch (error: any) {
      // Abort the transaction in case of any error
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error creating vehicle', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Update an existing vehicle by ID.
   */
  static async updateVehicle(id: string, data: UpdateVehicleInput) {
    try {
      const updatedVehicle = await Vehicle.findByIdAndUpdate(id, data, {
        new: true,
      });
      if (!updatedVehicle) {
        throw new ErrorResponse(404, 'Vehicle not found');
      }
      return updatedVehicle;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error updating vehicle', error.message);
    }
  }

  /**
   * Delete a vehicle by ID.
   */
  static async deleteVehicle(id: string) {
    try {
      const result = await Vehicle.findByIdAndDelete(id);
      if (!result) {
        throw new ErrorResponse(404, 'Vehicle not found');
      }
      return true;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error deleting vehicle', error.message);
    }
  }
}

export default VehicleService;
