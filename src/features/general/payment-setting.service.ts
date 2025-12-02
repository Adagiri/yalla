import { ErrorResponse } from '../../utils/responses';
import PaymentSetting, { IPaymentSetting } from './payment-setting.model';
import {
  CreatePaymentSettingInput,
  UpdatePaymentSettingInput,
} from './general.types';
export class PaymentSettingService {
  static async createPaymentSetting(
    input: CreatePaymentSettingInput
  ): Promise<IPaymentSetting> {
    try {
      const setting = new PaymentSetting({
        ...input,
        currency: 'NGN',
        isActive: false,
      });

      await setting.save();
      return setting;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ErrorResponse(
          400,
          'An active payment setting already exists'
        );
      }
      throw new ErrorResponse(
        500,
        'Failed to create payment settings',
        error.message
      );
    }
  }

  static async updatePaymentSetting(
    id: string,
    input: UpdatePaymentSettingInput
  ): Promise<IPaymentSetting> {
    try {
      const setting = await PaymentSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, 'Payment settings not found');
      }

      // if activating this setting, deactivate others
      if (input.isActive === true && !setting.isActive) {
        await PaymentSetting.updateMany(
          { _id: { $ne: id }, isActive: true },
          { $set: { isActive: false } }
        );
      }

      Object.assign(setting, input);
      await setting.save();

      return setting;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to update payment settings',
        error.message
      );
    }
  }

  static async activatePaymentSetting(id: string): Promise<IPaymentSetting> {
    try {
      const setting = await PaymentSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, 'Payment settings not found');
      }

      await PaymentSetting.updateMany(
        { _id: { $ne: id }, isActive: true },
        { $set: { isActive: false } }
      );

      setting.isActive = true;
      await setting.save();

      return setting;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to activate payment settings',
        error.message
      );
    }
  }

  static async deactivatePaymentSetting(id: string): Promise<IPaymentSetting> {
    try {
      const setting = await PaymentSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, 'Payment settings not found');
      }

      setting.isActive = false;
      await setting.save();

      return setting;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to deactivate payment settings',
        error.message
      );
    }
  }

  static async getActivePaymentSetting(): Promise<IPaymentSetting | null> {
    try {
      return await PaymentSetting.findOne({ isActive: true });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to fetch payment settings',
        error.message
      );
    }
  }

  static async getPaymentSettings(): Promise<IPaymentSetting> {
    try {
      let settings = await this.getActivePaymentSetting();

      if (!settings) {
        settings = await this.createDefaultPaymentSettings();
      }

      return settings;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to fetch payment settings',
        error.message
      );
    }
  }

  static async getPaymentSettingHistory(
    page: number = 1,
    limit: number = 10
  ): Promise<{ settings: IPaymentSetting[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const [settings, total] = await Promise.all([
        PaymentSetting.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        PaymentSetting.countDocuments(),
      ]);

      return { settings, total };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to fetch payment settings history',
        error.message
      );
    }
  }

  private static async createDefaultPaymentSettings(): Promise<IPaymentSetting> {
    const defaultSettings = new PaymentSetting({
      cashPaymentsEnabled: true,
      walletPaymentsEnabled: true,
      paystackEnabled: true,
      flutterwaveEnabled: false,
      minimumWalletBalance: 100,
      processingFeeRate: 2.5,
      autoTopupEnabled: false,
      currency: 'NGN',
      isActive: true,
    });

    await defaultSettings.save();
    return defaultSettings;
  }
}

export default PaymentSettingService;
