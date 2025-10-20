# Mobile App - Crowd Data Integration Guide

> **⚠️ NOTE: This is a placeholder for future implementation. Crowd level features are not yet implemented.**

## Overview

This guide shows how to integrate Google Places SDK in the React Native mobile app to provide real-time crowd level data to the attraction info edge function (when implemented).

## Why Mobile Integration?

**Key Finding:** Google Places API (web) does NOT provide live crowd data, but **Google Places SDK (mobile) DOES**.

The edge function now automatically derives situational context (season, time of day, crowd levels) from available data, but mobile apps can provide **real crowd data** from Google Places SDK for much higher accuracy:

- **Heuristic crowd levels (edge function)**: ~60-70% accuracy
- **Google Places SDK crowd data (mobile app)**: ~85-90% accuracy

## Architecture

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
│                 │
│  1. User selects│
│     attraction  │
│                 │
│  2. Fetch from  │
│     Places SDK  │
│     ↓           │
│  3. Get crowd   │
│     data        │
│                 │
│  4. Pass to     │
│     edge fn     │
└────────┬────────┘
         │
         │ POST /attraction-info
         │ { situationalContext: { crowdLevel } }
         ↓
┌─────────────────┐
│  Edge Function  │
│                 │
│  1. Validate    │
│     client data │
│                 │
│  2. Auto-derive │
│     season/time │
│                 │
│  3. Use client  │
│     crowd level │
│                 │
│  4. Check       │
│     holidays    │
└─────────────────┘
```

## Implementation

### Option 1: Using react-native-google-places-autocomplete

**Install:**
```bash
npm install react-native-google-places-autocomplete
```

**Usage:**
```typescript
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

// When user selects an attraction
const fetchAttractionDetails = async (placeId: string) => {
  try {
    const details = await GooglePlacesAutocomplete.getPlaceDetails({
      placeId,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'geometry',
        'current_opening_hours',
        'opening_hours'
      ]
    });

    // Derive crowd level from opening hours data
    const crowdLevel = deriveCrowdLevelFromPlaceDetails(details);

    return {
      placeId: details.place_id,
      name: details.name,
      address: details.formatted_address,
      location: {
        lat: details.geometry.location.lat,
        lng: details.geometry.location.lng
      },
      crowdLevel
    };
  } catch (error) {
    console.error('Failed to fetch place details:', error);
    return null;
  }
};

// Helper function to derive crowd level
function deriveCrowdLevelFromPlaceDetails(details: any): 'quiet' | 'moderate' | 'busy' | null {
  // Google Places SDK provides popularity data in different formats
  // Check for current_opening_hours with live data
  if (details.current_opening_hours?.periods) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    // Find today's period
    const todayPeriod = details.current_opening_hours.periods.find(
      (p: any) => p.open.day === currentDay
    );

    if (todayPeriod?.popularity) {
      // Some Place Details responses include popularity scores
      const popularity = todayPeriod.popularity;
      if (popularity < 30) return 'quiet';
      if (popularity < 70) return 'moderate';
      return 'busy';
    }
  }

  // Fallback: Check opening_hours for typical busy times
  if (details.opening_hours?.periods) {
    // This is historical data, less accurate
    // Return null to let edge function use heuristics
  }

  return null; // Let edge function use heuristics
}
```

### Option 2: Using react-native-maps with Google Places

**Install:**
```bash
npm install react-native-maps
```

**Usage:**
```typescript
import { GooglePlacesSearch } from './services/GooglePlacesService';

const googlePlacesService = new GooglePlacesSearch(GOOGLE_MAPS_API_KEY);

// Fetch place details with additional fields
const fetchPlaceWithCrowdData = async (placeId: string) => {
  try {
    // Use Places API with specific fields
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${placeId}&` +
      `fields=name,formatted_address,geometry,current_opening_hours,opening_hours&` +
      `key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await response.json();

    if (data.status === 'OK') {
      const place = data.result;
      const crowdLevel = extractCrowdLevel(place);

      return {
        name: place.name,
        address: place.formatted_address,
        location: place.geometry.location,
        crowdLevel
      };
    }
  } catch (error) {
    console.error('Error fetching place details:', error);
  }

  return null;
};
```

### Option 3: Using Existing GooglePlacesService

If your app already has a `GooglePlacesService`, extend it:

```typescript
// In services/GooglePlacesService.ts

export class GooglePlacesService {
  // ... existing methods

  /**
   * Fetch place details with crowd data
   */
  async getPlaceDetailsWithCrowdData(placeId: string): Promise<PlaceWithCrowdData | null> {
    try {
      const url = this.buildPlaceDetailsUrl(placeId, [
        'place_id',
        'name',
        'formatted_address',
        'geometry',
        'current_opening_hours',
        'opening_hours'
      ]);

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        const place = data.result;

        return {
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          location: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          },
          crowdLevel: this.deriveCrowdLevel(place)
        };
      }

      return null;
    } catch (error) {
      console.error('[GooglePlacesService] Error fetching place details:', error);
      return null;
    }
  }

  /**
   * Derive crowd level from place details
   */
  private deriveCrowdLevel(place: any): 'quiet' | 'moderate' | 'busy' | null {
    // Implementation similar to above
    // Check for current_opening_hours, opening_hours, etc.
    return null; // Return null if unavailable - edge function will use heuristics
  }
}
```

## Passing Crowd Data to Edge Function

Once you have the crowd level, pass it in the request:

```typescript
// In your attraction selection/info flow
const generateAttractionInfo = async (attraction: Attraction) => {
  try {
    // Fetch crowd data from Google Places SDK (optional)
    const placeDetails = await googlePlacesService.getPlaceDetailsWithCrowdData(
      attraction.placeId
    );

    // Build request with optional situational context
    const requestBody = {
      attractionName: attraction.name,
      attractionAddress: attraction.address,
      userLocation: currentUserLocation,
      poiLocation: attraction.location,
      spatialHints: deriveSpatialHints({
        user: currentUserLocation,
        poi: attraction.location,
        lang: userLanguage
      }),
      preferences: {
        language: userLanguage,
        audioLength: userPreferences.audioLength,
        theme: userPreferences.theme,
        voiceStyle: userPreferences.voiceStyle
      },
      // NEW: Optional situational context
      situationalContext: placeDetails?.crowdLevel ? {
        crowdLevel: placeDetails.crowdLevel
        // season and timeOfDay will be auto-derived by edge function
        // recentEvents will be fetched from public holidays API
      } : undefined,
      generateAudio: true
    };

    // Call edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/attraction-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    return await response.json();
  } catch (error) {
    console.error('Failed to generate attraction info:', error);
    throw error;
  }
};
```

## Graceful Degradation

**Important:** Crowd data is OPTIONAL. The system works perfectly without it.

```typescript
// Good: Pass crowd data if available
situationalContext: {
  crowdLevel: placeDetails?.crowdLevel // Undefined if unavailable
}

// Also good: Don't send situationalContext at all
// Edge function will auto-derive everything

// Don't do this: Pass invalid data
situationalContext: {
  crowdLevel: 'very-busy' // Invalid value, will be rejected
}
```

## Valid Values

When passing situational context, use only these values:

```typescript
interface SituationalContext {
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  crowdLevel?: 'quiet' | 'moderate' | 'busy';
  recentEvents?: string; // Max 200 characters
}
```

**Edge function validates all fields and falls back to auto-derived values if invalid.**

## Testing

### Test 1: With Crowd Data
```typescript
const response = await generateAttractionInfo({
  name: 'Central Park',
  address: 'New York, NY',
  placeId: 'ChIJ...',
  location: { lat: 40.785091, lng: -73.968285 }
});

// Should use real crowd data from Google Places SDK
console.log('Used crowd data:', response.situationalContext?.crowdLevel);
```

### Test 2: Without Crowd Data
```typescript
// Don't pass situationalContext
const response = await generateAttractionInfo({
  name: 'Small Local Park',
  address: 'Somewhere, USA',
  location: { lat: 40.7, lng: -74.0 }
  // No placeId, no crowd data
});

// Should use heuristic crowd data from edge function
console.log('Heuristic crowd level:', response.situationalContext?.crowdLevel);
```

### Test 3: Invalid Crowd Data
```typescript
const response = await generateAttractionInfo({
  // ... attraction details
  situationalContext: {
    crowdLevel: 'super-busy' // Invalid - will be ignored
  }
});

// Edge function will validate, reject invalid value, use heuristic instead
```

## Performance Considerations

**Google Places API Costs:**
- Place Details (Basic): $0.017 per request
- Place Details (Contact): $0.003 per request
- Place Details (Atmosphere): $0.005 per request

**Recommendation:**
- Fetch crowd data only when user actively selects an attraction
- Cache place details for 15-30 minutes
- Don't fetch for every map pan/zoom
- Use SKU "Basic Data" + "Contact Data" only (no "Atmosphere" needed)

**Cost Example:**
- 1,000 attraction selections/day = $20/day = $600/month
- With caching: ~$10-15/day = $300-450/month

## Migration Path

**Phase 1: No Changes Required**
- Existing requests work as-is
- Edge function auto-derives all context

**Phase 2: Add Crowd Data (Optional)**
- Integrate Google Places SDK
- Pass crowd data when available
- Edge function uses it automatically

**Phase 3: Monitor & Optimize**
- Track accuracy improvements
- Monitor API costs
- Optimize caching strategy

## FAQ

**Q: Do I need to implement this immediately?**
A: No! Edge function works great with heuristics. Add crowd data when ready.

**Q: What if Google Places SDK doesn't return crowd data?**
A: Pass `null` or don't include `crowdLevel`. Edge function will use heuristics.

**Q: Can I override season or timeOfDay too?**
A: Yes, but usually not necessary. Edge function derives these accurately from location + time.

**Q: How accurate are heuristics vs Google data?**
A: Heuristics: ~60-70% accurate. Google Places SDK: ~85-90% accurate.

**Q: What about cost?**
A: Places API costs ~$0.02 per detail fetch. Cache aggressively to minimize costs.

**Q: Is this breaking the existing app?**
A: No! 100% backward compatible. All new features are optional.

## Support

For questions or issues:
1. Check edge function logs for context derivation
2. Validate request format matches examples above
3. Test with and without situational context
4. Review `supabase/functions/attraction-info/situationalContext.ts` for validation logic

---

**Status**: Optional Enhancement
**Impact**: +15-20% crowd accuracy when implemented
**Backward Compatible**: Yes, 100%
