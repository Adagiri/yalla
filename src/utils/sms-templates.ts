export const verificationTemplate = (code: string): string =>
  `Your Yalla verification code is: ${code}. This code is valid for 10 mins\nPowered By Yalla`;

export const loginAccessCodeTemplate = (code: string): string =>
  `Your MFA code is ${code}`;

export const AssetCodeTemplate = (code: string): string =>
  `"Your Asset Code is ${code}. Use this code to register your account on this phone number. Welcome aboard!"`;

export const mfaEnabledTemplate = (): string =>
  `Multi-Factor Authentication (MFA) has been successfully enabled on your account. If you didn't perform this action, please contact support immediately.`;

export const resetPasswordTemplate = (code: string): string =>
  `Your Reset Password code is ${code}`;

export const invoiceSMSTemplate = (
  invoiceTitle: string,
  invoiceAmount: number,
  paymentLink: string
): string =>
  `New invoice: ${invoiceTitle}\nAmount: $${invoiceAmount.toFixed(2)}\nPay here: ${paymentLink}`;
