import { AccountLevel, AuthChannel } from '../../constants/general';

export interface RegisterDriverInput {
  email: string;
  phone: { countryCode: string; localNumber: string; fullPhone: string };
  password: string;
  authChannel: AuthChannel;
}

export interface AddDriverInput {
  name: string;
  unitId: string;
  email?: string;
  phone?: { countryCode: string; localNumber: string; fullPhone: string };
  authChannel: AuthChannel;
  level: AccountLevel;
}

export interface DriverFilter {
  ids?: string[];
  firstname?: string;
  lastname?: string;
  email?: string;
  locationId?: string;
  isMFAEnabled?: boolean;
  authChannels?: AuthChannel[];
}

export interface DriverSort {
  field: 'firstname' | 'lastname' | 'email' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}

/**
 * Input for updating a driver's personal information.
 */
export interface UpdateDriverPersonalInfoInput {
  firstname: string;
  lastname: string;
  locationId: string;
}

/**
 * Input for updating a driver's license images.
 */
export interface UpdateDriverLicenseInput {
  driverLicenseFront: string;
  driverLicenseBack: string;
}

export interface UpdateProfilePhotoInput {
  src: string;
}
