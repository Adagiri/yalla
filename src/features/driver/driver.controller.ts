import { ContextType } from '../../types';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import { AuthPayload } from '../../utils/responses';
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
}

export default DriverController;
