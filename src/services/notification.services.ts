import {
  CreateTemplateCommand,
  DeleteTemplateCommand,
  SESClient,
  SendTemplatedEmailCommand,
  ListTemplatesCommand,
  GetTemplateCommand,
  UpdateTemplateCommand,
} from '@aws-sdk/client-ses';
import twilio from 'twilio';
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
  static async sendEmail({ to, template, data }: EmailOptions) {
    const params = {
      Source: `Propatize <${ENV.AWS_SES_FROM_EMAIL}>`,
      Destination: {
        ToAddresses: [to],
      },
      Template: template,
      TemplateData: JSON.stringify(data),
    };

    try {
      const command = new SendTemplatedEmailCommand(params);
      await sesClient.send(command);
      console.log(`Email sent to ${to}`);
    } catch (error: any) {
      console.error('Error sending email via AWS SES:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  static async sendSMS({ to, message }: SmsOptions) {
    try {
      await TermiiService.sendSMS([to], message);
      // await TwilioService.sendNotification(message, to);
      console.log(`SMS sent to ${to}`);
    } catch (error: any) {
      console.error('Error sending SMS via Twilio:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
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
      | 'trip_cancelled',
    tripData: any
  ) {
    try {
      // Prepare notification content based on type
      const notificationContent = this.getNotificationContent(
        notificationType,
        tripData,
        userType
      );

      // Store notification in database for history
      const notification = await Notification.create({
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
      });

      // Get user details for push notification
      let user;
      if (userType === 'driver') {
        user = await Driver.findById(userId).select('email phone deviceTokens');
      } else {
        user = await Customer.findById(userId).select(
          'email phone deviceTokens'
        );
      }

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Send push notification if user has device tokens
      if (user.deviceTokens && user.deviceTokens.length > 0) {
        await this.sendPushNotification(
          user.deviceTokens,
          notificationContent.title,
          notificationContent.message,
          {
            type: notificationType,
            tripId: tripData.id,
            ...notificationContent.data,
          }
        );
      }

      // Send SMS for critical notifications
      if (this.shouldSendSMS(notificationType)) {
        await this.sendSMS({
          to: user.phone.fullPhone,
          message:
            notificationContent.smsMessage || notificationContent.message,
        });
      }

      // Send email for completed trips
      if (notificationType === 'trip_completed' && user.email) {
        await this.sendEmail({
          to: user.email,
          template: 'TripCompletedEmailTemplate',
          data: {
            name: user.firstname || 'Customer',
            tripNumber: tripData.tripNumber,
            fare: tripData.pricing.finalAmount,
            pickup: tripData.pickup.address,
            destination: tripData.destination.address,
            date: new Date(tripData.completedAt).toLocaleDateString(),
          },
        });
      }

      // Emit real-time notification via WebSocket
      if (global.websocketService) {
        global.websocketService.sendToUser(userId, 'notification', {
          id: notification._id,
          ...notificationContent,
          timestamp: new Date(),
        });
      }

      return notification;
    } catch (error: any) {
      console.error('Error sending trip notification:', error);
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Broadcast trip request to multiple drivers
   */
  static async sendDriverBroadcast(
    driverIds: string[],
    tripId: string,
    tripData: any
  ) {
    try {
      // Create notification content
      const content = {
        title: '🚗 New Trip Request!',
        message: `Trip from ${tripData.pickup.address} • ₦${tripData.pricing.finalAmount}`,
        data: {
          tripId,
          pickup: tripData.pickup,
          destination: tripData.destination,
          estimatedFare: tripData.pricing.finalAmount,
          distance: tripData.route.distance,
          duration: tripData.route.duration,
          paymentMethod: tripData.paymentMethod,
          customerName: tripData.customerName,
          tripType: tripData.tripType,
          expiresAt: new Date(Date.now() + 30000), // 30 seconds to accept
        },
      };

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

      // Send real-time notifications via WebSocket
      if (global.websocketService) {
        driverIds.forEach((driverId) => {
          global.websocketService.sendToUser(driverId, 'new_trip_request', {
            ...content,
            notificationId: notifications.find((n) => n.userId === driverId)
              ?._id,
            timestamp: new Date(),
          });
        });

        // Set timeout to auto-expire the request
        setTimeout(() => {
          driverIds.forEach((driverId) => {
            global.websocketService.sendToUser(
              driverId,
              'trip_request_expired',
              {
                tripId,
                timestamp: new Date(),
              }
            );
          });
        }, 30000); // 30 seconds
      }

      return notifications;
    } catch (error: any) {
      console.error('Error broadcasting to drivers:', error);
      throw new Error(`Failed to broadcast trip request: ${error.message}`);
    }
  }

  /**
   * Send push notification using FCM
   */
  private static async sendPushNotification(
    deviceTokens: string[],
    title: string,
    body: string,
    data: any
  ) {
    try {
      // Initialize Firebase Admin SDK if not already done
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: ENV.FIREBASE_PROJECT_ID,
            clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
            privateKey: ENV.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      }

      const message = {
        notification: {
          title,
          body,
        },
        data: Object.keys(data).reduce(
          (acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          },
          {} as Record<string, string>
        ),
        tokens: deviceTokens,
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            channelId: 'trip_notifications',
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
        smsMessage: `New trip request: ${tripData.pickup.address} to ${tripData.destination.address}. Fare: ₦${tripData.pricing.finalAmount}`,
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
        smsMessage:
          userType === 'customer'
            ? `Your driver ${tripData.driverName} is coming. Vehicle: ${tripData.vehicleNumber}`
            : `Trip accepted. Pick up at ${tripData.pickup.address}`,
        data: {
          driverName: tripData.driverName,
          vehicleNumber: tripData.vehicleNumber,
          estimatedArrival: tripData.estimatedArrival,
        },
      },
      driver_arrived: {
        title: '🚕 Driver Has Arrived!',
        message: `Your driver has arrived at the pickup location`,
        smsMessage: `Your driver has arrived. PIN: ${tripData.verificationPin}`,
        data: {
          verificationPin: tripData.verificationPin,
        },
      },
      trip_started: {
        title: '🎯 Trip Started',
        message: 'Your trip has started. Have a safe journey!',
        data: {
          startTime: new Date(),
        },
      },
      trip_completed: {
        title: '🎉 Trip Completed!',
        message: `Trip completed. Total fare: ₦${tripData.pricing.finalAmount}`,
        smsMessage: `Trip completed. Fare: ₦${tripData.pricing.finalAmount}. Thank you for riding with Yalla!`,
        data: {
          fare: tripData.pricing.finalAmount,
          duration: tripData.actualDuration,
          distance: tripData.route.distance,
        },
      },
    };

    return (
      contents[type] || {
        title: 'Trip Update',
        message: 'Your trip status has been updated',
        data: {},
      }
    );
  }

  /**
   * Determine if SMS should be sent for notification type
   */
  private static shouldSendSMS(notificationType: string): boolean {
    const smsNotifications = ['driver_arrived', 'trip_completed'];
    return smsNotifications.includes(notificationType);
  }

  /**
   * Remove invalid device tokens
   */
  private static async removeInvalidTokens(tokens: string[]) {
    try {
      await Promise.all([
        Driver.updateMany(
          { deviceTokens: { $in: tokens } },
          { $pull: { deviceTokens: { $in: tokens } } }
        ),
        Customer.updateMany(
          { deviceTokens: { $in: tokens } },
          { $pull: { deviceTokens: { $in: tokens } } }
        ),
      ]);
    } catch (error) {
      console.error('Error removing invalid tokens:', error);
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationAsRead(notificationId: string, userId: string) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification not found');
      }

      return notification;
    } catch (error: any) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(
    userId: string,
    pagination: { page: number; limit: number },
    filter?: { isRead?: boolean; type?: string }
  ) {
    try {
      const query: any = { userId };

      if (filter?.isRead !== undefined) {
        query.isRead = filter.isRead;
      }

      if (filter?.type) {
        query.type = filter.type;
      }

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(pagination.limit)
        .skip((pagination.page - 1) * pagination.limit);

      const total = await Notification.countDocuments(query);

      return {
        notifications,
        total,
        page: pagination.page,
        totalPages: Math.ceil(total / pagination.limit),
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }
  }
}

export default NotificationService;
