import Customer, { CustomerModelType } from './customer.model';
import { ErrorResponse } from '../../utils/responses';
import {
  RegisterCustomerInput,
  CustomerFilter,
  CustomerSort,
  UpdateCustomerPersonalInfoInput,
  UpdateProfilePhotoInput,
} from './customer.type';
import { Pagination } from '../../types/list-resources';
import { listResourcesPagination } from '../../helpers/list-resources-pagination.helper';
import { filterNullAndUndefined } from '../../utils/general';
import { generateVerificationCode, hashPassword } from '../../utils/auth';
import NotificationService from '../../services/notification.services';
import { verificationTemplate } from '../../utils/sms-templates';
import Location from '../location/location.model';

class CustomerService {
  static async listCustomers(
    pagination?: Pagination,
    filter?: CustomerFilter,
    sort?: CustomerSort
  ) {
    try {
      const baseFilter = {
        $or: [{ isEmailVerified: true }, { isPhoneVerified: true }],
      };

      const data = await listResourcesPagination({
        model: Customer,
        baseFilter,
        additionalFilter: filter,
        sortParam: sort,
        pagination,
      });

      return data;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching customers', error.message);
    }
  }

  static async getCustomerById(id: string) {
    try {
      const customer = await Customer.findById(id);
      if (!customer) {
        throw new ErrorResponse(404, 'Customer not found');
      }
      return customer;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching customer', error.message);
    }
  }

  static async registerCustomer(input: RegisterCustomerInput) {
    try {
      const { phone, password } = input;

      if (!phone) {
        throw new ErrorResponse(400, 'Phone are required');
      }

      // Check if the phone number is already registered and verified
      const existingCustomer = await Customer.findOne({
        'phone.fullPhone': phone.fullPhone,
        isPhoneVerified: true,
      });

      if (existingCustomer) {
        throw new ErrorResponse(400, 'Phone number already registered');
      }

      const hashedPassword = await hashPassword(password);
      const { code, encryptedToken, token, tokenExpiry } =
        generateVerificationCode(32, 10);

      // Prepare customer data
      const customerData: Partial<CustomerModelType> = {
        phone,
        password: hashedPassword,
        oldPasswords: [hashedPassword],
        isEmailVerified: false, // Email is not verified
        isPhoneVerified: false, // Phone requires verification
        phoneVerificationCode: code,
        phoneVerificationToken: encryptedToken,
        phoneVerificationExpiry: tokenExpiry,
      };

      // Create the customer record
      const customer = await Customer.create(customerData);

      // Send phone verification SMS
      await NotificationService.sendSMS({
        to: phone.fullPhone,
        message: verificationTemplate(code),
      });

      return { token, entity: customer };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error registering customer', error.message);
    }
  }

  static async updateCustomerPersonalInfo(
    id: string,
    input: UpdateCustomerPersonalInfoInput
  ) {
    try {
      const updateData = filterNullAndUndefined({
        firstname: input.firstName,
        lastname: input.lastName,
        locationId: input.locationId,
        email: input.email,
        personalInfoSet: true,
      });

      const location = await Location.findById(updateData.locationId);

      if (!location) {
        throw new ErrorResponse(
          404,
          `Location with id ${updateData.locationId} not found`
        );
      }

      const updatedCustomer = await Customer.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      if (!updatedCustomer) {
        throw new ErrorResponse(404, 'Customer not found');
      }
      return updatedCustomer;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating personal info',
        error.message
      );
    }
  }

  static async updateProfilePhoto(id: string, input: UpdateProfilePhotoInput) {
    try {
      const updatedCustomer = await Customer.findByIdAndUpdate(
        id,
        { profilePhotoSet: true, profilePhoto: input.src },
        {
          new: true,
        }
      );
      if (!updatedCustomer) {
        throw new ErrorResponse(404, 'Customer not found');
      }

      return updatedCustomer;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating customer license',
        error.message
      );
    }
  }
}

export default CustomerService;
