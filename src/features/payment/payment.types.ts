import { TripDocument } from "../trip/trip.model";

export interface SuccessfulCardPaymentResult {
  success: boolean;
  trip: TripDocument | null;
  amounts: {
    total: number;
    driverEarnings: number;
    platformCommission: number;
  };
}

export interface ProcessTripPaymentInput {
  tripId: string;
  customerId: string;
  driverId: string;
  amount: number; // In Naira
  paymentMethod: 'cash' | 'card' | 'wallet';
  paymentToken?: string; // For card payments
}

export interface CardPaymentInput {
  tripId: string;
  customerId: string;
  amount: number;
  paymentToken?: string;
  saveCard?: boolean;
}

export interface CashoutInput {
  driverId: string;
  amount: number; // In Naira
  accountNumber: string;
  bankCode: string;
}

export interface TopUpWalletInput {
  amount: number;
  paymentMethod: 'card' | 'bank_transfer';
  saveCard?: boolean;
}

export interface TransactionFilter {
  type?: 'credit' | 'debit';
  purpose?: string;
  status?: string;
  paymentMethod?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface TransactionSort {
  field: string;
  direction: 'ASC' | 'DESC';
}


export interface PaymentFilter {
  ids?: string[];
  userId?: string;
  userType?: string[];
  type?: string[];
  purpose?: string[];
  status?: string[];
  paymentMethod?: string[];
  tripId?: string;
  minAmount?: number;
  maxAmount?: number;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  completedAtFrom?: Date;
  completedAtTo?: Date;
}

export interface PaymentSort {
  field: 'amount' | 'createdAt' | 'completedAt' | 'status' | 'type' | 'purpose';
  direction: 'ASC' | 'DESC';
}
