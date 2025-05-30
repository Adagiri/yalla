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

export interface UpdateCustomerPersonalInfoInput {
  email: string;
  firstname: string; // Changed from firstname
  lastname: string; // Changed from lastname
  locationId: string;
}

export interface CustomerFilter {
  ids?: string[];
  firstname?: string; // Changed from firstname
  lastname?: string; // Changed from lastname
  email?: string;
  locationId?: string;
  isMFAEnabled?: boolean;
  authChannels?: AuthChannel[];
}

export interface CustomerSort {
  field: 'firstname' | 'lastname' | 'email' | 'createdAt' | 'updatedAt'; // Updated field names
  direction: 'ASC' | 'DESC';
}
