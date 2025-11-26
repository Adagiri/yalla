import { ContextType } from '../../types';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import { AuthPayload } from '../../utils/responses';
import CustomerService from './customer.service';
import {
  RegisterCustomerInput,
  CustomerFilter,
  CustomerSort,
  UpdateCustomerPersonalInfoInput,
  UpdateCustomerLicenseInput,
  UpdateProfilePhotoInput,
} from './customer.type';

class CustomerController {
  static async listCustomers(
    _: any,
    {
      pagination,
      filter,
      sort,
    }: {
      pagination?: Pagination;
      filter?: CustomerFilter;
      sort?: CustomerSort;
    },
    { res }: ContextType
  ) {
    const { data, paginationResult } = await CustomerService.listCustomers(
      pagination,
      filter,
      sort
    );
    setPagePaginationHeaders(res, paginationResult);
    return data;
  }

  static async getCustomer(_: any, { id }: { id: string }) {
    return await CustomerService.getCustomerById(id);
  }

  static async loggedInCustomer(_: any, __: any, { user }: ContextType) {
    return await CustomerService.getCustomerById(user.id);
  }

  static async registerCustomer(
    _: any,
    { input }: { input: RegisterCustomerInput }
  ) {
    const response = await CustomerService.registerCustomer(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async updateCustomerPersonalInfo(
    _: any,
    { input }: { input: UpdateCustomerPersonalInfoInput },
    { user }: ContextType
  ) {
    // Use the logged in customer's id for the update
    const updatedCustomer = await CustomerService.updateCustomerPersonalInfo(
      user.id,
      input
    );
    return updatedCustomer;
  }

  static async updateProfilePhoto(
    _: any,
    { input }: { input: UpdateProfilePhotoInput },
    { user }: ContextType
  ) {
    const updatedCustomer = await CustomerService.updateProfilePhoto(
      user.id,
      input
    );
    return updatedCustomer;
  }
}

export default CustomerController;
