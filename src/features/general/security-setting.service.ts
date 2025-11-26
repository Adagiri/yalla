import { ErrorResponse } from "../../utils/responses";
import SecuritySetting, { ISecuritySetting } from "./security-setting.model";
import {
  CreateSecuritySettingInput,
  UpdateSecuritySettingInput,
} from "./general.types";

export class SecuritySettingService {
  static async createSecuritySetting(
    input: CreateSecuritySettingInput
  ): Promise<ISecuritySetting> {
    try {
      const setting = new SecuritySetting({
        ...input,
        isActive: false,
      });

      await setting.save();
      return setting;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ErrorResponse(
          400,
          "An active security setting already exists"
        );
      }
      throw new ErrorResponse(
        500,
        "Failed to create security settings",
        error.message
      );
    }
  }

  static async updateSecuritySetting(
    id: string,
    input: UpdateSecuritySettingInput
  ): Promise<ISecuritySetting> {
    try {
      const setting = await SecuritySetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, "Security settings not found");
      }

      // If activating this setting, deactivate others
      if (input.isActive === true && !setting.isActive) {
        await SecuritySetting.updateMany(
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
        "Failed to update security settings",
        error.message
      );
    }
  }

  static async activateSecuritySetting(id: string): Promise<ISecuritySetting> {
    try {
      const setting = await SecuritySetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, "Security settings not found");
      }

      await SecuritySetting.updateMany(
        { _id: { $ne: id }, isActive: true },
        { $set: { isActive: false } }
      );

      setting.isActive = true;
      await setting.save();

      return setting;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to activate security settings",
        error.message
      );
    }
  }

  static async deactivateSecuritySetting(
    id: string
  ): Promise<ISecuritySetting> {
    try {
      const setting = await SecuritySetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, "Security settings not found");
      }

      setting.isActive = false;
      await setting.save();

      return setting;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to deactivate security settings",
        error.message
      );
    }
  }

  static async getActiveSecuritySetting(): Promise<ISecuritySetting | null> {
    try {
      return await SecuritySetting.findOne({ isActive: true });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to fetch security settings",
        error.message
      );
    }
  }

  static async getSecuritySettings(): Promise<ISecuritySetting> {
    try {
      let settings = await this.getActiveSecuritySetting();

      if (!settings) {
        settings = await this.createDefaultSecuritySettings();
      }

      return settings;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to fetch security settings",
        error.message
      );
    }
  }

  static async getSecuritySettingHistory(
    page: number = 1,
    limit: number = 10
  ): Promise<{ settings: ISecuritySetting[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const [settings, total] = await Promise.all([
        SecuritySetting.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        SecuritySetting.countDocuments(),
      ]);

      return { settings, total };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to fetch security settings history",
        error.message
      );
    }
  }

  private static async createDefaultSecuritySettings(): Promise<ISecuritySetting> {
    const defaultSettings = new SecuritySetting({
      sessionTimeoutHours: 24,
      maxLoginAttempts: 5,
      minimumPasswordLength: 8,
      requireStrongPasswords: false,
      requireMfaForAdmins: true,
      enable2faForAllUsers: false,
      enableIpWhitelisting: false,
      allowedIps: [],
      enableAuditLogging: true,
      isActive: true,
    });

    await defaultSettings.save();
    return defaultSettings;
  }
}

export default SecuritySettingService;
