import axios from 'axios';
import { ENV } from '../config/env';

class TemiiService {
  static async sendSMS(to: string[], message: string): Promise<any> {
    const url = `${ENV.TEMII_BASE_URL}/api/sms/send`;
    const senderId = ENV.TEMII_SENDER_ID;
    const apiKey = ENV.TEMII_API_KEY;

    const data = {
      to,
      from: senderId,
      sms: message,
      type: 'plain',
      api_key: apiKey,
      channel: 'generic',
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error sending SMS via Termii:', error);
      throw new Error(error.message);
    }
  }
}

export default TemiiService;
