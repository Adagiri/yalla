import Merchant, { MerchantModelType } from './merchant.model';
import { ErrorResponse } from '../../utils/responses';
import {
  RegisterMerchantInput,
  MerchantFilter,
  MerchantSort,
  UpdateMerchantPersonalInfoInput,
  UpdateProfilePhotoInput,
} from './merchant.type';
import { Pagination } from '../../types/list-resources';
import { listResourcesPagination } from '../../helpers/list-resources-pagination.helper';
import { filterNullAndUndefined } from '../../utils/general';
import { generateVerificationCode, hashPassword } from '../../utils/auth';
import NotificationService from '../../services/notification.services';
import { verificationTemplate } from '../../utils/sms-templates';
import Location from '../location/location.model';

class MerchantService {
  static async listMerchants(
    pagination?: Pagination,
    filter?: MerchantFilter,
    sort?: MerchantSort
  ) {
    try {
      const baseFilter = {
        $or: [{ isEmailVerified: true }, { isPhoneVerified: true }],
      };

      const data = await listResourcesPagination({
        model: Merchant,
        baseFilter,
        additionalFilter: filter,
        sortParam: sort,
        pagination,
      });

      return data;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching merchants', error.message);
    }
  }

  static async getMerchantById(id: string) {
    try {
      const merchant = await Merchant.findById(id);
      if (!merchant) {
        throw new ErrorResponse(404, 'Merchant not found');
      }
      return merchant;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching merchant', error.message);
    }
  }

  static async registerMerchant(input: RegisterMerchantInput) {
    try {
      const { phone, password } = input;

      if (!phone) {
        throw new ErrorResponse(400, 'Phone are required');
      }

      // Check if the phone number is already registered and verified
      const existingMerchant = await Merchant.findOne({
        'phone.fullPhone': phone.fullPhone,
        isPhoneVerified: true,
      });

      if (existingMerchant) {
        throw new ErrorResponse(400, 'Phone number already registered');
      }

      const hashedPassword = await hashPassword(password);
      const { code, encryptedToken, token, tokenExpiry } =
        generateVerificationCode(32, 10);

      // Prepare merchant data
      const merchantData: Partial<MerchantModelType> = {
        phone,
        password: hashedPassword,
        oldPasswords: [hashedPassword],
        isEmailVerified: false, // Email is not verified
        isPhoneVerified: false, // Phone requires verification
        phoneVerificationCode: code,
        phoneVerificationToken: encryptedToken,
        phoneVerificationExpiry: tokenExpiry,
      };

      // Create the merchant record
      const merchant = await Merchant.create(merchantData);

      // Send phone verification SMS
      await NotificationService.sendSMS({
        to: phone.fullPhone,
        message: verificationTemplate(code),
      });

      return { token, entity: merchant };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error registering merchant', error.message);
    }
  }

  static async updateMerchantPersonalInfo(
    id: string,
    input: UpdateMerchantPersonalInfoInput
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

      const updatedMerchant = await Merchant.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      if (!updatedMerchant) {
        throw new ErrorResponse(404, 'Merchant not found');
      }
      return updatedMerchant;
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
      const updatedMerchant = await Merchant.findByIdAndUpdate(
        id,
        { profilePhotoSet: true, profilePhoto: input.src },
        {
          new: true,
        }
      );
      if (!updatedMerchant) {
        throw new ErrorResponse(404, 'Merchant not found');
      }

      return updatedMerchant;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating merchant license',
        error.message
      );
    }
  }
}

export default MerchantService;
