import axios from 'axios';
import { ENV } from '../config/env';
import { generateRandomString } from '../utils/general';
import { PaymentPurpose, ResourceType } from '../constants/general';
import { PaystackTransactionData } from '../types/paystack.types';

class PaystackService {
  private static readonly secretKey = ENV.PAYSTACK_SECRET_KEY;
  private static readonly baseUrl = ENV.PAYSTACK_BASE_URL;

  private static getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  static async initializeTransaction(data: {
    email: string;
    amount: number;
    metadata?: any;
    channels?: string[];
    subaccount?: string;
    bearer?: string;
    transactionCharge?: number;
    reference?: string;
  }) {
    try {
      const {
        email,
        amount,
        metadata,
        channels,
        reference,
        subaccount,
        bearer,
        transactionCharge,
      } = data;

      const payload = {
        email,
        amount: amount * 100,
        metadata,
        channels,
        reference,
        subaccount,
        bearer,
        transaction_charge: transactionCharge,
      };

      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error Initiating Transaction:', error.response.data);
      throw new Error(error.response?.data.message || 'Transaction failed');
    }
  }

  static async createSubAccount(
    bankCode: string,
    businessName: string,
    accountNumber: string,
    percentageCharge: number
  ) {
    try {
      const data = {
        business_name: businessName,
        bank_code: bankCode,
        account_number: accountNumber,
        percentage_charge: percentageCharge,
      };

      const response = await axios.post(`${this.baseUrl}/subaccount`, data, {
        headers: this.getHeaders(),
      });
      return response.data.data;
    } catch (error: any) {
      console.error('Error Creating Subaccount:', error);
      throw new Error(
        error.response?.data.message || 'Subaccount creation failed'
      );
    }
  }

  static async createTransferRecipient(
    name: string,
    accountNumber: string,
    bankCode: string,
    metadata?: any
  ) {
    try {
      const data: any = {
        type: 'nuban',
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      };
      if (metadata) data.metadata = metadata;

      const response = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        data,
        { headers: this.getHeaders() }
      );
      return response.data.data.recipient_code;
    } catch (error: any) {
      console.error('Error Creating Transfer Recipient:', error);
      throw new Error(
        error.response?.data.message || 'Transfer recipient creation failed'
      );
    }
  }

  static async disburseSingle(
    amount: number,
    reason: string,
    recipient: string
  ) {
    try {
      const data = {
        source: 'balance',
        reason,
        amount: amount * 100,
        recipient,
        reference: generateRandomString(20),
      };

      const response = await axios.post(`${this.baseUrl}/transfer`, data, {
        headers: this.getHeaders(),
      });
      return response.data.data.reference;
    } catch (error: any) {
      console.error('Error During Disbursement:', error);
      const errMsg = error.response?.data.message;
      //   if (errMsg === 'Your balance is not enough to fulfil this request') {
      //     await sendErrorToDeveloper({
      //       subject: 'Disbursement Failed',
      //       error: errMsg,
      //     });
      //     throw new Error('Please retry in 30 minutes');
      //   }
      throw new Error(errMsg || 'Disbursement failed');
    }
  }

  static async getBanks() {
    try {
      const response = await axios.get(`${this.baseUrl}/bank`, {
        headers: this.getHeaders(),
      });
      return response.data.data;
    } catch (error: any) {
      console.error('Error Fetching Banks:', error);
      throw new Error(error.response?.data.message || 'Failed to fetch banks');
    }
  }

  static async getTransactionStatus(reference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: this.getHeaders(),
        }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error Fetching Transaction Status:', error);
      throw new Error(
        error.response?.data.message || 'Failed to fetch transaction status'
      );
    }
  }

  static async getTransferBalance() {
    try {
      const response = await axios.get(`${this.baseUrl}/balance`, {
        headers: this.getHeaders(),
      });
      return response.data.data[0].balance;
    } catch (error: any) {
      console.error('Error Fetching Balance:', error);
      throw new Error(
        error.response?.data.message || 'Failed to fetch balance'
      );
    }
  }

  static async getAccountDetail(accountNumber: string, bankCode: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error Fetching Account Details:', error);
      throw new Error(
        error.response?.data.message || 'Failed to fetch account details'
      );
    }
  }

  static getPaymentProviderCharge(amount: number): string {
    const flatFee = 100;
    const decimalFee = 1.5 / 100;
    const price = amount;
    const feeCap = 2000;
    const flatFeeWaiveAmount = 2500;
    const applicableFee = decimalFee * price + flatFee;

    if (price < flatFeeWaiveAmount) {
      const finalAmount = price / (1 - decimalFee) + 0.01;
      const charge = finalAmount - price;
      return charge.toFixed(2);
    }

    if (applicableFee > feeCap) {
      const finalAmount = price + feeCap;
      const charge = finalAmount - price;
      return charge.toFixed(2);
    } else {
      const finalAmount = (price + flatFee) / (1 - decimalFee) + 0.01;
      const charge = finalAmount - price;
      return charge.toFixed(2);
    }
  }

  /**
   * Handle webhook events from Paystack.
   */
  static async handleWebhookEvent(payload: any) {
    let { event, data }: { event: string; data: PaystackTransactionData } =
      payload;

    const metadata = data.metadata;
    console.log(event, data);
    try {
      if (!metadata || !metadata.purpose) {
        throw new Error('Missing metadata or purpose in webhook event.');
      }

      if (event === 'charge.success') {
        switch (metadata.purpose) {
          // case PaymentPurpose.ADD_CARD:
          //   if (metadata.resourceType === ResourceType.Asset) {
          //     return await AssetCardService.addAssetCard(data);
          //   }
          //   if (metadata.resourceType === ResourceType.User) {
          //     return await UserCardService.addUserCard(data);
          //   }
          //   break;

          // case PaymentPurpose.PAY_INVOICE:
          //   return await InvoiceService.payInvoice(data);

          // case PaymentPurpose.PAY_INVOICES:
          //   return await InvoiceService.payInvoices(data);

          default:
            console.log(`Unhandled payment purpose: ${metadata.purpose}`);
            break;
        }
      }
    } catch (error: any) {
      console.error('Error handling webhook event:', error);
      throw new Error(error.message);
    }
  }
}

export default PaystackService;
