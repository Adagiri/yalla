export interface IncomingTripData {
  tripId: string;
  customerId: string;
  customerInfo: {
    name: string;
    phone: string;
    photo?: string;
  };
  pickup: {
    address: string;
    coordinates: [number, number];
  };
  destination: {
    address: string;
    coordinates: [number, number];
  };
  pricing: any;
  paymentMethod: string;
  requestedAt: Date;
  expiresAt: Date; // 1 minute from creation
}
