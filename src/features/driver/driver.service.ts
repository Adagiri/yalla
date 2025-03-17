import Driver, { DriverModelType } from './driver.model';
import { ErrorResponse } from '../../utils/responses';
import {
  RegisterDriverInput,
  DriverFilter,
  DriverSort,
  UpdatePersonalInfoInput,
  UpdateDriverLicenseInput,
} from './driver.type';
import { Pagination } from '../../types/list-resources';
import { listResourcesPagination } from '../../helpers/list-resources-pagination.helper';
import { filterNullAndUndefined } from '../../utils/general';
import { generateVerificationCode, hashPassword } from '../../utils/auth';
import NotificationService from '../../services/notification.services';
import { AuthChannel } from '../../constants/general';

class DriverService {
  static async listDrivers(
    pagination?: Pagination,
    filter?: DriverFilter,
    sort?: DriverSort
  ) {
    try {
      const baseFilter = {
        $or: [{ isEmailVerified: true }, { isPhoneVerified: true }],
      };

      const data = await listResourcesPagination({
        model: Driver,
        baseFilter,
        additionalFilter: filter,
        sortParam: sort,
        pagination,
      });

      return data;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching drivers', error.message);
    }
  }

  static async getDriverById(id: string) {
    try {
      const driver = await Driver.findById(id);
      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }
      return driver;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching driver', error.message);
    }
  }

  static async registerDriver(input: RegisterDriverInput) {
    try {
      const { email, phone, password, authChannel } = input;
      let existingDriver;
      let response: { token?: string; entity?: DriverModelType } = {};

      // Validate presence of email or phone based on auth channel.
      if (authChannel === AuthChannel.EMAIL && email) {
        existingDriver = await Driver.findOne({ email, isEmailVerified: true });
      } else if (authChannel === AuthChannel.SMS && phone) {
        existingDriver = await Driver.findOne({
          'phone.fullPhone': phone.fullPhone,
          isPhoneVerified: true,
        });
      } else {
        throw new ErrorResponse(400, 'Either email or phone is required');
      }

      if (existingDriver) {
        throw new ErrorResponse(
          400,
          `${authChannel === AuthChannel.EMAIL ? 'Email' : 'Phone number'} already registered`
        );
      }

      const hashedPassword = await hashPassword(password);
      const { code, encryptedToken, token, tokenExpiry } =
        generateVerificationCode(32, 10);

      let driverData: Partial<DriverModelType> = {
        password: hashedPassword,
        isEmailVerified: false,
        isPhoneVerified: false,
      };

      if (authChannel === AuthChannel.EMAIL) {
        driverData.email = email;
        driverData.emailVerificationCode = code;
        driverData.emailVerificationToken = encryptedToken;
        driverData.emailVerificationExpiry = tokenExpiry;
      } else if (authChannel === AuthChannel.SMS && phone) {
        driverData.phone = phone;
        driverData.phoneVerificationCode = code;
        driverData.phoneVerificationToken = encryptedToken;
        driverData.phoneVerificationExpiry = tokenExpiry;
      }

      // Create the new driver record.
      const driver = await Driver.create(driverData);

      // Send notifications based on auth channel.
      if (authChannel === AuthChannel.EMAIL && email) {
        await NotificationService.sendEmail({
          to: driver.email,
          template: 'AccountActivationEmailTemplate',
          data: {
            name: driver.firstname, // Adjust if necessary
            c: code[0],
            o: code[1],
            d: code[2],
            e: code[3],
          },
        });
      } else if (authChannel === AuthChannel.SMS && phone) {
        await NotificationService.sendSMS({
          to: phone.fullPhone,
          message: `Your verification code is ${code}`,
        });
      }

      response.token = token;
      response.entity = driver;
      return response;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error registering driver', error.message);
    }
  }

  static async updateDriverPersonalInfo(
    id: string,
    input: UpdatePersonalInfoInput
  ) {
    try {
      const updateData = filterNullAndUndefined({
        firstname: input.firstName,
        lastname: input.lastName,
        locationId: input.locationId,
        personalInfoSet: true,
      });

      const updatedDriver = await Driver.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      if (!updatedDriver) {
        throw new ErrorResponse(404, 'Driver not found');
      }
      return updatedDriver;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating personal info',
        error.message
      );
    }
  }

  static async updateDriverLicense(
    id: string,
    input: UpdateDriverLicenseInput
  ) {
    try {
      const updateData = filterNullAndUndefined({
        driverLicenseFront: input.driverLicenseFront,
        driverLicenseBack: input.driverLicenseBack,
        driverLicenseVerified: false, // Reset verification status upon update
      });

      const updatedDriver = await Driver.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      if (!updatedDriver) {
        throw new ErrorResponse(404, 'Driver not found');
      }
      return updatedDriver;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating driver license',
        error.message
      );
    }
  }
}

export default DriverService;
