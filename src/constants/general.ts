export const AuthChannelSMS = 'SMS';
export const AuthChannelEMAIL = 'EMAIL';
export const AuthChannelGOOGLE = 'GOOGLE';

export const AccountTypeDRIVER = 'DRIVER';
export const AccountTypeADMIN = 'ADMIN';
export const AccountTypeCUSTOMER = 'CUSTOMER';
export const AccountTypeMERCHANT = 'MERCHANT';

export const AccountLevelMAIN = 'MAIN';
export const AccountLevelSUB = 'SUB';
export const AccountLevelNONE = 'NONE';

export const UserCategoryTENANT = 'TENANT';
export const UserCategoryOWNER = 'OWNER';

export const ResendCodeScenarioMFA = 'MFA';
export const ResendCodeScenarioACCOUNT_ACTIVATION = 'ACCOUNT_ACTIVATION';
export const ResendCodeScenarioRESET_PASSWORD = 'RESET_PASSWORD';

export const EmailTemplateUserWelcome = 'UserWelcomeEmailTemplate';
export const EmailTemplateManagerWelcome = 'ManagerWelcomeEmailTemplate';
export const EmailTemplateResetPasswordRequest = 'ResetPasswordRequestTemplate';
export const EmailTemplateLoginAccessCode = 'LoginAccessCodeTemplate';
export const EmailTemplateFacilityCode = 'FacilityCodeEmailTemplate';
export const EmailTemplateAccountActivation = 'AccountActivationEmailTemplate';
export const EmailTemplateMfaConfirmation = 'MfaConfirmationEmaiTemplate';
export const EmailTemplateNewInvoice = 'NewInvoiceEmailTemplate';

export const AuthChannel = {
  SMS: AuthChannelSMS,
  EMAIL: AuthChannelEMAIL,
  GOOGLE: AuthChannelGOOGLE,
} as const;

export type AuthChannel = (typeof AuthChannel)[keyof typeof AuthChannel];

export const AccountType = {
  ADMIN: AccountTypeADMIN,
  DRIVER: AccountTypeDRIVER,
  CUSTOMER: AccountTypeCUSTOMER,
  MERCHANT: AccountTypeMERCHANT,
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const UserCategory = {
  TENANT: UserCategoryTENANT,
  OWNER: UserCategoryOWNER,
} as const;

export type UserCategory = (typeof UserCategory)[keyof typeof UserCategory];

export const AccountLevel = {
  MAIN: AccountLevelMAIN,
  SUB: AccountLevelSUB,
  NONE: AccountLevelNONE,
} as const;

export type AccountLevel = (typeof AccountLevel)[keyof typeof AccountLevel];
export const AccountLevelEnum = [
  AccountLevel.SUB,
  AccountLevel.MAIN,
  AccountLevel.NONE,
];

export const ResendCodeScenario = {
  MFA: ResendCodeScenarioMFA,
  ACCOUNT_ACTIVATION: ResendCodeScenarioACCOUNT_ACTIVATION,
  RESET_PASSWORD: ResendCodeScenarioRESET_PASSWORD,
} as const;

export type ResendCodeScenario =
  (typeof ResendCodeScenario)[keyof typeof ResendCodeScenario];

export const EmailTemplate = {
  MERCHANT_WELCOME: EmailTemplateUserWelcome,
  CUSTOMER_WELCOME: EmailTemplateManagerWelcome,
  RESET_PASSWORD_REQUEST: EmailTemplateResetPasswordRequest,
  LOGIN_ACCESS_CODE: EmailTemplateLoginAccessCode,
  FACILITY_CODE: EmailTemplateFacilityCode,
  ACCOUNT_ACTIVATION: EmailTemplateAccountActivation,
  MFA_CONFIRMATION: EmailTemplateMfaConfirmation,
  NEW_INVOICE: EmailTemplateNewInvoice,
} as const;

export type EmailTemplate = (typeof EmailTemplate)[keyof typeof EmailTemplate];

export const RecurringFrequencyDAILY = 'DAILY';
export const RecurringFrequencyWEEKLY = 'WEEKLY';
export const RecurringFrequencyMONTHLY = 'MONTHLY';
export const RecurringFrequencyYEARLY = 'YEARLY';

export const RecurringFrequency = {
  DAILY: RecurringFrequencyDAILY,
  WEEKLY: RecurringFrequencyWEEKLY,
  MONTHLY: RecurringFrequencyMONTHLY,
  YEARLY: RecurringFrequencyYEARLY,
} as const;

export type RecurringFrequency =
  (typeof RecurringFrequency)[keyof typeof RecurringFrequency];
export const RecurringFrequencyEnum = [
  RecurringFrequency.DAILY,
  RecurringFrequency.WEEKLY,
  RecurringFrequency.MONTHLY,
  RecurringFrequency.YEARLY,
];

const PaymentPurposeAddCard = 'ADD_CARD';
const PaymentPurposePayInvoice = 'PAY_INVOICE';
const PaymentPurposePayInvoiceS = 'PAY_INVOICES';
export const PaymentPurpose = {
  ADD_CARD: PaymentPurposeAddCard,
  PAY_INVOICE: PaymentPurposePayInvoice,
  PAY_INVOICES: PaymentPurposePayInvoiceS,
} as const;
export type PaymentPurpose =
  (typeof PaymentPurpose)[keyof typeof PaymentPurpose];

const ResourceTypeAsset = 'ASSET';
const ResourceTypeUser = 'MERCHANT';
const ResourceTypeInvoice = 'INVOICE';
export const ResourceType = {
  Asset: ResourceTypeAsset,
  User: ResourceTypeUser,
  Invoice: ResourceTypeInvoice,
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

const PaymentMethodCard = 'card';
const PaymentMethodTransfer = 'bank_transfer';
const PaymentMethod = {
  Card: PaymentMethodCard,
  Transfer: PaymentMethodTransfer,
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

const PaymentTransactionStatusFailed = 'FAILED';
const PaymentTransactionStatusSuccess = 'SUCCESS';
const PaymentTransactionStatusReversed = 'REVERSED';
export const PaymentTransactionStatus = {
  Success: PaymentTransactionStatusSuccess,
  Failed: PaymentTransactionStatusFailed,
  Reversed: PaymentTransactionStatusReversed,
} as const;
export type PaymentTransactionStatus =
  (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus];

const FrequencyNone = 'NONE';
const FrequencyDaily = 'DAILY';
const FrequencyWeekly = 'WEEKLY';
const FrequencyMonthly = 'MONTHLY';
const FrequencyYearly = 'YEARLY';

export const PaymentRecurringFrequency = {
  None: FrequencyNone,
  Daily: FrequencyDaily,
  Weekly: FrequencyWeekly,
  Monthly: FrequencyMonthly,
  Yearly: FrequencyYearly,
} as const;

export type PaymentRecurringFrequency =
  (typeof PaymentRecurringFrequency)[keyof typeof PaymentRecurringFrequency];

const PaymentStatusPaid = 'PAID';
const PaymentStatusOutstanding = 'OUTSTANDING';
const PaymentStatusPartiallyPaid = 'PARTIALLY_PAID';

export const PaymentStatus = {
  Paid: PaymentStatusPaid,
  Outstanding: PaymentStatusOutstanding,
  PartiallyPaid: PaymentStatusPartiallyPaid,
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

const ReceivableReasonUnspecified = 'UNSPECIFIED';
const ReceivableReasonPayBills = 'PAY_BILL';

export const ReceivableReason = {
  Unspecified: ReceivableReasonUnspecified,
  PayBills: ReceivableReasonPayBills,
} as const;

export type ReceivableReason =
  (typeof ReceivableReason)[keyof typeof ReceivableReason];

const UploadUrlPurposeProduct = 'PRODUCT';
const UploadUrlPurposeProfilePhoto = 'PROFILE_PHOTO';
const UploadUrlPurposeDriverLiscence = 'DRIVER_LISCENCE';

export const UploadUrlPurpose = {
  Product: UploadUrlPurposeProduct,
  ProfilePhoto: UploadUrlPurposeProfilePhoto,
  DriverLiscence: UploadUrlPurposeDriverLiscence,
} as const;

export type UploadUrlPurpose =
  (typeof UploadUrlPurpose)[keyof typeof UploadUrlPurpose];

export const PaymentStatusEnum: string[] = Object.values(PaymentStatus);
export const AccountTypeEnum: string[] = Object.values(AccountType);
export const AuthChannelEnum: string[] = Object.values(AuthChannel);
export const UserCategoryEnum: string[] = Object.values(UserCategory);
export const ResendCodeScenarioEnum: string[] =
  Object.values(ResendCodeScenario);
export const EmailTemplateEnum: string[] = Object.values(EmailTemplate);
export const PaymentPurposeEnum: string[] = Object.values(PaymentPurpose);
export const ResourceTypeEnum: string[] = Object.values(ResourceType);
export const PaymentMethodEnum: string[] = Object.values(PaymentMethod);
export const PaymentTransactionStatusEnum: string[] = Object.values(
  PaymentTransactionStatus
);
export const PaymentRecurringFrequencyEnum: string[] = Object.values(
  PaymentRecurringFrequency
);
export const ReceivableReasonEnum: string[] = Object.values(ReceivableReason);
export const UploadUrlPurposeEnum: string[] = Object.values(UploadUrlPurpose);
