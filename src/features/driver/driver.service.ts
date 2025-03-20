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
import { verificationTemplate } from '../../utils/sms-templates';

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
      const { email, phone, password } = input;

      if (!email || !phone) {
        throw new ErrorResponse(400, 'Email and phone are required');
      }

      // Check if the phone number is already registered and verified
      const existingDriver = await Driver.findOne({
        'phone.fullPhone': phone.fullPhone,
        isPhoneVerified: true,
      });

      if (existingDriver) {
        throw new ErrorResponse(400, 'Phone number already registered');
      }

      const hashedPassword = await hashPassword(password);
      const { code, encryptedToken, token, tokenExpiry } =
        generateVerificationCode(32, 10);

      // Prepare driver data
      const driverData: Partial<DriverModelType> = {
        email, // Always stored without checking for duplicates
        phone,
        password: hashedPassword,
        oldPasswords: [hashedPassword],
        isEmailVerified: false, // Email is not verified
        isPhoneVerified: false, // Phone requires verification
        phoneVerificationCode: code,
        phoneVerificationToken: encryptedToken,
        phoneVerificationExpiry: tokenExpiry,
      };

      // Create the driver record
      const driver = await Driver.create(driverData);

      // Send phone verification SMS
      await NotificationService.sendSMS({
        to: phone.fullPhone,
        message: verificationTemplate(code),
      });

      return { token, entity: driver };
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
