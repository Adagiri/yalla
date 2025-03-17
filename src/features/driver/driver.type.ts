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
  firstName?: string;
  lastName?: string;
  email?: string;
  locationId?: string;
  isMFAEnabled?: boolean;
  authChannels?: AuthChannel[];
}

export interface DriverSort {
  field: 'firstName' | 'lastName' | 'email' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}

/**
 * Input for updating a driver's personal information.
 */
export interface UpdatePersonalInfoInput {
  firstName: string;
  lastName: string;
  locationId: string;
}

/**
 * Input for updating a driver's license images.
 */
export interface UpdateDriverLicenseInput {
  driverLicenseFront: string;
  driverLicenseBack: string;
}
