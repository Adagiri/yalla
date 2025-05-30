export interface PhoneType {
  countryCode: string; // E.g., "+1"
  localNumber: string; // E.g., "4155552671"
  fullPhone: string; // E.164 format: "+14155552671"
}


export interface LocationType {
    type: 'Point';
    coordinates: [number, number];
    heading?: number;
    updatedAt: Date;
  }