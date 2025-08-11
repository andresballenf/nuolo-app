interface PlaceResult {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  vicinity?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  types: string[];
}

interface PlacesSearchResponse {
  results: PlaceResult[];
  status: string;
  next_page_token?: string;
}

export interface PointOfInterest {
  id: string;
  name: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  description?: string;
  rating?: number;
  types: string[];
  photos?: string[]; // Array of photo URLs
}

class GooglePlacesService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search for nearby tourist attractions
   */
  async searchNearbyAttractions(
    location: { lat: number; lng: number },
    radius: number = 1500
  ): Promise<PointOfInterest[]> {
    try {
      const url = `${this.baseUrl}/nearbysearch/json?` +
        `location=${location.lat},${location.lng}&` +
        `radius=${radius}&` +
        `type=tourist_attraction&` +
        `key=${this.apiKey}`;

      const response = await fetch(url);
      const data: PlacesSearchResponse = await response.json();

      if (data.status !== 'OK') {
        console.warn('Google Places API error:', data.status);
        return [];
      }

      return data.results.map(this.transformPlaceToPointOfInterest);
    } catch (error) {
      console.error('Error searching nearby attractions:', error);
      return [];
    }
  }

  /**
   * Search for places with custom query
   */
  async searchPlaces(
    query: string,
    location: { lat: number; lng: number },
    radius: number = 5000
  ): Promise<PointOfInterest[]> {
    try {
      const url = `${this.baseUrl}/textsearch/json?` +
        `query=${encodeURIComponent(query)}&` +
        `location=${location.lat},${location.lng}&` +
        `radius=${radius}&` +
        `key=${this.apiKey}`;

      const response = await fetch(url);
      const data: PlacesSearchResponse = await response.json();

      if (data.status !== 'OK') {
        console.warn('Google Places API error:', data.status);
        return [];
      }

      return data.results.map(this.transformPlaceToPointOfInterest);
    } catch (error) {
      console.error('Error searching places:', error);
      return [];
    }
  }

  /**
   * Get place details by place_id
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/details/json?` +
        `place_id=${placeId}&` +
        `fields=name,formatted_address,geometry,rating,user_ratings_total,photos,reviews&` +
        `key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        console.warn('Google Places API error:', data.status);
        return null;
      }

      return data.result;
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Calculate search radius based on zoom level
   */
  getRadiusFromZoom(zoom: number): number {
    // Similar to web app logic
    const baseRadius = 50000; // 50km at zoom 1
    const zoomFactor = Math.pow(2, zoom - 1);
    return Math.max(500, Math.min(50000, baseRadius / zoomFactor));
  }

  /**
   * Transform Google Places API result to our PointOfInterest format
   */
  private transformPlaceToPointOfInterest(place: PlaceResult): PointOfInterest {
    return {
      id: place.place_id,
      name: place.name,
      coordinate: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      },
      description: place.vicinity || place.formatted_address || '',
      rating: place.rating,
      types: place.types,
    };
  }

  /**
   * Filter attractions by type for better results
   */
  filterTouristAttractions(places: PointOfInterest[]): PointOfInterest[] {
    const touristTypes = [
      'tourist_attraction',
      'museum',
      'art_gallery',
      'zoo',
      'amusement_park',
      'aquarium',
      'church',
      'synagogue',
      'mosque',
      'hindu_temple',
      'park',
      'stadium',
      'university',
      'library',
      'city_hall',
      'courthouse',
      'establishment',
      'point_of_interest',
    ];

    return places.filter(place =>
      place.types.some(type => touristTypes.includes(type))
    );
  }
}

export default GooglePlacesService;