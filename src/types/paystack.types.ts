import {
  ResourceType,
  PaymentPurpose,
  AccountType,
  UserCategory,
} from '../constants/general';
export interface PaystackTransactionData {
  id: number;
  domain: string;
  status: string;
  reference: string;
  amount: number;
  message: string | null;
  gateway_response: string;
  paid_at: string; // could also be parsed as Date if desired
  created_at: string;
  channel: string;
  currency: string;
  ip_address: string;
  metadata: TransactionMetadata; // sometimes this might be more specific, adjust as needed
  log: TransactionLog;
  fees: number | null;
  customer: TransactionCustomer;
  authorization: TransactionAuthorization;
  plan: Record<string, any>; // plan is an empty object here, so using a generic type
}

export interface TransactionLog {
  time_spent: number;
  attempts: number;
  authentication: string;
  errors: number;
  success: boolean;
  mobile: boolean;
  input: any[]; // adjust if the array items have a specific structure
  channel: string | null;
  history: TransactionHistoryItem[];
}

export interface TransactionHistoryItem {
  type: string;
  message: string;
  time: number;
}

export interface TransactionCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  customer_code: string;
  phone: string | null;
  metadata: any;
  risk_action: string;
}

export interface TransactionAuthorization {
  authorization_code: string;
  bin: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  card_type: string;
  bank: string;
  country_code: string;
  brand: string;
  account_name: string;
  channel: string;
  sender_bank: string;
  sender_bank_account_number: string;
  sender_name: string;
}

export interface TransactionMetadata {
  resourceType: ResourceType;
  resourceIds: string[];
  purpose: PaymentPurpose;
  payerId: string;
  payerType: AccountType;
  payerCategory?: UserCategory;
  baseAmounts: number[];
  saveCard?: boolean;
}
