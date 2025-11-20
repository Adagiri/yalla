import { ErrorResponse } from '../../utils/responses';
import GeneralSetting, { IGeneralSetting } from './general-setting.model';
import {
  CreateGeneralSettingInput,
  UpdateGeneralSettingInput,
} from './general.types';

export class GeneralSettingService {
  /**
   * Create new general settings
   */
  static async createGeneralSetting(
    input: CreateGeneralSettingInput
  ): Promise<IGeneralSetting> {
    try {
      // validate that  multiple active settings does not exist t
      const existingActive = await GeneralSetting.findOne({ isActive: true });
      if (existingActive) {
        throw new ErrorResponse(
          400,
          'An active setting already exists. Please deactivate it first or update the existing one.'
        );
      }

      const setting = new GeneralSetting({
        ...input,
        // new settings become active by default
        isActive: true,
      });

      await setting.save();
      return setting;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ErrorResponse(400, 'An active setting already exists');
      }
      throw new ErrorResponse(
        500,
        'Failed to create general settings',
        error.message
      );
    }
  }

  /**
   * Update existing general settings
   */
  static async updateGeneralSetting(
    id: string,
    input: UpdateGeneralSettingInput
  ): Promise<IGeneralSetting> {
    try {
      const setting = await GeneralSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, 'General settings not found');
      }

      // if activating this setting, deactivate others
      if (input.isActive === true && !setting.isActive) {
        await GeneralSetting.updateMany(
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
        'Failed to update general settings',
        error.message
      );
    }
  }

  /**
   * Get active general settings
   */
  static async getActiveGeneralSetting(): Promise<IGeneralSetting | null> {
    try {
      return await GeneralSetting.findOne({ isActive: true });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to fetch general settings',
        error.message
      );
    }
  }

  /**
   * Get general settings with fallback to default
   */
  static async getGeneralSettings(): Promise<IGeneralSetting> {
    try {
      let settings = await this.getActiveGeneralSetting();

      if (!settings) {
        // Create default settings if none exist
        settings = await this.createDefaultSettings();
      }

      return settings;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to fetch general settings',
        error.message
      );
    }
  }

  /**
   * Get general settings history
   */
  static async getGeneralSettingHistory(
    page: number = 1,
    limit: number = 10
  ): Promise<{ settings: IGeneralSetting[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const [settings, total] = await Promise.all([
        GeneralSetting.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        GeneralSetting.countDocuments(),
      ]);

      return { settings, total };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to fetch settings history',
        error.message
      );
    }
  }

  /**
   * Activate specific general settings
   */
  static async activateGeneralSetting(id: string): Promise<IGeneralSetting> {
    try {
      const setting = await GeneralSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, 'General settings not found');
      }

      // deactivate all other settings
      await GeneralSetting.updateMany(
        { _id: { $ne: id }, isActive: true },
        { $set: { isActive: false } }
      );

      setting.isActive = true;
      await setting.save();

      return setting;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to activate general settings',
        error.message
      );
    }
  }

  /**
   * Deactivate general settings
   */
  static async deactivateGeneralSetting(id: string): Promise<IGeneralSetting> {
    try {
      const setting = await GeneralSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, 'General settings not found');
      }

      setting.isActive = false;
      await setting.save();

      return setting;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to deactivate general settings',
        error.message
      );
    }
  }

  /**
   * Create default general settings
   */
  private static async createDefaultSettings(): Promise<IGeneralSetting> {
    const defaultSettings = new GeneralSetting({
      applicationName: 'Yalla Ride',
      supportPhone: '+2348000000000',
      defaultCurrency: 'NGN',
      supportEmail: 'support@yallaride.com',
      timeZone: 'WAT',
      defaultLanguage: 'en',
      isActive: true,
    });

    await defaultSettings.save();
    return defaultSettings;
  }
}

export default GeneralSettingService;
