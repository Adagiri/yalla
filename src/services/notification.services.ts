import {
  CreateTemplateCommand,
  DeleteTemplateCommand,
  SESClient,
  SendTemplatedEmailCommand,
  SendEmailCommand,
  ListTemplatesCommand,
  GetTemplateCommand,
  UpdateTemplateCommand,
} from '@aws-sdk/client-ses';
import { ENV } from '../config/env';
import TermiiService from './termii.services';
import Notification from '../features/notification/notification.model';
import Driver from '../features/driver/driver.model';
import Customer from '../features/customer/customer.model';
import * as admin from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';

// AWS SES Client Setup
const sesClient = new SESClient({
  region: ENV.AWS_SES_REGION,
  credentials: {
    accessKeyId: ENV.AWS_ACCESS_KEY_ID,
    secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
  },
});

interface SendNotificationInput {
  userId: string;
  userType: 'driver' | 'customer' | 'admin';
  type: string;
  title: string;
  message: string;
  data?: any;
  sendPush?: boolean;
  sendSMS?: boolean;
  sendEmail?: boolean;
}

interface EmailOptions {
  to: string;
  template: string;
  data: Record<string, string>;
}

interface SmsOptions {
  to: string;
  message: string;
}

interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text: string;
}

class NotificationService {
  /**
   * Generic sendNotification method - MISSING FROM ORIGINAL
   * This is the method referenced in index.ts
   */
  static async sendNotification(input: SendNotificationInput) {
    try {
      // Store notification in database
      const notification = await Notification.create({
        userId: input.userId,
        userType: input.userType,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data || {},
      });

      // Get user details
      let user;
      if (input.userType === 'driver') {
        user = await Driver.findById(input.userId).select(
          'email phone deviceTokens firstname lastname'
        );
      } else {
        user = await Customer.findById(input.userId).select(
          'email phone deviceTokens firstname lastname'
        );
      }

      if (!user) {
        throw new Error(`User ${input.userId} not found`);
      }

      // Send push notification (default: true)
      if (
        input.sendPush !== false &&
        user.deviceTokens &&
        user.deviceTokens.length > 0
      ) {
        await this.sendPushNotification(
          user.deviceTokens,
          input.title,
          input.message,
          {
            type: input.type,
            ...input.data,
          }
        );
      }

      // Send SMS for critical notifications
      if (input.sendSMS && this.shouldSendSMS(input.type)) {
        await this.sendSMS({
          to: user.phone?.fullPhone || '',
          message: input.message,
        });
      }

      // Send email if specified
      if (input.sendEmail && user.email) {
        // For basic notifications, send simple email
        await this.sendBasicEmail({
          to: user.email,
          subject: input.title,
          message: input.message,
          userName: `${user.firstname} ${user.lastname}`,
        });
      }

      return {
        success: true,
        notification,
        channels: {
          database: true,
          push: input.sendPush !== false && user.deviceTokens?.length > 0,
          sms: input.sendSMS && !!user.phone?.fullPhone,
          email: input.sendEmail && !!user.email,
        },
      };
    } catch (error: any) {
      console.error('Error sending notification:', error);
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Send basic email (non-templated)
   */
  static async sendBasicEmail({
    to,
    subject,
    message,
    userName,
  }: {
    to: string;
    subject: string;
    message: string;
    userName: string;
  }) {
    try {
      // Create a simple HTML template
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${subject}</h2>
          <p>Hello ${userName},</p>
          <p>${message}</p>
          <br>
          <p>Best regards,<br>Your Ride App Team</p>
        </div>
      `;

      const params = {
        Source: `Ride App <${ENV.AWS_SES_FROM_EMAIL}>`,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: htmlContent },
            Text: {
              Data: `Hello ${userName},\n\n${message}\n\nBest regards,\nYour Ride App Team`,
            },
          },
        },
      };

      const command = new SendEmailCommand(params);
      await sesClient.send(command);
      console.log(`Basic email sent to ${to}`);
    } catch (error: any) {
      console.error('Error sending basic email:', error);
      // Don't throw to prevent notification failure
    }
  }

  /**
   * Determine if SMS should be sent for notification type
   */
  private static shouldSendSMS(type: string): boolean {
    const smsNotificationTypes = [
      'trip_accepted',
      'driver_arrived',
      'trip_completed',
      'trip_cancelled',
      'payment_successful',
      'cashout_successful',
      'subscription_expired',
      'subscription_renewal_failed',
    ];
    return smsNotificationTypes.includes(type);
  }

  /**
   * Send templated email
   */
  static async sendEmail({ to, template, data }: EmailOptions) {
    const params = {
      Source: `Ride App <${ENV.AWS_SES_FROM_EMAIL}>`,
      Destination: {
        ToAddresses: [to],
      },
      Template: template,
      TemplateData: JSON.stringify(data),
    };

    try {
      const command = new SendTemplatedEmailCommand(params);
      await sesClient.send(command);
      console.log(`Templated email sent to ${to}`);
    } catch (error: any) {
      console.error('Error sending templated email via AWS SES:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send SMS
   */
  static async sendSMS({ to, message }: SmsOptions) {
    try {
      await TermiiService.sendSMS([to], message);
      console.log(`SMS sent to ${to}`);
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Send push notification to multiple devices
   */
  static async sendPushNotification(
    deviceTokens: string[],
    title: string,
    body: string,
    data: any = {}
  ) {
    try {
      const message = {
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        tokens: deviceTokens,
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            channelId: 'default_notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body,
              },
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      const messaging = getMessaging();
      const response = await (admin.messaging() as any).sendMulticast(message);

      console.log(
        `Push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`
      );

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            failedTokens.push(deviceTokens[idx]);
            console.error(
              `Failed to send to token ${deviceTokens[idx]}:`,
              resp.error
            );
          }
        });

        // Remove invalid tokens from database
        if (failedTokens.length > 0) {
          await this.removeInvalidTokens(failedTokens);
        }
      }

      return response;
    } catch (error: any) {
      console.error('Error sending push notification:', error);
      // Don't throw error to prevent notification failure from blocking the flow
    }
  }

  /**
   * Remove invalid device tokens
   */
  private static async removeInvalidTokens(failedTokens: string[]) {
    try {
      // Remove from drivers
      await Driver.updateMany(
        { deviceTokens: { $in: failedTokens } },
        { $pullAll: { deviceTokens: failedTokens } }
      );

      // Remove from customers
      await Customer.updateMany(
        { deviceTokens: { $in: failedTokens } },
        { $pullAll: { deviceTokens: failedTokens } }
      );

      console.log(`Removed ${failedTokens.length} invalid device tokens`);
    } catch (error) {
      console.error('Error removing invalid tokens:', error);
    }
  }

  /**
   * Send trip notification to user (driver or customer)
   */
  static async sendTripNotification(
    userId: string,
    userType: 'driver' | 'customer',
    notificationType:
      | 'new_request'
      | 'trip_accepted'
      | 'driver_arrived'
      | 'trip_started'
      | 'trip_completed'
      | 'trip_cancelled'
      | 'payment_successful'
      | 'earnings_received',
    tripData: any
  ) {
    try {
      // Prepare notification content based on type
      const notificationContent = this.getNotificationContent(
        notificationType,
        tripData,
        userType
      );

      // Use the generic sendNotification method
      return await this.sendNotification({
        userId,
        userType,
        type: notificationType,
        title: notificationContent.title,
        message: notificationContent.message,
        data: {
          tripId: tripData.id,
          tripNumber: tripData.tripNumber,
          ...notificationContent.data,
        },
        sendSMS: this.shouldSendSMS(notificationType),
      });
    } catch (error: any) {
      console.error('Error sending trip notification:', error);
      throw new Error(`Failed to send trip notification: ${error.message}`);
    }
  }

  /**
   * Get notification content based on type
   */
  private static getNotificationContent(
    type: string,
    tripData: any,
    userType: string
  ) {
    const contents: Record<string, any> = {
      new_request: {
        title: '🚗 New Trip Request!',
        message: `New trip from ${tripData.pickup.address} to ${tripData.destination.address}`,
        data: {
          pickup: tripData.pickup.address,
          destination: tripData.destination.address,
          fare: tripData.pricing.finalAmount,
          distance: tripData.route.distance,
        },
      },
      trip_accepted: {
        title: '✅ Trip Accepted!',
        message:
          userType === 'customer'
            ? `Your driver ${tripData.driverName} is on the way`
            : `You accepted the trip to ${tripData.destination.address}`,
        data: {
          driverName: tripData.driverName,
          vehicleNumber: tripData.vehicleNumber,
        },
      },
      driver_arrived: {
        title: '📍 Driver Arrived!',
        message:
          userType === 'customer'
            ? 'Your driver has arrived at pickup location'
            : 'You have arrived at pickup location',
        data: {},
      },
      trip_started: {
        title: '🏁 Trip Started!',
        message: 'Your trip has begun. Safe travels!',
        data: {},
      },
      trip_completed: {
        title: '🎉 Trip Completed!',
        message:
          userType === 'customer'
            ? `Trip completed. Fare: ₦${tripData.pricing.finalAmount}`
            : `Trip completed. You earned ₦${tripData.driverEarnings}`,
        data: {
          fare: tripData.pricing.finalAmount,
          earnings: tripData.driverEarnings,
        },
      },
      trip_cancelled: {
        title: '❌ Trip Cancelled',
        message: `Trip has been cancelled. ${tripData.cancellationReason || ''}`,
        data: {
          reason: tripData.cancellationReason,
        },
      },
      payment_successful: {
        title: '💳 Payment Successful!',
        message: `Payment of ₦${tripData.pricing.finalAmount} processed successfully`,
        data: {
          amount: tripData.pricing.finalAmount,
        },
      },
      earnings_received: {
        title: '💰 Earnings Received!',
        message: `You've received ₦${tripData.driverEarnings} for your completed trip`,
        data: {
          earnings: tripData.driverEarnings,
        },
      },
      // Subscription-related notifications
      subscription_expired: {
        title: '⏰ Subscription Expired',
        message:
          'Your subscription has expired. Renew to continue accepting rides.',
        data: {},
      },
      subscription_renewal_failed: {
        title: '❌ Subscription Renewal Failed',
        message:
          'Unable to renew subscription. Please check your wallet balance.',
        data: {},
      },
      subscription_activated: {
        title: '✅ Subscription Activated',
        message:
          'Your subscription is now active. You can start accepting rides!',
        data: {},
      },
    };

    return (
      contents[type] || {
        title: 'Notification',
        message: 'You have a new notification',
        data: {},
      }
    );
  }

  /**
   * Broadcast notification to multiple drivers
   */
  static async broadcastToDrivers(
    driverIds: string[],
    content: {
      title: string;
      message: string;
      data: any;
    }
  ): Promise<void> {
    try {
      // Store notifications for all drivers
      const notifications = await Promise.all(
        driverIds.map((driverId) =>
          Notification.create({
            userId: driverId,
            userType: 'driver',
            type: 'new_request',
            title: content.title,
            message: content.message,
            data: content.data,
          })
        )
      );

      // Get all drivers' device tokens
      const drivers = await Driver.find({
        _id: { $in: driverIds },
        isOnline: true,
        isAvailable: true,
      }).select('deviceTokens');

      // Collect all device tokens
      const allDeviceTokens = drivers.reduce((tokens, driver) => {
        if (driver.deviceTokens && driver.deviceTokens.length > 0) {
          tokens.push(...driver.deviceTokens);
        }
        return tokens;
      }, [] as string[]);

      // Send push notifications to all drivers at once
      if (allDeviceTokens.length > 0) {
        await this.sendPushNotification(
          allDeviceTokens,
          content.title,
          content.message,
          content.data
        );
      }

      const g = globalThis as typeof globalThis & {
        websocketService?: {
          sendToUser: (id: string, event: string, data: any) => void;
        };
      };

      if (g.websocketService) {
        driverIds.forEach((driverId) => {
          if (g.websocketService) {
            g.websocketService.sendToUser(driverId, 'new_trip_request', {
              tripId: content.data.tripId,
              ...content.data,
            });
          }
        });
      }

      console.log(`📢 Broadcasted to ${driverIds.length} drivers`);
    } catch (error) {
      console.error('❌ Error broadcasting to drivers:', error);
    }
  }

  static async listEmailTemplates() {
    try {
      const command = new ListTemplatesCommand({});
      const response = await sesClient.send(command);
      return response.TemplatesMetadata;
    } catch (error: any) {
      console.error('Error listing email templates:', error);
      throw new Error(`Failed to list email templates: ${error.message}`);
    }
  }

  static async createEmailTemplate({
    name,
    subject,
    html,
    text,
  }: EmailTemplate) {
    html = html.replaceAll('((', '{{').replaceAll('))', '}}');
    text = text.replaceAll('((', '{{').replaceAll('))', '}}');
    const command = new CreateTemplateCommand({
      Template: {
        TemplateName: name,
        SubjectPart: subject,
        HtmlPart: html,
        TextPart: text,
      },
    });

    try {
      await sesClient.send(command);
      console.log(`Template "${name}" created successfully.`);
      return {
        success: true,
        message: `Template "${name}" created successfully.`,
      };
    } catch (error: any) {
      console.error(`Error creating template "${name}":`, error);
      throw new Error(`Error creating email template: ${error.message}`);
    }
  }

  static async updateEmailTemplate({
    name,
    subject,
    html,
    text,
  }: {
    name: string;
    subject?: string;
    html?: string;
    text?: string;
  }) {
    try {
      // Fetch the existing template
      const getCommand = new GetTemplateCommand({ TemplateName: name });
      const response = await sesClient.send(getCommand);
      console.log(response.Template);
      const existingTemplate = response.Template;
      if (!existingTemplate) {
        throw new Error(`Template "${name}" does not exist.`);
      }

      // Update only the provided fields
      const updatedTemplate = {
        TemplateName: name,
        SubjectPart: subject ?? existingTemplate.SubjectPart,
        HtmlPart: html
          ? html.replaceAll('((', '{{').replaceAll('))', '}}')
          : existingTemplate.HtmlPart,
        TextPart: text
          ? text.replaceAll('((', '{{').replaceAll('))', '}}')
          : existingTemplate.TextPart,
      };

      // Save the updated template
      const updateCommand = new UpdateTemplateCommand({
        Template: updatedTemplate,
      });
      await sesClient.send(updateCommand);

      console.log(`Template "${name}" updated successfully.`);
      return {
        success: true,
        message: `Template "${name}" updated successfully.`,
      };
    } catch (error: any) {
      console.error(`Error updating template "${name}":`, error);
      throw new Error(`Error updating email template: ${error.message}`);
    }
  }

  static async deleteEmailTemplate(name: string) {
    try {
      const command = new DeleteTemplateCommand({
        TemplateName: name,
      });
      await sesClient.send(command);
      console.log(`Template "${name}" deleted successfully.`);
      return {
        success: true,
        message: `Template "${name}" deleted successfully.`,
      };
    } catch (error: any) {
      console.error(`Error deleting template "${name}":`, error);
      throw new Error(`Failed to delete email template: ${error.message}`);
    }
  }
}

declare namespace NodeJS {
  interface Global {
    websocketService?: {
      sendToUser: (id: string, event: string, data: any) => void;
    };
  }
}

export default NotificationService;
