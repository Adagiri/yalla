import { PaymentMethod } from '../constants/general';
import { ErrorResponse } from '../utils/responses';
import PaystackService from './paystack.services';

interface BankAccountDetails {
  account_name: string;
  account_number: string;
  bank_code: string;
  bank_name?: string;
}

class TransactionMetadataService {
  /**
   * Generate enhanced metadata for cashout transactions
   */
  static async generateCashoutMetadata(input: {
    recipientAccountNumber: string;
    recipientBankCode: string;
    amount: number;
    transferReference?: string;
  }): Promise<any> {
    try {
      // Resolve recipient account name
      const accountDetails = await PaystackService.getAccountDetail(
        input.recipientAccountNumber,
        input.recipientBankCode
      );

      // Get bank list to find bank name
      const banks = await PaystackService.getBanks();
      const bank = banks.find((b: any) => b.code === input.recipientBankCode);

      const recipientDetails: BankAccountDetails = {
        account_name: accountDetails.account_name,
        account_number: input.recipientAccountNumber,
        bank_code: input.recipientBankCode,
        bank_name: bank?.name || 'Unknown Bank',
      };

      const senderDetails: BankAccountDetails = {
        account_name: 'Yalla Ride',
        account_number: process.env.COMPANY_ACCOUNT_NUMBER || '0240906678',
        bank_code: process.env.COMPANY_BANK_CODE || '011',
        bank_name: process.env.COMPANY_BANK_NAME || 'First Bank',
      };

      return {
        recipientDetails,
        senderDetails,
        transferReference: input.transferReference,
        sessionId: this.generateSessionId(),
        transactionType: 'bank_transfer',
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error generating cashout metadata',
        error.message
      );
    }
  }

  /**
   * Generate enhanced metadata for wallet top-up
   */
  static generateTopUpMetadata(input: {
    paymentMethod: string;
    paystackReference?: string;
    amount: number;
  }): any {
    return {
      paymentMethod: input.paymentMethod,
      paystackReference: input.paystackReference,
      sessionId: this.generateSessionId(),
      transactionType:
        input.paymentMethod === PaymentMethod.Card ? 'card_payment' : 'bank_transfer',
    };
  }

  /**
   * Generate enhanced metadata for trip earnings
   */
  static generateEarningsMetadata(input: {
    tripId: string;
    totalAmount: number;
    driverEarnings: number;
    platformCommission: number;
    paymentMethod: string;
  }): any {
    return {
      tripId: input.tripId,
      totalAmount: input.totalAmount,
      driverEarnings: input.driverEarnings,
      platformCommission: input.platformCommission,
      paymentMethod: input.paymentMethod,
      sessionId: this.generateSessionId(),
    };
  }

  /**
   * Generate session ID for tracking
   */
  private static generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 13).toUpperCase();
    return `${timestamp}${random}`;
  }
}

export default TransactionMetadataService;
