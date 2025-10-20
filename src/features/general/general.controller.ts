import { ContextType } from "../../types";
import { AuthPayload, ErrorResponse } from "../../utils/responses";
import Admin from "../admin/admin.model";
import Driver from "../driver/driver.model";
import Customer from "../customer/customer.model";
import GeneralService from "./general.service";
import { AccountType } from "../../constants/general";
import GeneralSettingService from "./general-setting.service";

import PricingSettingService from "./pricing-setting.service";
import PaymentSettingService from "./payment-setting.service";
import SecuritySettingService from "./security-setting.service";
import {
  CreateGeneralSettingInput,
  UpdateGeneralSettingInput,
  CreatePricingSettingInput,
  UpdatePricingSettingInput,
  CreatePaymentSettingInput,
  UpdatePaymentSettingInput,
  CreateSecuritySettingInput,
  UpdateSecuritySettingInput,
  UpdateSystemHealthInput,
  ExportRequestInput,
  ImportRequestInput,
} from "./general.types";
import SystemHealthService from "./system-health.service";
import DataManagementService from "./data-management.service";

const models: any = {
  admin: Admin,
  driver: Driver,
  customer: Customer,
};

interface ImageUploadUrlInput {
  purpose: string;
  contentType: string;
}

class GeneralController {
  static async getBankCodes() {
    const response = await GeneralService.getBankCodes();
    return response;
  }

  static async getImageUploadUrl(
    _: any,
    { input }: { input: ImageUploadUrlInput }
  ) {
    const response = await GeneralService.getImageUploadUrl(
      input.contentType,
      input.purpose
    );
    return response;
  }

  static async resendCode(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.resendCode(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async verifyCode(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.verifyCode(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async requestResetPassword(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.requestResetPassword(input);
    return response;
  }

  static async resetPassword(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.resetPassword(input);
    return response;
  }

  static async login(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.login(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async enableMfa(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    console.log(user);
    const accountType = user.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;
    input.id = user.id;

    const updatedEntity = await GeneralService.enableMfa(input);
    return updatedEntity;
  }

  static async disableMfa(_: any, __: any, { user }: ContextType) {
    const input: any = {};
    const accountType = user.accountType.toLowerCase();
    const model = models[accountType];

    input.id = user.id;
    input.model = model;

    const updatedEntity = await GeneralService.disableMfa(input);
    return updatedEntity;
  }

  static async googleLogin(
    _: any,
    {
      firebaseToken,
      accountType,
    }: { firebaseToken: string; accountType: AccountType }
  ) {
    const response = await GeneralService.googleLogin(
      firebaseToken,
      accountType
    );
    return new AuthPayload(response.entity, response.token);
  }

  static async getFileUploadUrl(
    _: any,
    { input }: { input: any },
    context: ContextType
  ) {
    const userId = context.user?.id;

    const response = await GeneralService.getFileUploadUrl({
      ...input,
      userId,
    });

    return response;
  }

  static async getFileDownloadUrl(
    _: any,
    { key }: { key: string },
    context: ContextType
  ) {
    if (!context.user) {
      throw new ErrorResponse(401, "Authentication required");
    }

    const url = await GeneralService.getFileDownloadUrl(key);
    return url;
  }

  // === PRICING SETTINGS ===
  static async createGeneralSetting(
    _: any,
    { input }: { input: CreateGeneralSettingInput }
  ) {
    const response = await GeneralSettingService.createGeneralSetting(input);
    return response;
  }

  static async updateGeneralSetting(
    _: any,
    { id, input }: { id: string; input: UpdateGeneralSettingInput }
  ) {
    const response = await GeneralSettingService.updateGeneralSetting(
      id,
      input
    );
    return response;
  }

  static async getGeneralSettings() {
    const response = await GeneralSettingService.getGeneralSettings();
    return response;
  }

  static async getActiveGeneralSetting() {
    const response = await GeneralSettingService.getActiveGeneralSetting();
    return response;
  }

  static async getGeneralSettingHistory(
    _: any,
    { pagination }: { pagination?: { page: number; limit: number } }
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;

    const response = await GeneralSettingService.getGeneralSettingHistory(
      page,
      limit
    );
    return response.settings;
  }

  static async activateGeneralSetting(_: any, { id }: { id: string }) {
    const response = await GeneralSettingService.activateGeneralSetting(id);
    return response;
  }

  static async deactivateGeneralSetting(_: any, { id }: { id: string }) {
    const response = await GeneralSettingService.deactivateGeneralSetting(id);
    return response;
  }

  // === PRICING SETTINGS ===
  static async createPricingSetting(
    _: any,
    { input }: { input: CreatePricingSettingInput }
  ) {
    const response = await PricingSettingService.createPricingSetting(input);
    return response;
  }

  static async updatePricingSetting(
    _: any,
    { id, input }: { id: string; input: UpdatePricingSettingInput }
  ) {
    const response = await PricingSettingService.updatePricingSetting(
      id,
      input
    );
    return response;
  }

  static async getPricingSettings() {
    const response = await PricingSettingService.getPricingSettings();
    return response;
  }

  static async getActivePricingSetting() {
    const response = await PricingSettingService.getActivePricingSetting();
    return response;
  }

  static async getPricingSettingHistory(
    _: any,
    { pagination }: { pagination?: { page: number; limit: number } }
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;

    const response = await PricingSettingService.getPricingSettingHistory(
      page,
      limit
    );
    return response.settings;
  }

  static async activatePricingSetting(_: any, { id }: { id: string }) {
    const response = await PricingSettingService.activatePricingSetting(id);
    return response;
  }

  static async deactivatePricingSetting(_: any, { id }: { id: string }) {
    const response = await PricingSettingService.deactivatePricingSetting(id);
    return response;
  }

  // === PAYMENT SETTINGS ===
  static async createPaymentSetting(
    _: any,
    { input }: { input: CreatePaymentSettingInput }
  ) {
    const response = await PaymentSettingService.createPaymentSetting(input);
    return response;
  }

  static async updatePaymentSetting(
    _: any,
    { id, input }: { id: string; input: UpdatePaymentSettingInput }
  ) {
    const response = await PaymentSettingService.updatePaymentSetting(
      id,
      input
    );
    return response;
  }

  static async getPaymentSettings() {
    const response = await PaymentSettingService.getPaymentSettings();
    return response;
  }

  static async getActivePaymentSetting() {
    const response = await PaymentSettingService.getActivePaymentSetting();
    return response;
  }

  static async getPaymentSettingHistory(
    _: any,
    { pagination }: { pagination?: { page: number; limit: number } }
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;

    const response = await PaymentSettingService.getPaymentSettingHistory(
      page,
      limit
    );
    return response.settings;
  }

  static async activatePaymentSetting(_: any, { id }: { id: string }) {
    const response = await PaymentSettingService.activatePaymentSetting(id);
    return response;
  }

  static async deactivatePaymentSetting(_: any, { id }: { id: string }) {
    const response = await PaymentSettingService.deactivatePaymentSetting(id);
    return response;
  }

  // === SECURITY SETTINGS ===
  static async createSecuritySetting(
    _: any,
    { input }: { input: CreateSecuritySettingInput }
  ) {
    const response = await SecuritySettingService.createSecuritySetting(input);
    return response;
  }

  static async updateSecuritySetting(
    _: any,
    { id, input }: { id: string; input: UpdateSecuritySettingInput }
  ) {
    const response = await SecuritySettingService.updateSecuritySetting(
      id,
      input
    );
    return response;
  }

  static async getSecuritySettings() {
    const response = await SecuritySettingService.getSecuritySettings();
    return response;
  }

  static async getActiveSecuritySetting() {
    const response = await SecuritySettingService.getActiveSecuritySetting();
    return response;
  }

  static async getSecuritySettingHistory(
    _: any,
    { pagination }: { pagination?: { page: number; limit: number } }
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;

    const response = await SecuritySettingService.getSecuritySettingHistory(
      page,
      limit
    );
    return response.settings;
  }

  static async activateSecuritySetting(_: any, { id }: { id: string }) {
    const response = await SecuritySettingService.activateSecuritySetting(id);
    return response;
  }

  static async deactivateSecuritySetting(_: any, { id }: { id: string }) {
    const response = await SecuritySettingService.deactivateSecuritySetting(id);
    return response;
  }

  // === SYSTEM HEALTH METHODS ===
  static async getSystemHealth() {
    const response = await SystemHealthService.getSystemHealth();
    return response;
  }

  static async getSystemHealthStats() {
    const response = await SystemHealthService.getSystemHealthStats();
    return response;
  }

  static async refreshSystemHealth() {
    const response = await SystemHealthService.refreshSystemHealth();
    return response;
  }

  static async updateSystemHealth(
    _: any,
    { input }: { input: UpdateSystemHealthInput }
  ) {
    const response = await SystemHealthService.updateSystemHealth(input);
    return response;
  }

  // === DATA MANAGEMENT METHODS ===
  static async requestDataExport(
    _: any,
    { input }: { input: ExportRequestInput },
    { user }: ContextType
  ) {
    if (!user?.id) {
      throw new Error("Authentication required");
    }
    const response = await DataManagementService.requestDataExport(
      input,
      user.id
    );
    return response;
  }

  static async requestDataImport(
    _: any,
    { input }: { input: ImportRequestInput },
    { user }: ContextType
  ) {
    if (!user?.id) {
      throw new Error("Authentication required");
    }
    const response = await DataManagementService.requestDataImport(
      input,
      user.id
    );
    return response;
  }

  static async getDataExports(
    _: any,
    {
      pagination,
      filters,
    }: { pagination?: { page: number; limit: number }; filters?: any }
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;

    const response = await DataManagementService.getDataExports(
      page,
      limit,
      filters
    );
    return response.exports;
  }

  static async getDataImports(
    _: any,
    {
      pagination,
      filters,
    }: { pagination?: { page: number; limit: number }; filters?: any }
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;

    const response = await DataManagementService.getDataImports(
      page,
      limit,
      filters
    );
    return response.imports;
  }
}

export default GeneralController;
