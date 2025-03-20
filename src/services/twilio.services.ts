import twilio from 'twilio';
import { ENV } from '../config/env';

const accountSid = ENV.TWILIO_ACCOUNT_SID;
const authToken = ENV.TWILIO_AUTH_TOKEN;
const notifyServiceSid = ENV.TWILIO_NOTIFY_SERVICE_SID;

const client = twilio(accountSid, authToken);

class TwilioService {
  /**
   * Send a notification using Twilio's Notify API.
   * @param notificationOpts Notification options containing toBinding and body.
   * @returns A promise that resolves with the notification SID.
   */
  static async sendNotification(body: string, phone: string): Promise<string> {
    try {
      const notificationOpts = {
        toBinding: [
          JSON.stringify({
            binding_type: 'sms',
            address: phone,
          }),
        ],
        body: `Yalla Ride\n${body}`,
      };
      const notification = await client.notify.v1
        .services(notifyServiceSid)
        .notifications.create(notificationOpts);
      //   console.log(`Notification sent with SID: ${notification.sid}`);
      return notification.sid;
    } catch (error: any) {
      console.error('Error sending notification via Twilio:', error);
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }
}

export default TwilioService;
