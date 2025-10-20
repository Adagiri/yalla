export interface CreateGeneralSettingInput {
  applicationName: string;
  supportPhone: string;
  defaultCurrency: "NGN" | "USD";
  supportEmail: string;
  timeZone: "WAT" | "UTC";
  defaultLanguage: "en" | "ha" | "ig" | "yo";
}

export interface UpdateGeneralSettingInput {
  applicationName?: string;
  supportPhone?: string;
  defaultCurrency?: "NGN" | "USD";
  supportEmail?: string;
  timeZone?: "WAT" | "UTC";
  defaultLanguage?: "en" | "ha" | "ig" | "yo";
  isActive?: boolean;
}

export interface GeneralSettingType {
  id: string;
  applicationName: string;
  supportPhone: string;
  defaultCurrency: "NGN" | "USD";
  supportEmail: string;
  timeZone: "WAT" | "UTC";
  defaultLanguage: "en" | "ha" | "ig" | "yo";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePricingSettingInput {
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
  maximumFare: number;
  surgeMultiplier: number;
  commissionRate: number;
  cancellationFee: number;
  effectiveFrom?: Date;
}

export interface UpdatePricingSettingInput {
  baseFare?: number;
  perKmRate?: number;
  perMinuteRate?: number;
  minimumFare?: number;
  maximumFare?: number;
  surgeMultiplier?: number;
  commissionRate?: number;
  cancellationFee?: number;
  effectiveFrom?: Date;
  isActive?: boolean;
}

export interface PricingSettingType {
  id: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
  maximumFare: number;
  surgeMultiplier: number;
  commissionRate: number;
  cancellationFee: number;
  currency: string;
  isActive: boolean;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
}
export interface CreatePaymentSettingInput {
  cashPaymentsEnabled?: boolean;
  walletPaymentsEnabled?: boolean;
  paystackEnabled?: boolean;
  flutterwaveEnabled?: boolean;
  minimumWalletBalance: number;
  processingFeeRate: number;
  autoTopupEnabled?: boolean;
  autoTopupThreshold?: number;
  autoTopupAmount?: number;
}

export interface UpdatePaymentSettingInput {
  cashPaymentsEnabled?: boolean;
  walletPaymentsEnabled?: boolean;
  paystackEnabled?: boolean;
  flutterwaveEnabled?: boolean;
  minimumWalletBalance?: number;
  processingFeeRate?: number;
  autoTopupEnabled?: boolean;
  autoTopupThreshold?: number;
  autoTopupAmount?: number;
  isActive?: boolean;
}

export interface PaymentSettingType {
  id: string;
  cashPaymentsEnabled: boolean;
  walletPaymentsEnabled: boolean;
  paystackEnabled: boolean;
  flutterwaveEnabled: boolean;
  minimumWalletBalance: number;
  processingFeeRate: number;
  autoTopupEnabled: boolean;
  autoTopupThreshold?: number;
  autoTopupAmount?: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSecuritySettingInput {
  sessionTimeoutHours?: number;
  maxLoginAttempts?: number;
  minimumPasswordLength?: number;
  requireStrongPasswords?: boolean;
  requireMfaForAdmins?: boolean;
  enable2faForAllUsers?: boolean;
  enableIpWhitelisting?: boolean;
  allowedIps?: string[];
  enableAuditLogging?: boolean;
}

export interface UpdateSecuritySettingInput {
  sessionTimeoutHours?: number;
  maxLoginAttempts?: number;
  minimumPasswordLength?: number;
  requireStrongPasswords?: boolean;
  requireMfaForAdmins?: boolean;
  enable2faForAllUsers?: boolean;
  enableIpWhitelisting?: boolean;
  allowedIps?: string[];
  enableAuditLogging?: boolean;
  isActive?: boolean;
}

export interface SecuritySettingType {
  id: string;
  sessionTimeoutHours: number;
  maxLoginAttempts: number;
  minimumPasswordLength: number;
  requireStrongPasswords: boolean;
  requireMfaForAdmins: boolean;
  enable2faForAllUsers: boolean;
  enableIpWhitelisting: boolean;
  allowedIps: string[];
  enableAuditLogging: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemHealthData {
  totalRecords: number;
  databaseUsagePercent: number;
  usedSpaceGB: number;
  storageUsagePercent: number;
  activeUsersOnline: number;
  peakUsersToday: number;
  userUtilizationPercent: number;
  serverUptimeHours: number;
  averageResponseTime: number;
  errorRate: number;
  lastUpdated: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateSystemHealthInput {
  totalRecords?: number;
  databaseUsagePercent?: number;
  usedSpaceGB?: number;
  storageUsagePercent?: number;
  activeUsersOnline?: number;
  peakUsersToday?: number;
  userUtilizationPercent?: number;
  serverUptimeHours?: number;
  averageResponseTime?: number;
  errorRate?: number;
}

// For GraphQL responses (plain objects)
export interface SystemHealthType extends SystemHealthData {
  id: string;
}

export interface ExportRequestInput {
  exportType: "TRIP_REPORTS" | "USERS_DATA" | "PAYMENT_RECORDS" | "ALL_DATA";
  filters?: any;
}

export interface ImportRequestInput {
  importType: "DRIVER_DATA" | "CUSTOMER_DATA" | "VEHICLE_DATA";
  fileName: string;
  fileSizeMB: number;
  recordCount: number;
}

export interface DataExportType {
  id: string;
  exportType: string;
  status: string;
  fileUrl?: string;
  fileSizeMB?: number;
  recordCount: number;
  filters?: any;
  requestedBy: string;
  requestedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataImportType {
  id: string;
  importType: string;
  status: string;
  fileName: string;
  fileSizeMB: number;
  recordCount: number;
  successfulImports: number;
  failedImports: number;
  importedBy: string;
  importedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
