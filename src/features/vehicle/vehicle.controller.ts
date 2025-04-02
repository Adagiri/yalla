import { ContextType } from '../../types';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import VehicleService from './vehicle.service';
import {
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleFilter,
  VehicleSort,
} from './vehicle.types';

class VehicleController {
  static async listVehicles(
    _: any,
    {
      pagination,
      filter,
      sort,
    }: {
      pagination?: Pagination;
      filter?: VehicleFilter;
      sort?: VehicleSort;
    },
    { res }: ContextType
  ) {
    const { data, paginationResult } = await VehicleService.listVehicles(
      pagination,
      filter,
      sort
    );
    setPagePaginationHeaders(res, paginationResult);
    return data;
  }

  static async getVehicle(_: any, { id }: { id: string }) {
    const vehicle = await VehicleService.getVehicleById(id);
    return vehicle;
  }

  static async createVehicle(
    _: any,
    {
      input,
    }: {
      input: CreateVehicleInput;
    },
    { user }: ContextType
  ) {
    const newVehicle = await VehicleService.createVehicle(input, user.id);
    return newVehicle;
  }

  static async updateVehicle(
    _: any,
    {
      id,
      input,
    }: {
      id: string;
      input: UpdateVehicleInput;
    }
  ) {
    const updatedVehicle = await VehicleService.updateVehicle(id, input);
    return updatedVehicle;
  }

  static async deleteVehicle(_: any, { id }: { id: string }) {
    const response = await VehicleService.deleteVehicle(id);
    return response;
  }
}

export default VehicleController;
