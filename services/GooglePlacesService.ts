import { supabase } from '../lib/supabase';

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
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
    html_attributions?: string[];
  }>;
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
  private apiKey: string; // Kept for backward compatibility with photo URLs
  private useProxy: boolean = true; // Toggle for proxy usage

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Make a proxied request to Google Maps API via Supabase Edge Function
   * SECURITY: API key never exposed to client
   */
  private async proxyRequest(endpoint: string, params: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('maps-proxy', {
        body: {
          endpoint,
          params,
        },
      });

      if (error) {
        console.error('[SECURITY] Maps proxy error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[SECURITY] Failed to proxy request:', error);
      throw error;
    }
  }

  /**
   * Search for nearby tourist attractions
   * SECURITY: Uses server-side proxy to protect API key
   */
  async searchNearbyAttractions(
    location: { lat: number; lng: number },
    radius: number = 1500
  ): Promise<PointOfInterest[]> {
    try {
      const params = `location=${location.lat},${location.lng}&radius=${radius}&type=tourist_attraction`;

      const data: PlacesSearchResponse = await this.proxyRequest(
        'place/nearbysearch/json',
        params
      );

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
   * SECURITY: Uses server-side proxy to protect API key
   */
  async searchPlaces(
    query: string,
    location: { lat: number; lng: number },
    radius: number = 5000
  ): Promise<PointOfInterest[]> {
    try {
      const params = `query=${encodeURIComponent(query)}&location=${location.lat},${location.lng}&radius=${radius}`;

      const data: PlacesSearchResponse = await this.proxyRequest(
        'place/textsearch/json',
        params
      );

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
   * SECURITY: Uses server-side proxy to protect API key
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const params = `place_id=${placeId}&fields=name,formatted_address,geometry,rating,user_ratings_total,photos,reviews`;

      const data = await this.proxyRequest('place/details/json', params);

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
  private transformPlaceToPointOfInterest = (place: PlaceResult): PointOfInterest => {
    // Construct photo URLs from photo references
    const photos = place.photos?.map(photo => {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${this.apiKey}`;
    }) || [];

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
      photos: photos.slice(0, 5), // Limit to 5 photos max
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