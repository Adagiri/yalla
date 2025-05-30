/**
 * Represents a geographical coordinate.
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Represents the bounds of a location defined by its northeast and southwest coordinates.
 */
export interface Bounds {
  northeast: Coordinates;
  southwest: Coordinates;
}

/**
 * Input used when creating a new location.
 */
export interface CreateLocationInput {
  name: string;
  description?: string;
  address?: string;
  location?: {
    type: string;
    coordinates: [number, number];
  };
  boundary?: {
    type: string;
    coordinates: number[][][];
  };
  locationType?: 'estate' | 'landmark' | 'general';
  isActive?: boolean;
}

/**
 * Input used when updating an existing location.
 */
export interface UpdateLocationInput {
  name?: string;
  description?: string;
  address?: string;
  location?: {
    type: string;
    coordinates: [number, number];
  };
  boundary?: {
    type: string;
    coordinates: number[][][];
  };
  locationType?: 'estate' | 'landmark' | 'general';
  isActive?: boolean;
}

/**
 * Filters for searching locations.
 */
export interface LocationFilter {
  ids?: string[];
  name?: string;
  address?: string;
  locationType?: 'estate' | 'landmark' | 'general';
  isActive?: boolean;
}

/**
 * Sorting options for listing locations.
 */
export interface LocationSort {
  field: 'name' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}
