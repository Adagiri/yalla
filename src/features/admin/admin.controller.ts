import AdminService from './admin.service';

class AdminController {
  static async listEmailTemplates() {
    return await AdminService.listEmailTemplates();
  }

  static async createEmailTemplate(_: any, { input }: { input: any }) {
    return await AdminService.createEmailTemplate(input);
  }

  static async updateEmailTemplate(_: any, { input }: { input: any }) {
    return await AdminService.updateEmailTemplate(input);
  }

  static async deleteEmailTemplate(_: any, { name }: { name: string }) {
    return await AdminService.deleteEmailTemplate(name);
  }
}

export default AdminController;
