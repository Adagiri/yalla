/**
 * Represents a geographical coordinate.
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Represents the bounds of a vehicle defined by its northeast and southwest coordinates.
 */
export interface Bounds {
  northeast: Coordinates;
  southwest: Coordinates;
}

export interface VehicleFilter {
  ids?: string[];
  brand?: string;
  model?: string;
  manufactureYear?: string;
  color?: string;
  identificationNumber?: string;
  plateNumber?: string;
}

export interface VehicleSort {
  field: 'brand' | 'model' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}

/**
 * The base input for a vehicle.
 */
export interface BaseVehicleInput {}

/**
 * Input used when creating a new vehicle.
 */
export interface CreateVehicleInput extends BaseVehicleInput {
  brand: string;
  model: string;
  manufactureYear: string;
  color: string;
  identificationNumber: string;
  plateNumber: string;
}

/**
 * Input used when updating an existing vehicle.
 * All fields are optional except the id.
 */
export interface UpdateVehicleInput extends Partial<BaseVehicleInput> {
  brand: string;
  model: string;
  manufactureYear: string;
  color: string;
  identificationNumber: string;
  plateNumber: string;
}
