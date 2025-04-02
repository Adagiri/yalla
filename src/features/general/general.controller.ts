import { ContextType } from '../../types';
import { AuthPayload } from '../../utils/responses';
import Admin from '../admin/admin.model';
import Driver from '../driver/driver.model';
import GeneralService from './general.service';

const models: any = {
  admin: Admin,
  driver: Driver,
};

interface ImageUploadUrlInput {
  purpose: string;
  contentType: string;
}

class GeneralController {
  static async getBankCodes() {
    const response = await GeneralService.getBankCodes();
    return response;
  }

  static async getImageUploadUrl(
    _: any,
    { input }: { input: ImageUploadUrlInput }
  ) {
    const response = await GeneralService.getImageUploadUrl(
      input.contentType,
      input.purpose
    );
    return response;
  }

  static async resendCode(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.resendCode(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async verifyCode(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.verifyCode(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async requestResetPassword(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.requestResetPassword(input);
    return response;
  }

  static async resetPassword(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.resetPassword(input);
    return response;
  }

  static async login(_: any, { input }: { input: any }) {
    const accountType = input.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;

    const response = await GeneralService.login(input);
    return new AuthPayload(response.entity, response.token);
  }

  static async enableMfa(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    console.log(user);
    const accountType = user.accountType.toLowerCase();
    const model = models[accountType];
    input.model = model;
    input.id = user.id;

    const updatedEntity = await GeneralService.enableMfa(input);
    return updatedEntity;
  }

  static async disableMfa(_: any, __: any, { user }: ContextType) {
    const input: any = {};
    const accountType = user.accountType.toLowerCase();
    const model = models[accountType];

    input.id = user.id;
    input.model = model;

    const updatedEntity = await GeneralService.disableMfa(input);
    return updatedEntity;
  }
}

export default GeneralController;
