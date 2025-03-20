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
import TwilioService from './twilio.services';
import TemiiService from './temii.services';

// Twilio Client Setup
const twilioClient = twilio(ENV.TWILIO_ACCOUNT_SID, ENV.TWILIO_AUTH_TOKEN);

// AWS SES Client Setup
const sesClient = new SESClient({
  region: ENV.AWS_REGION,
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
      Source: `Propatize <${ENV.SES_FROM_EMAIL}>`,
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
      await TemiiService.sendSMS([to], message);
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
}

export default NotificationService;
