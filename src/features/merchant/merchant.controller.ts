import { ContextType } from '../../types';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import { AuthPayload } from '../../utils/responses';
import MerchantService from './merchant.service';
import {
  RegisterMerchantInput,
  MerchantFilter,
  MerchantSort,
  UpdateMerchantPersonalInfoInput,
  UpdateProfilePhotoInput,
} from './merchant.type';

class MerchantController {
  static async listMerchants(
    _: any,
    {
      pagination,
      filter,
      sort,
    }: {
      pagination?: Pagination;
      filter?: MerchantFilter;
      sort?: MerchantSort;
    },
    { res }: ContextType
  ) {
    const { data, paginationResult } = await MerchantService.listMerchants(
      pagination,
      filter,
      sort
    );
    setPagePaginationHeaders(res, paginationResult);
    return data;
  }

  static async getMerchant(_: any, { id }: { id: string }) {
    return await MerchantService.getMerchantById(id);
  }

  static async loggedInMerchant(_: any, __: any, { user }: ContextType) {
    return await MerchantService.getMerchantById(user.id);
  }

  static async registerMerchant(
    _: any,
    { input }: { input: RegisterMerchantInput }
  ) {
    const response = await MerchantService.registerMerchant(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async updatePersonalInfo(
    _: any,
    { input }: { input: UpdateMerchantPersonalInfoInput },
    { user }: ContextType
  ) {
    // Use the logged in merchant's id for the update
    const updatedMerchant = await MerchantService.updateMerchantPersonalInfo(
      user.id,
      input
    );
    return updatedMerchant;
  }

  static async updateProfilePhoto(
    _: any,
    { input }: { input: UpdateProfilePhotoInput },
    { user }: ContextType
  ) {
    const updatedMerchant = await MerchantService.updateProfilePhoto(
      user.id,
      input
    );
    return updatedMerchant;
  }
}

export default MerchantController;
