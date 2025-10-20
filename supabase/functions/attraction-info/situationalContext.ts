// Situational Context Auto-Derivation Utility
// Automatically derives season, time of day, crowd levels, and checks for public holidays

export interface SituationalContext {
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  crowdLevel?: 'quiet' | 'moderate' | 'busy';
  recentEvents?: string;
}

// Cache for public holidays to avoid repeated API calls
const holidayCache = new Map<string, { holidays: any[]; timestamp: number }>();
const CACHE_TTL = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Derive season from coordinates and date
 * Handles both hemispheres and equatorial regions
 */
export function deriveSeason(lat: number, date: Date): 'spring' | 'summer' | 'fall' | 'winter' | null {
  // Equatorial region - no distinct seasons
  if (lat > -23.5 && lat < 23.5) {
    return null; // Could return 'summer' as default
  }

  const month = date.getMonth(); // 0-11
  const day = date.getDate();

  // Northern Hemisphere
  if (lat >= 23.5) {
    // Spring: March 20 - June 20
    if ((month === 2 && day >= 20) || (month >= 3 && month < 5) || (month === 5 && day <= 20)) {
      return 'spring';
    }
    // Summer: June 21 - September 22
    if ((month === 5 && day >= 21) || (month >= 6 && month < 8) || (month === 8 && day <= 22)) {
      return 'summer';
    }
    // Fall: September 23 - December 20
    if ((month === 8 && day >= 23) || (month >= 9 && month < 11) || (month === 11 && day <= 20)) {
      return 'fall';
    }
    // Winter: December 21 - March 19
    return 'winter';
  }

  // Southern Hemisphere (opposite seasons)
  if (lat <= -23.5) {
    // Summer: December 21 - March 19
    if ((month === 11 && day >= 21) || (month >= 0 && month < 2) || (month === 2 && day <= 19)) {
      return 'summer';
    }
    // Fall: March 20 - June 20
    if ((month === 2 && day >= 20) || (month >= 3 && month < 5) || (month === 5 && day <= 20)) {
      return 'fall';
    }
    // Winter: June 21 - September 22
    if ((month === 5 && day >= 21) || (month >= 6 && month < 8) || (month === 8 && day <= 22)) {
      return 'winter';
    }
    // Spring: September 23 - December 20
    return 'spring';
  }

  return null;
}

/**
 * Derive time of day with timezone awareness
 * Uses longitude to approximate timezone
 */
export function deriveTimeOfDay(
  date: Date,
  lat: number,
  lng: number
): 'morning' | 'afternoon' | 'evening' | 'night' {
  // Approximate timezone offset from longitude
  // lng / 15 = UTC offset (roughly)
  const timezoneOffset = Math.round(lng / 15);

  // Get UTC hour and adjust for timezone
  const utcHour = date.getUTCHours();
  let localHour = utcHour + timezoneOffset;

  // Normalize to 0-23 range
  if (localHour < 0) localHour += 24;
  if (localHour >= 24) localHour -= 24;

  // Classify time of day
  if (localHour >= 5 && localHour < 12) {
    return 'morning';
  } else if (localHour >= 12 && localHour < 18) {
    return 'afternoon';
  } else if (localHour >= 18 && localHour < 22) {
    return 'evening';
  } else {
    return 'night';
  }
}

/**
 * Derive heuristic crowd level based on date/time patterns
 * This is a smart fallback when real crowd data unavailable
 */
export function deriveHeuristicCrowdLevel(
  date: Date,
  season?: string | null,
  lat: number = 0,
  lng: number = 0
): 'quiet' | 'moderate' | 'busy' {
  const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

  // Calculate local hour using timezone offset from longitude
  const timezoneOffset = Math.round(lng / 15);
  const utcHour = date.getUTCHours();
  let localHour = utcHour + timezoneOffset;

  // Normalize to 0-23 range
  if (localHour < 0) localHour += 24;
  if (localHour >= 24) localHour -= 24;

  // Weekend check
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Time of day factors (using local time)
  const isMorning = localHour >= 5 && localHour < 12;
  const isAfternoon = localHour >= 12 && localHour < 18;
  const isEvening = localHour >= 18 && localHour < 22;

  // Base crowd level
  let crowdScore = 0;

  // Weekend increases crowd
  if (isWeekend) {
    crowdScore += 2;
  } else {
    crowdScore += 1; // Weekday baseline
  }

  // Time of day factor
  if (isMorning) {
    crowdScore += 0; // Mornings quieter
  } else if (isAfternoon || isEvening) {
    crowdScore += 1; // Afternoons/evenings busier
  }

  // Summer season modifier (peak tourist season)
  if (season === 'summer') {
    crowdScore += 1;
  }

  // Convert score to level
  if (crowdScore <= 1) {
    return 'quiet';
  } else if (crowdScore <= 2) {
    return 'moderate';
  } else {
    return 'busy';
  }
}

/**
 * Simple country code lookup from coordinates
 * For production, could use reverse geocoding API
 * This is a simplified implementation for major tourist countries
 */
function getCountryCodeFromCoordinates(lat: number, lng: number): string {
  // United States
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) {
    return 'US';
  }

  // Canada
  if (lat >= 42 && lat <= 70 && lng >= -141 && lng <= -52) {
    return 'CA';
  }

  // Mexico
  if (lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86) {
    return 'MX';
  }

  // UK
  if (lat >= 49 && lat <= 61 && lng >= -8 && lng <= 2) {
    return 'GB';
  }

  // France
  if (lat >= 41 && lat <= 51 && lng >= -5 && lng <= 10) {
    return 'FR';
  }

  // Germany
  if (lat >= 47 && lat <= 55 && lng >= 5 && lng <= 16) {
    return 'DE';
  }

  // Italy
  if (lat >= 36 && lat <= 47 && lng >= 6 && lng <= 19) {
    return 'IT';
  }

  // Spain
  if (lat >= 36 && lat <= 44 && lng >= -10 && lng <= 5) {
    return 'ES';
  }

  // Japan
  if (lat >= 24 && lat <= 46 && lng >= 123 && lng <= 154) {
    return 'JP';
  }

  // China
  if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) {
    return 'CN';
  }

  // Australia
  if (lat >= -44 && lat <= -10 && lng >= 113 && lng <= 154) {
    return 'AU';
  }

  // Brazil
  if (lat >= -34 && lat <= 5 && lng >= -74 && lng <= -34) {
    return 'BR';
  }

  // India
  if (lat >= 8 && lat <= 36 && lng >= 68 && lng <= 97) {
    return 'IN';
  }

  // Default fallback
  return 'US';
}

/**
 * Check for public holidays using Nager.Date API
 * Free, no authentication required
 * Results are cached per country-year
 */
async function checkPublicHolidays(
  lat: number,
  lng: number,
  date: Date
): Promise<string | null> {
  try {
    const countryCode = getCountryCodeFromCoordinates(lat, lng);
    const year = date.getFullYear();
    const cacheKey = `${countryCode}:${year}`;

    // Check cache first
    const cached = holidayCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      // Find holiday matching today's date
      const todayStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const holiday = cached.holidays.find((h: any) => h.date === todayStr);
      return holiday ? holiday.localName || holiday.name : null;
    }

    // Fetch from API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const url = `https://date.nager.at/api/v3/publicholidays/${year}/${countryCode}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[SituationalContext] Holiday API returned ${response.status} for ${countryCode}`);
      return null;
    }

    const holidays = await response.json();

    // Cache the result
    holidayCache.set(cacheKey, {
      holidays,
      timestamp: Date.now()
    });

    // Limit cache size to 50 entries (most common countries)
    if (holidayCache.size > 50) {
      const firstKey = holidayCache.keys().next().value;
      if (firstKey) {
        holidayCache.delete(firstKey);
      }
    }

    // Find today's holiday
    const todayStr = date.toISOString().split('T')[0];
    const holiday = holidays.find((h: any) => h.date === todayStr);
    return holiday ? holiday.localName || holiday.name : null;

  } catch (error) {
    // Log but don't fail - holidays are optional
    if ((error as Error).name === 'AbortError') {
      console.warn('[SituationalContext] Holiday API timeout');
    } else {
      console.warn('[SituationalContext] Holiday check failed:', (error as Error).message);
    }
    return null;
  }
}

/**
 * Main function to derive complete situational context
 * Combines auto-derivation with optional client overrides
 */
export async function deriveSituationalContext(params: {
  userLocation: { lat: number; lng: number };
  date?: Date;
  clientProvidedContext?: Partial<SituationalContext>;
}): Promise<SituationalContext> {
  const { userLocation, date = new Date(), clientProvidedContext = {} } = params;
  const { lat, lng } = userLocation;

  // Auto-derive all context fields
  const autoSeason = deriveSeason(lat, date);
  const autoTimeOfDay = deriveTimeOfDay(date, lat, lng);
  // Note: Crowd level feature not yet implemented
  // const autoCrowdLevel = deriveHeuristicCrowdLevel(date, autoSeason, lat, lng);

  // Check for public holidays (async, optional)
  let holidayName: string | null = null;
  try {
    holidayName = await checkPublicHolidays(lat, lng, date);
  } catch (error) {
    // Silently fail - holidays are nice-to-have
    console.warn('[SituationalContext] Holiday check error:', (error as Error).message);
  }

  // Build context, preferring client-provided values over auto-derived
  const context: SituationalContext = {
    season: clientProvidedContext.season || (autoSeason ?? undefined),
    timeOfDay: clientProvidedContext.timeOfDay || autoTimeOfDay,
    // Note: Crowd level feature not yet implemented
    // crowdLevel: clientProvidedContext.crowdLevel || autoCrowdLevel,
    recentEvents: clientProvidedContext.recentEvents || (holidayName ?? undefined)
  };

  return context;
}

/**
 * Validate and sanitize client-provided situational context
 * Ensures only valid values are accepted
 */
export function validateSituationalContext(
  context: any
): Partial<SituationalContext> | null {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const validated: Partial<SituationalContext> = {};

  // Validate season
  const validSeasons = ['spring', 'summer', 'fall', 'winter'];
  if (context.season && validSeasons.includes(context.season)) {
    validated.season = context.season;
  }

  // Validate timeOfDay
  const validTimes = ['morning', 'afternoon', 'evening', 'night'];
  if (context.timeOfDay && validTimes.includes(context.timeOfDay)) {
    validated.timeOfDay = context.timeOfDay;
  }

  // Validate crowdLevel
  const validCrowdLevels = ['quiet', 'moderate', 'busy'];
  if (context.crowdLevel && validCrowdLevels.includes(context.crowdLevel)) {
    validated.crowdLevel = context.crowdLevel;
  }

  // Validate recentEvents (string, max 200 chars)
  if (context.recentEvents && typeof context.recentEvents === 'string') {
    validated.recentEvents = context.recentEvents.substring(0, 200).trim();
  }

  return validated;
}
