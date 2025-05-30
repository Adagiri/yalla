import { Model } from 'mongoose';
import { AuthChannel } from '../constants/general';

export interface EnableMfaInput {
  model: Model<Document>;
  id: string;
  authChannel: AuthChannel;
}

export interface VerifyMfaInput {
  id: string;
  code: string;
}

export interface DisableMfaInput {
  model: Model<Document>;
  id: string;
}

export interface AuthPayloadType {
  token?: string;
  entity?: any;
}

export interface RegisterManagerInput {
  name: string;
  email?: string;
  country: string;
  password: string;
  phone?: { countryCode: string; localNumber: string; fullPhone: string };
  authChannel: AuthChannel;
}

export interface RegisterUserInput {
  name: string;
  email?: string;
  password: string;
  phone?: { countryCode: string; localNumber: string; fullPhone: string };
  authChannel: AuthChannel;
}

export interface LoginManagerInput {
  email?: string;
  phone?: { countryCode: string; localNumber: string; fullPhone: string };
  password: string;
  authChannel: AuthChannel;
}

export interface RequestResetPasswordInput {
  model: Model<Document>;
  email?: string;
  phone?: { countryCode: string; localNumber: string; fullPhone: string };
  authChannel: AuthChannel;
}

export interface ResetPasswordInput {
  model: Model<Document>;
  code: string;
  token: string;
  password: string;
}

export interface ResendCodeInput {
  token: string;
  model: Model<Document>;
  scenario: string;
}

export interface LoginInput {
  model: Model<Document>;
  email?: string;
  phone?: { fullPhone: string };
  password: string;
  authChannel: AuthChannel;
}

export interface SaveManagerTypeInput {
  id: string;
  user: any;
}

export interface SaveAssetTypesInput {
  ids: string[];
  user: any;
}

export interface SaveFunctionalitiesInput {
  ids: string[];
  user: any;
}

export interface VerifyCodeInput {
  model: Model<Document>;
  token: string;
  code: string;
}

export interface ContextUser {
  firstname: string;
  lastname: string;
  _id?: string;
  id: string;
  email?: string;
}
