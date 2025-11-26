import { ErrorResponse } from "../../utils/responses";
import PricingSetting, { IPricingSetting } from "./pricing-setting.model";
import {
  CreatePricingSettingInput,
  UpdatePricingSettingInput,
} from "./general.types";

export class PricingSettingService {
  static async createPricingSetting(
    input: CreatePricingSettingInput
  ): Promise<IPricingSetting> {
    try {
      if (input.maximumFare < input.minimumFare) {
        throw new ErrorResponse(
          400,
          "Maximum fare must be greater than minimum fare"
        );
      }

      const setting = new PricingSetting({
        ...input,
        currency: "NGN",
        // new setting are inactive by default
        isActive: false,
      });

      await setting.save();
      return setting;
    } catch (error: any) {
      console.log(error, "create-error");
      if (error.code === 11000) {
        throw new ErrorResponse(
          400,
          "An active pricing setting already exists"
        );
      }
      throw new ErrorResponse(
        500,
        "Failed to create pricing settings",
        error.message
      );
    }
  }

  static async updatePricingSetting(
    id: string,
    input: UpdatePricingSettingInput
  ): Promise<IPricingSetting> {
    try {
      const setting = await PricingSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, "Pricing settings not found");
      }

      if (
        input.maximumFare &&
        input.minimumFare &&
        input.maximumFare < input.minimumFare
      ) {
        throw new ErrorResponse(
          400,
          "Maximum fare must be greater than minimum fare"
        );
      }

      // when  activating this setting, deactivate others
      if (input.isActive === true && !setting.isActive) {
        await PricingSetting.updateMany(
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
        "Failed to update pricing settings",
        error.message
      );
    }
  }

  static async activatePricingSetting(id: string): Promise<IPricingSetting> {
    try {
      const setting = await PricingSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, "Pricing settings not found");
      }

      // deactivate all other pricing settings
      await PricingSetting.updateMany(
        { _id: { $ne: id }, isActive: true },
        { $set: { isActive: false } }
      );

      setting.isActive = true;
      setting.effectiveFrom = new Date();
      await setting.save();

      return setting;
    } catch (error: any) {
      console.log(error, "this is  the new error");
      throw new ErrorResponse(
        500,
        "Failed to activate pricing settings",
        error.message
      );
    }
  }

  static async deactivatePricingSetting(id: string): Promise<IPricingSetting> {
    try {
      const setting = await PricingSetting.findById(id);
      if (!setting) {
        throw new ErrorResponse(404, "Pricing settings not found");
      }

      setting.isActive = false;
      await setting.save();

      return setting;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to deactivate pricing settings",
        error.message
      );
    }
  }

  static async getActivePricingSetting(): Promise<IPricingSetting | null> {
    try {
      return await PricingSetting.findOne({ isActive: true });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to fetch pricing settings",
        error.message
      );
    }
  }

  static async getPricingSettings(): Promise<IPricingSetting> {
    try {
      let settings = await this.getActivePricingSetting();

      if (!settings) {
        settings = await this.createDefaultPricingSettings();
      }

      return settings;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to fetch pricing settings",
        error.message
      );
    }
  }

  static async getPricingSettingHistory(
    page: number = 1,
    limit: number = 10
  ): Promise<{ settings: IPricingSetting[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const [settings, total] = await Promise.all([
        PricingSetting.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        PricingSetting.countDocuments(),
      ]);

      return { settings, total };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        "Failed to fetch pricing settings history",
        error.message
      );
    }
  }

  private static async createDefaultPricingSettings(): Promise<IPricingSetting> {
    const defaultSettings = new PricingSetting({
      baseFare: 500,
      perKmRate: 150,
      perMinuteRate: 50,
      minimumFare: 800,
      maximumFare: 50000,
      surgeMultiplier: 1.5,
      commissionRate: 20,
      cancellationFee: 300,
      currency: "NGN",
      isActive: true,
    });

    await defaultSettings.save();
    return defaultSettings;
  }
}

export default PricingSettingService;
