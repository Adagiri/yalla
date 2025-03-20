import { ENV } from "../config/env";

interface Coordinates {
  lat: number;
  lng: number;
}

interface Bounds {
  northeast: Coordinates;
  southwest: Coordinates;
}

export interface LocationData {
  lat: number;
  lng: number;
  bounds: Bounds | null;
  address?: string; 
}

const API_KEY = ENV.GOOGLE_API_KEY;

class GoogleServices {
  /**
   * Geocode an address to return location data.
   */
  static async geocodeLocation(address: string): Promise<LocationData | null> {
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${API_KEY}`;

    try {
      const response = await fetch(geocodingUrl);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const location: Coordinates = result.geometry.location;
        const bounds: Bounds | null = result.geometry.bounds || null;
        const formattedAddress: string | undefined = result.formatted_address;

        // console.log(`Geocoded address "${address}" successfully.`);
        return {
          lat: location.lat,
          lng: location.lng,
          bounds,
          address: formattedAddress,
        };
      } else {
        console.warn(`No geocoding results found for address: ${address}`);
        return null;
      }
    } catch (error: any) {
      console.error('Error geocoding location:', error);
      return null;
    }
  }

  /**
   * Retrieve detailed information for a place using its place ID.
   */
  static async getPlaceDetails(placeId: string): Promise<LocationData | null> {
    const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${API_KEY}`;
    try {
      const response = await fetch(placeDetailsUrl);
      const data = await response.json();

      if (data.result) {
        const location: Coordinates = data.result.geometry.location;
        const bounds: Bounds | null = data.result.geometry.bounds || null;
        const formattedAddress: string | undefined =
          data.result.formatted_address;

        // console.log(
        //   `Retrieved details for place ID "${placeId}" successfully.`
        // );
        return {
          lat: location.lat,
          lng: location.lng,
          bounds,
          address: formattedAddress,
        };
      } else {
        console.warn(`No details found for place ID: ${placeId}`);
        return null;
      }
    } catch (error: any) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Find location data by first searching for a place. If not found, fall back to geocoding.
   */
  static async findLocationData(
    locationName: string
  ): Promise<LocationData | null> {
    const placeSearchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
      locationName
    )}&inputtype=textquery&fields=place_id&key=${API_KEY}`;
    try {
      const response = await fetch(placeSearchUrl);
      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const placeId = data.candidates[0].place_id;
        console.log(
          `Found place candidate for "${locationName}" with place ID: ${placeId}`
        );
        return await GoogleServices.getPlaceDetails(placeId);
      } else {
        // console.log(
        //   `No place candidate found for "${locationName}", falling back to geocoding.`
        // );
        return await GoogleServices.geocodeLocation(locationName);
      }
    } catch (error: any) {
      console.error('Error finding location data:', error);
      return null;
    }
  }
}


export default GoogleServices;
