import { AccountLevel, AuthChannel } from '../../constants/general';

export interface RegisterMerchantInput {
  phone: { countryCode: string; localNumber: string; fullPhone: string };
  password: string;
  authChannel: AuthChannel;
}

export interface AddMerchantInput {
  name: string;
  unitId: string;
  email?: string;
  phone?: { countryCode: string; localNumber: string; fullPhone: string };
  authChannel: AuthChannel;
  level: AccountLevel;
}

export interface MerchantFilter {
  ids?: string[];
  firstname?: string;
  lastname?: string;
  email?: string;
  locationId?: string;
  isMFAEnabled?: boolean;
  authChannels?: AuthChannel[];
}

export interface MerchantSort {
  field: 'firstname' | 'lastname' | 'email' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}

/**
 * Input for updating a merchant's personal information.
 */
export interface UpdateMerchantPersonalInfoInput {
  email: string;
  firstname: string;
  lastname: string;
  locationId: string;
}

/**
 * Input for updating a merchant's license images.
 */
export interface UpdateMerchantLicenseInput {
  merchantLicenseFront: string;
  merchantLicenseBack: string;
}

export interface UpdateProfilePhotoInput {
  src: string;
}
