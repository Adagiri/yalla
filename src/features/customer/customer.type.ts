import { AccountLevel, AuthChannel } from '../../constants/general';

export interface RegisterCustomerInput {
  phone: { countryCode: string; localNumber: string; fullPhone: string };
  password: string;
  authChannel: AuthChannel;
}

export interface AddCustomerInput {
  name: string;
  unitId: string;
  email?: string;
  phone?: { countryCode: string; localNumber: string; fullPhone: string };
  authChannel: AuthChannel;
  level: AccountLevel;
}

export interface CustomerFilter {
  ids?: string[];
  firstName?: string;
  lastName?: string;
  email?: string;
  locationId?: string;
  isMFAEnabled?: boolean;
  authChannels?: AuthChannel[];
}

export interface CustomerSort {
  field: 'firstName' | 'lastName' | 'email' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}

/**
 * Input for updating a customer's personal information.
 */
export interface UpdateCustomerPersonalInfoInput {
  email: string;
  firstName: string;
  lastName: string;
  locationId: string;
}

/**
 * Input for updating a customer's license images.
 */
export interface UpdateCustomerLicenseInput {
  customerLicenseFront: string;
  customerLicenseBack: string;
}

export interface UpdateProfilePhotoInput {
  src: string;
}
