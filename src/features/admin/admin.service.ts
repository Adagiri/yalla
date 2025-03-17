import NotificationService from '../../services/notification.services';
import { filterNullAndUndefined } from '../../utils/general';
import { ErrorResponse } from '../../utils/responses';

interface EmailTemplateInput {
  name: string;
  subject: string;
  html: string;
  text: string;
}

class AdminService {
  static async listEmailTemplates() {
    try {
      const list = await NotificationService.listEmailTemplates();
      return list;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error listing email templates',
        error.message
      );
    }
  }

  static async createEmailTemplate({
    name,
    subject,
    html,
    text,
  }: EmailTemplateInput) {
    try {
      await NotificationService.createEmailTemplate({
        name,
        subject,
        html,
        text,
      });

      return true;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating email template',
        error.message
      );
    }
  }

  static async updateEmailTemplate(data: EmailTemplateInput) {
    try {
      const filteredData = filterNullAndUndefined(data);

      // @ts-ignore
      await NotificationService.updateEmailTemplate(filteredData);

      return true;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating email template',
        error.message
      );
    }
  }

  static async deleteEmailTemplate(name: string) {
    try {
      await NotificationService.deleteEmailTemplate(name);
      return true;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error deleting email template',
        error.message
      );
    }
  }
}

export default AdminService;
