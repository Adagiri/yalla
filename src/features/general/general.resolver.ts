import { combineResolvers } from 'graphql-resolvers';
import GeneralController from './general.controller';
import { protectEntities } from '../../utils/auth-middleware';
import { AccountType, AccountType_ } from '../../constants/general';

const generalResolvers = {
  AuthEntity: {
    __resolveType(obj: any) {
      if (obj.accountType === AccountType_.ADMIN) {
        return 'Admin';
      }
      if (obj.accountType === AccountType_.DRIVER) {
        return 'Driver';
      }
      if (obj.accountType === AccountType_.CUSTOMER) {
        return 'Customer';
      }
      return null;
    },
  },

  AccountEntity: {
    __resolveType(obj: any) {
      if (obj.accountType === AccountType_.ADMIN) {
        return 'Admin';
      }
      if (obj.accountType === AccountType_.DRIVER) {
        return 'Driver';
      }
      if (obj.accountType === AccountType_.CUSTOMER) {
        return 'Customer';
      }
      return null;
    },
  },

  Query: {
    getBankCodes: GeneralController.getBankCodes,
    getImageUploadUrl: GeneralController.getImageUploadUrl,
    getFileUploadUrl: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER', 'CUSTOMER']),
      GeneralController.getFileUploadUrl
    ),
    getFileDownloadUrl: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER', 'CUSTOMER']),
      GeneralController.getFileDownloadUrl
    ),
    getVerificationStatus: GeneralController.getVerificationStatus,
    // General Settings
    getGeneralSettings: GeneralController.getGeneralSettings,
    getActiveGeneralSetting: GeneralController.getActiveGeneralSetting,
    getGeneralSettingHistory: GeneralController.getGeneralSettingHistory,

    // Pricing Settings
    getPricingSettings: GeneralController.getPricingSettings,
    getActivePricingSetting: GeneralController.getActivePricingSetting,
    getPricingSettingHistory: GeneralController.getPricingSettingHistory,

    // Payment Settings
    getPaymentSettings: GeneralController.getPaymentSettings,
    getActivePaymentSetting: GeneralController.getActivePaymentSetting,
    getPaymentSettingHistory: GeneralController.getPaymentSettingHistory,

    // Security Settings
    getSecuritySettings: GeneralController.getSecuritySettings,
    getActiveSecuritySetting: GeneralController.getActiveSecuritySetting,
    getSecuritySettingHistory: GeneralController.getSecuritySettingHistory,

    // System Health Queries
    getSystemHealth: GeneralController.getSystemHealth,
    getSystemHealthStats: GeneralController.getSystemHealthStats,

    // Data Management Queries
    getDataExports: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.getDataExports
    ),
    getDataImports: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.getDataImports
    ),
  },

  Mutation: {
    verifyDocument: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.verifyDocument
    ),
    toggleDriverLicenseVerification: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.toggleDriverLicenseVerification
    ),
    toggleVehicleInspection: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.toggleVehicleInspection
    ),
    resendCode: GeneralController.resendCode,
    verifyCode: GeneralController.verifyCode,
    requestResetPassword: GeneralController.requestResetPassword,
    resetPassword: GeneralController.resetPassword,
    login: GeneralController.login,
    enableMfa: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER', 'CUSTOMER']),
      GeneralController.enableMfa
    ),
    disableMfa: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER', 'CUSTOMER']),
      GeneralController.disableMfa
    ),
    googleLogin: GeneralController.googleLogin,
    // General Settings Mutations
    createGeneralSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.createGeneralSetting
    ),
    updateGeneralSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.updateGeneralSetting
    ),
    activateGeneralSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.activateGeneralSetting
    ),
    deactivateGeneralSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.deactivateGeneralSetting
    ),

    // Pricing Settings Mutations
    createPricingSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.createPricingSetting
    ),
    updatePricingSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.updatePricingSetting
    ),
    activatePricingSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.activatePricingSetting
    ),
    deactivatePricingSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.deactivatePricingSetting
    ),

    // Payment Settings Mutations
    createPaymentSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.createPaymentSetting
    ),
    updatePaymentSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.updatePaymentSetting
    ),
    activatePaymentSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.activatePaymentSetting
    ),
    deactivatePaymentSetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.deactivatePaymentSetting
    ),

    // Security Settings Mutations
    createSecuritySetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.createSecuritySetting
    ),
    updateSecuritySetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.updateSecuritySetting
    ),
    activateSecuritySetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.activateSecuritySetting
    ),
    deactivateSecuritySetting: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.deactivateSecuritySetting
    ),

    // System Health Mutations
    refreshSystemHealth: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.refreshSystemHealth
    ),
    updateSystemHealth: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.updateSystemHealth
    ),

    // Data Management Mutations
    requestDataExport: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.requestDataExport
    ),
    requestDataImport: combineResolvers(
      protectEntities(['ADMIN']),
      GeneralController.requestDataImport
    ),
  },
};

export default generalResolvers;
