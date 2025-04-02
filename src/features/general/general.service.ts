import {
  generateAuthToken,
  generateVerificationCode,
  getEncryptedToken,
  hashPassword,
  verifyPassword,
} from '../../utils/auth';
import { ErrorResponse } from '../../utils/responses';
import { DriverModelType } from '../driver/driver.model';
import {
  AccountType,
  AuthChannel,
  AuthChannelEMAIL,
  AuthChannelSMS,
  EmailTemplate,
  UploadUrlPurposeEnum,
} from '../../constants/general';
import NotificationService from '../../services/notification.services';
import {
  loginAccessCodeTemplate,
  mfaEnabledTemplate,
  resetPasswordTemplate,
  verificationTemplate,
} from '../../utils/sms-templates';
import {
  AuthPayloadType,
  DisableMfaInput,
  EnableMfaInput,
  LoginInput,
  RequestResetPasswordInput,
  ResendCodeInput,
  ResetPasswordInput,
  VerifyCodeInput,
} from '../../types/auth';
import {
  generateRandomNumbers,
  generateRandomString,
} from '../../utils/general';
import AWSServices from '../../services/aws.services';
import PaystackService from '../../services/paystack.services';

class GeneralService {
  static async getBankCodes() {
    try {
      const banks = await PaystackService.getBanks();

      return banks.map((bank: any) => {
        return {
          name: bank.name,
          code: bank.code,
        };
      });
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching banks', error.message);
    }
  }

  /**
   * Returns the image upload URL and public URL for the file.
   * @param contentType - The MIME type of the file.
   * @param purpose - The purpose of the upload (e.g., 'profile_picture', 'complaints', 'communication').
   */
  static async getImageUploadUrl(contentType: string, purpose: string) {
    try {
      const allowedPurposes = UploadUrlPurposeEnum;
      if (!allowedPurposes.includes(purpose)) {
        throw new ErrorResponse(400, 'Unsupported purpose option');
      }

      const allowedContentTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedContentTypes.includes(contentType)) {
        throw new ErrorResponse(400, 'Please upload a jpeg or png file');
      }

      const randomString = generateRandomString(30);
      // Extract file extension from the MIME type (e.g., "image/png" => "png")
      const extension = contentType.slice(6);
      const key = `${purpose}/${randomString}.${extension}`;

      // Generate the pre-signed URL for upload.
      const uploadUrl = await AWSServices.generateS3SignedUrl(key, contentType);
      if (!uploadUrl) {
        throw new ErrorResponse(500, 'Could not generate S3 signed URL');
      }

      // Construct the public URL for accessing the file after upload.
      const url = `https://${process.env.AWS_ASSET_HOSTNAME}/${key}`;

      return {
        uploadUrl,
        url,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error generating upload URL',
        error.message
      );
    }
  }

  static async resendCode({ token, model }: ResendCodeInput) {
    const dbEncryptedToken = getEncryptedToken(token);

    const entity: any = await model.findOne({
      $or: [
        { emailVerificationToken: dbEncryptedToken },
        { phoneVerificationToken: dbEncryptedToken },
        { mfaVerificationToken: dbEncryptedToken },
      ],
    });

    if (!entity) {
      throw new ErrorResponse(404, 'Invalid token');
    }

    const isEmailVerification =
      entity.emailVerificationToken === dbEncryptedToken;
    const isPhoneVerification =
      entity.phoneVerificationToken === dbEncryptedToken;
    const isMfaVerification = entity.mfaVerificationToken === dbEncryptedToken;

    if (isEmailVerification && entity.isEmailVerified) {
      throw new ErrorResponse(400, 'Email is already verified');
    }

    if (isPhoneVerification && entity.isPhoneVerified) {
      throw new ErrorResponse(400, 'Phone is already verified');
    }

    const code = generateRandomNumbers(4);
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const data = {
      name: entity.name,
      c: code[0],
      o: code[1],
      d: code[2],
      e: code[3],
    };

    if (isEmailVerification) {
      entity.emailVerificationExpiry = expiry;
      entity.emailVerificationCode = code;

      await entity.save();

      await NotificationService.sendEmail({
        to: entity.email,
        template: EmailTemplate.ACCOUNT_ACTIVATION,
        data: data,
      });
    }

    if (isPhoneVerification) {
      entity.phoneVerificationExpiry = expiry;
      entity.phoneVerificationCode = code;

      await entity.save();

      await NotificationService.sendSMS({
        to: entity.phone?.fullPhone,
        message: verificationTemplate(code),
      });
    }

    if (isMfaVerification) {
      entity.mfaVerificationExpiry = expiry;
      entity.mfaVerificationCode = code;

      await entity.save();

      if (entity.mfaActiveMethod === AuthChannel.EMAIL) {
        await NotificationService.sendEmail({
          to: entity.email,
          template: EmailTemplate.LOGIN_ACCESS_CODE,
          data: {
            name: entity.name,
            c: code[0],
            o: code[1],
            d: code[2],
            e: code[3],
          },
        });
      }

      if (entity.mfaActiveMethod === AuthChannel.SMS) {
        await NotificationService.sendSMS({
          to: entity.phone?.fullPhone,
          message: loginAccessCodeTemplate(code),
        });
      }
    }

    return { token, entity };
  }

  static async login({
    model,
    email,
    phone,
    password,
    authChannel,
  }: LoginInput) {
    try {
      const response: AuthPayloadType = {};
      let entity: any;

      // Find user by email or phone
      if (authChannel === AuthChannel.EMAIL && email) {
        entity = await model.findOne({ email }).select('+password');
      } else if (authChannel === AuthChannel.SMS && phone) {
        entity = await model
          .findOne({ 'phone.fullPhone': phone.fullPhone })
          .select('+password');
      }

      if (!entity) throw new ErrorResponse(404, 'Invalid credentials');

      const isValidPassword = await verifyPassword(password, entity.password);
      if (!isValidPassword) throw new ErrorResponse(400, 'Invalid credentials');

      if (entity.isMFAEnabled) {
        const { code, encryptedToken, token, tokenExpiry } =
          generateVerificationCode(32, 10);

        entity.mfaVerificationCode = code;
        entity.mfaVerificationToken = encryptedToken;
        entity.mfaVerificationExpiry = tokenExpiry;
        entity.mfaActiveMethod = authChannel;
        await entity.save();

        // Send MFA Code via email or SMS
        if (authChannel === AuthChannel.EMAIL) {
          await NotificationService.sendEmail({
            to: entity.email,
            template: EmailTemplate.LOGIN_ACCESS_CODE,
            data: {
              name: entity.name,
              c: code[0],
              o: code[1],
              d: code[2],
              e: code[3],
            },
          });
        } else if (authChannel === AuthChannel.SMS) {
          await NotificationService.sendSMS({
            to: entity.phone.fullPhone,
            message: verificationTemplate(code),
          });
        }

        response.entity = entity;
        response.token = token;
      } else {
        response.entity = entity;
        response.token = generateAuthToken({
          id: entity._id,
          name: entity.name,
          email: entity.email,
          accountType: entity.accountType,
        });
      }

      return response;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error logging in', error.message);
    }
  }

  static async verifyCode({ code, model, token }: VerifyCodeInput) {
    try {
      const encryptedToken = getEncryptedToken(token);
      const now = Date.now();
      const response: any = {};

      const entity: DriverModelType | null = await model.findOne({
        $or: [
          { emailVerificationToken: encryptedToken },
          { phoneVerificationToken: encryptedToken },
          { mfaVerificationToken: encryptedToken },
        ],
      });

      if (!entity) throw new ErrorResponse(404, 'Invalid token');

      const isEmailVerification =
        entity.emailVerificationToken === encryptedToken;
      const isPhoneVerification =
        entity.phoneVerificationToken === encryptedToken;
      const isMfaVerification = entity.mfaVerificationToken === encryptedToken;

      if (isEmailVerification) {
        if (entity.emailVerificationCode !== code) {
          throw new ErrorResponse(400, 'Invalid code');
        }

        if (
          entity.emailVerificationExpiry &&
          entity.emailVerificationExpiry.getTime() < now
        ) {
          throw new ErrorResponse(400, 'Verification code has expired');
        }

        entity.isEmailVerified = true;
        entity.emailVerificationCode = null;
        entity.emailVerificationToken = null;
        entity.emailVerificationExpiry = null;
        entity.createdAt = new Date();
        if (!entity.authChannels.includes(AuthChannel.EMAIL)) {
          entity.authChannels.push(AuthChannel.EMAIL);
        }

        await entity.save();
        response.entity = entity;

        // Delete all redundant, unverified accounts related with the email
        await model.deleteMany({
          isEmailVerified: false,
          isPhoneVerified: false,
          email: entity.email,
        });

        await NotificationService.sendEmail({
          to: entity.email,
          template:
            entity.accountType !== AccountType.DRIVER
              ? 'ManagerWelcomeEmailTemplate'
              : 'UserWelcomeEmailTemplate',
          data: {
            name: entity.firstname,
          },
        });
      }

      if (isPhoneVerification) {
        if (entity.phoneVerificationCode !== code) {
          throw new ErrorResponse(400, 'Invalid code');
        }

        if (
          entity.phoneVerificationExpiry &&
          entity.phoneVerificationExpiry.getTime() < now
        ) {
          throw new ErrorResponse(400, 'Verification code has expired');
        }

        entity.isPhoneVerified = true;
        entity.phoneVerificationCode = null;
        entity.phoneVerificationToken = null;
        entity.phoneVerificationExpiry = null;
        entity.createdAt = new Date();

        if (!entity.authChannels.includes(AuthChannel.SMS)) {
          entity.authChannels.push(AuthChannel.SMS);
        }
        await entity.save();
        response.entity = entity;

        // Delete all redundant, unverified accounts related with the email
        await model.deleteMany({
          isEmailVerified: false,
          isPhoneVerified: false,
          phone: entity.phone,
        });
      }

      if (isMfaVerification) {
        if (entity.mfaVerificationCode !== code) {
          throw new ErrorResponse(400, 'Invalid code');
        }

        if (
          entity.mfaVerificationExpiry &&
          entity.mfaVerificationExpiry.getTime() < now
        ) {
          throw new ErrorResponse(400, 'Verification code has expired');
        }

        entity.mfaVerificationCode = null;
        entity.mfaVerificationToken = null;
        entity.mfaVerificationExpiry = null;

        await entity.save();
        response.entity = entity;
      }

      response.token = generateAuthToken({
        id: response.entity._id,
        name: response.entity.name,
        email: response.entity.email,
      });
      return response;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error verifying the code', error.message);
    }
  }

  static async enableMfa({ id, model, authChannel }: EnableMfaInput) {
    try {
      const entity: any = await model.findOne({ id: id });
      if (!entity) throw new ErrorResponse(404, 'User not found');

      // Ensure required information is verified
      if (authChannel === AuthChannel.EMAIL && !entity.isEmailVerified) {
        throw new ErrorResponse(400, 'Email verification is required for MFA');
      }

      if (authChannel === AuthChannel.SMS && !entity.isPhoneVerified) {
        throw new ErrorResponse(400, 'Phone verification is required for MFA');
      }

      entity.isMFAEnabled = true;

      // Send notification
      if (authChannel === AuthChannel.EMAIL) {
        await NotificationService.sendEmail({
          to: entity.email,
          template: EmailTemplate.MFA_CONFIRMATION,
          data: { name: entity.name },
        });
      }

      if (authChannel === AuthChannel.SMS) {
        await NotificationService.sendSMS({
          to: entity.phone.fullPhone,
          message: mfaEnabledTemplate(),
        });
      }

      await entity.save();
      return entity;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error enabling MFA', error.message);
    }
  }

  static async disableMfa({ id, model }: DisableMfaInput) {
    try {
      const entity: any = await model.findOne({ id: id });
      if (!entity) throw new ErrorResponse(404, 'User not found');

      entity.isMFAEnabled = false;
      await entity.save();

      return entity;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error disabling MFA', error.message);
    }
  }

  static async requestResetPassword({
    email,
    phone,
    model,
    authChannel,
  }: RequestResetPasswordInput): Promise<Boolean> {
    try {
      let entity: DriverModelType | null;

      if (
        !authChannel ||
        (authChannel !== AuthChannelEMAIL && authChannel !== AuthChannelSMS)
      ) {
        throw new ErrorResponse(400, 'Invalid or missing authChannel');
      }

      if (authChannel === AuthChannelEMAIL) {
        if (!email) {
          throw new ErrorResponse(400, 'Email must be provided');
        }

        entity = await model.findOne({ email, isEmailVerified: true });
        if (!entity) throw new ErrorResponse(404, 'Email not registered');

        const { code, encryptedToken, tokenExpiry } = generateVerificationCode(
          32,
          10
        );
        entity.resetPasswordCode = code;
        entity.resetPasswordExpiry = tokenExpiry;
        entity.resetPasswordToken = encryptedToken;

        await entity.save();

        await NotificationService.sendEmail({
          to: entity.email,
          template: EmailTemplate.RESET_PASSWORD_REQUEST,
          data: { c: code[0], o: code[1], d: code[2], e: code[3] },
        });
      }

      if (authChannel === AuthChannelSMS) {
        if (!phone) {
          throw new ErrorResponse(400, 'Phone number must be provided');
        }

        entity = await model.findOne({
          'phone.fullPhone': phone.fullPhone,
          isPhoneVerified: true,
        });
        if (!entity)
          throw new ErrorResponse(404, 'Phone number not registered');

        const { code, encryptedToken, token, tokenExpiry } =
          generateVerificationCode(32, 10);
        entity.resetPasswordCode = code;
        entity.resetPasswordExpiry = tokenExpiry;
        entity.resetPasswordToken = encryptedToken;

        await entity.save();

        await NotificationService.sendSMS({
          to: phone.fullPhone,
          message: resetPasswordTemplate(code),
        });
      }

      return true;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error processing reset password request',
        error.message
      );
    }
  }

  static async resetPassword({
    code,
    model,
    token,
    password,
  }: ResetPasswordInput): Promise<Boolean> {
    try {
      const encryptedToken = getEncryptedToken(token);

      const entity: DriverModelType | null = await model.findOne({
        resetPasswordToken: encryptedToken,
      });

      if (!entity) throw new ErrorResponse(404, 'Invalid token');

      if (
        entity.resetPasswordCode !== code ||
        entity.resetPasswordExpiry! < new Date()
      ) {
        throw new ErrorResponse(400, 'Invalid or expired reset code');
      }

      if (entity.resetPasswordCode !== code) {
        throw new ErrorResponse(400, 'Invalid code');
      }

      entity.password = await hashPassword(password);
      entity.resetPasswordCode = null;
      entity.resetPasswordToken = null;
      entity.resetPasswordExpiry = null;
      await entity.save();

      return true;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error resetting password', error.message);
    }
  }
}

export default GeneralService;
