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
 * The base input for a location.
 */
export interface BaseLocationInput {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  /**
   * Optional bounds for the location.
   */
  bounds?: Bounds | null;
  /**
   * Optional human-readable address from geocoding results.
   */
  address?: string;
}

/**
 * Input used when creating a new location.
 */
export interface CreateLocationInput extends BaseLocationInput {}

/**
 * Input used when updating an existing location.
 * All fields are optional except the id.
 */
export interface UpdateLocationInput extends Partial<BaseLocationInput> {
  id: string;
}

/**
 * Filters for searching locations.
 * All fields are optional.
 */
export interface LocationFilter {
  ids?: string[];
  name?: string;
  address?: string;
}

/**
 * Sorting options for listing locations.
 */
export interface LocationSort {
  field: 'name' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}
