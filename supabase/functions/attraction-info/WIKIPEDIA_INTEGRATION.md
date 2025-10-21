# Wikipedia Integration Documentation

## Overview

The Wikipedia integration enhances attraction narratives by providing structured content guides from Wikipedia articles. This optional feature helps AI models create more comprehensive and accurate tour guide content by referencing established topics and verified information.

**Key Features:**
- Feature flag controlled (can be enabled/disabled via environment variable)
- Graceful degradation (system works without Wikipedia if page not found)
- Rate limiting (respects Wikipedia API limits)
- Hybrid approach (section structure + short text extracts)
- Real-time fetching (no caching in Phase 1)

## Feature Flag

The Wikipedia integration is controlled by a single environment variable:

```bash
ENABLE_WIKIPEDIA_INTEGRATION=true  # Enable Wikipedia integration
ENABLE_WIKIPEDIA_INTEGRATION=false # Disable Wikipedia integration (default)
```

**Setting the Feature Flag in Supabase:**

1. Navigate to your Supabase project dashboard
2. Go to Settings → Edge Functions
3. Add a new secret:
   - Name: `ENABLE_WIKIPEDIA_INTEGRATION`
   - Value: `true` or `false`
4. Restart the edge function if needed

**Default Behavior:**
- If not set: Wikipedia integration is **DISABLED**
- If set to `false`: Wikipedia integration is **DISABLED**
- If set to `true`: Wikipedia integration is **ENABLED**

## Architecture

### Components

1. **wikipediaService.ts** - Standalone service for Wikipedia API integration
2. **types/aiProvider.ts** - TypeScript interfaces for Wikipedia data
3. **promptGenerator.ts** - Wikipedia content guide block generation
4. **index.ts** - Main edge function integration point

### Data Flow

```
User Request
    ↓
index.ts (check feature flag)
    ↓
wikipediaService.enrichWithWikipedia()
    ↓
[Search Wikipedia Page] → [Fetch Article Structure] → [Fetch Section Extracts]
    ↓
Wikipedia Data (WikipediaData interface)
    ↓
promptGenerator.generatePrompt() (includes Wikipedia guide block)
    ↓
AI Provider (OpenAI/Gemini)
    ↓
Enhanced Narrative Response
```

## Wikipedia Service API

### isWikipediaEnabled()

Checks if Wikipedia integration is enabled via feature flag.

```typescript
function isWikipediaEnabled(): boolean
```

**Returns:** `true` if enabled, `false` otherwise

### enrichWithWikipedia()

Main orchestration function that fetches Wikipedia data for an attraction.

```typescript
async function enrichWithWikipedia(
  attractionName: string,
  attractionAddress: string
): Promise<WikipediaData>
```

**Parameters:**
- `attractionName` - Name of the attraction (e.g., "Statue of Liberty")
- `attractionAddress` - Full address for disambiguation (e.g., "Liberty Island, New York, NY 10004")

**Returns:** WikipediaData object with:
- `found` (boolean) - Whether a Wikipedia page was found
- `pageTitle` (string) - Wikipedia page title (if found)
- `pageUrl` (string) - Full Wikipedia URL (if found)
- `sections` (WikipediaSection[]) - Article section hierarchy
- `extracts` (Record<string, string>) - Text extracts by section title

**Example Response:**
```json
{
  "found": true,
  "pageTitle": "Statue of Liberty",
  "pageUrl": "https://en.wikipedia.org/wiki/Statue_of_Liberty",
  "sections": [
    { "title": "History", "level": 1, "index": 1 },
    { "title": "Design and construction", "level": 2, "index": 2 },
    { "title": "Dedication", "level": 2, "index": 3 }
  ],
  "extracts": {
    "History": "The Statue of Liberty was a gift from France to the United States...",
    "Design and construction": "Designed by French sculptor Frédéric Auguste Bartholdi..."
  }
}
```

## Wikipedia Data Structure

### WikipediaSection Interface

```typescript
interface WikipediaSection {
  title: string;    // Section title (e.g., "History")
  level: number;    // 1 = top-level, 2 = subsection, etc.
  index: number;    // Section index in Wikipedia article
}
```

### WikipediaData Interface

```typescript
interface WikipediaData {
  found: boolean;                         // Whether Wikipedia page was found
  pageTitle?: string;                     // Wikipedia page title
  pageUrl?: string;                       // Full Wikipedia URL
  sections: WikipediaSection[];           // Section hierarchy
  extracts: Record<string, string>;       // Section title → extract text
}
```

## Integration in Prompt Generator

The Wikipedia content guide is added as a modular block in the prompt generation process:

```typescript
function buildWikipediaGuideBlock(wikipediaData: any): string {
  if (!wikipediaData || !wikipediaData.found) {
    return ''; // Empty block if no Wikipedia data
  }

  // Returns structured guide with:
  // - Section hierarchy (indented by level)
  // - Reference material (1-2 sentence extracts)
  // - Usage guidance for AI model
}
```

**Prompt Integration:**
```typescript
const blocks: string[] = [
  buildSystemPersona(lang),
  buildContextBlock(...),
  buildWikipediaGuideBlock(wikipediaData),  // Wikipedia block here
  buildAudienceBlock(preferences),
  buildNarrativeOrchestration(audioLength),
  buildAccuracyBlock(),
  buildCriticalInstructions(lang)
].filter(block => block.length > 0);
```

## Rate Limiting

Wikipedia API has rate limits that must be respected:

- **Unauthenticated**: 500 requests per hour
- **With API token**: 5,000 requests per hour (not implemented yet)

**Implementation:**
- In-memory counter tracks requests per hour
- Warning logged at 400 requests/hour (80%)
- Requests blocked at 480 requests/hour (96%)
- Counter resets every hour

**Rate Limit Handling:**
```typescript
if (requestsThisHour >= 480) {
  return {
    found: false,
    sections: [],
    extracts: {}
  };
}
```

## Error Handling

The Wikipedia integration is designed to fail gracefully:

1. **Feature Flag Disabled**: No Wikipedia API calls made, proceeds with normal flow
2. **Page Not Found**: Returns `{ found: false }`, system continues without Wikipedia
3. **API Timeout** (2 seconds): Logs warning, proceeds without Wikipedia
4. **Network Error**: Catches error, logs warning, proceeds without Wikipedia
5. **Rate Limit Exceeded**: Logs warning, returns empty data, proceeds without Wikipedia

**Example Error Handling in index.ts:**
```typescript
try {
  wikipediaData = await enrichWithWikipedia(
    sanitizedAttractionName,
    sanitizedAttractionAddress
  );
} catch (error) {
  logWarn('wikipedia', 'Failed to fetch Wikipedia data, proceeding without', {
    error: (error as Error).message
  });
  // Continue without Wikipedia - it's optional
}
```

## Content Filtering

To avoid overwhelming the AI with too much information:

1. **Section Filtering**:
   - Excludes "See also", "References", "External links", "Further reading", "Notes"
   - Limits to top 15 sections
   - Preserves section hierarchy (levels 1-4)

2. **Extract Filtering**:
   - Fetches extracts for top 10 sections only
   - Extracts only 1-2 sentences per section
   - Strips HTML tags and Wikipedia markup
   - Total token budget: ~1,500-3,000 tokens

## Testing

A comprehensive test script is provided:

```bash
# Set environment variables
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_supabase_anon_key"
export ENABLE_WIKIPEDIA_INTEGRATION="true"

# Run test script
node scripts/test-wikipedia-integration.js
```

**Test Coverage:**
- Well-documented attractions (Statue of Liberty, Eiffel Tower, Colosseum)
- Obscure attractions (likely no Wikipedia page)
- Feature flag enable/disable behavior
- Response structure validation
- Wikipedia data structure validation

## Monitoring and Logging

The integration includes comprehensive logging:

```typescript
// Feature flag status
logInfo('wikipedia', 'Wikipedia integration enabled, fetching content guide');
logInfo('wikipedia', 'Wikipedia integration disabled via feature flag');

// Success case
logInfo('wikipedia', 'Wikipedia data retrieved', {
  pageTitle: wikipediaData.pageTitle,
  sections: wikipediaData.sections.length,
  extracts: Object.keys(wikipediaData.extracts).length
});

// Not found case
logInfo('wikipedia', 'No Wikipedia page found, proceeding without');

// Error case
logWarn('wikipedia', 'Failed to fetch Wikipedia data, proceeding without', {
  error: error.message
});
```

## Performance Considerations

### Current Implementation (Phase 1)

- **Latency**: ~500-1,500ms additional latency per request
  - Search: ~200-400ms
  - Article structure: ~200-400ms
  - Section extracts: ~100-700ms (depends on number of sections)
- **Timeout**: 2 seconds per API call (total ~6 seconds max)
- **Caching**: None (real-time fetching)

### Future Optimizations (Phase 2+)

1. **Caching Layer**:
   - Redis/Supabase cache for Wikipedia data
   - TTL: 7 days (Wikipedia articles change infrequently)
   - Reduces API calls by ~95%

2. **Batch Processing**:
   - Pre-fetch Wikipedia data for popular attractions
   - Store in Supabase database
   - Fallback to real-time fetch for uncached attractions

3. **API Token**:
   - Register for Wikipedia API token
   - Increase rate limit to 5,000 requests/hour
   - Enables higher traffic without hitting limits

## Wikipedia API Details

### REST API Summary Endpoint

```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}
```

**Response:**
```json
{
  "type": "standard",
  "title": "Statue of Liberty",
  "pageid": 19223,
  "extract": "The Statue of Liberty is a colossal...",
  "content_urls": {
    "desktop": {
      "page": "https://en.wikipedia.org/wiki/Statue_of_Liberty"
    }
  }
}
```

### MediaWiki Action API

```
GET https://en.wikipedia.org/w/api.php?action=parse&page={title}&prop=sections&format=json
```

**Response:**
```json
{
  "parse": {
    "title": "Statue of Liberty",
    "pageid": 19223,
    "sections": [
      { "toclevel": 1, "level": "2", "line": "History", "index": "1" },
      { "toclevel": 2, "level": "3", "line": "Design", "index": "2" }
    ]
  }
}
```

### Section Extract API

```
GET https://en.wikipedia.org/w/api.php?action=parse&page={title}&section={index}&prop=text&format=json
```

## Security Considerations

1. **User-Agent Header**: Required by Wikipedia API, uses "Nuolo-AudioTourGuide/1.0"
2. **Input Sanitization**: Attraction names and addresses are sanitized before API calls
3. **Rate Limiting**: Prevents excessive API usage and potential abuse
4. **Timeout Protection**: 2-second timeout prevents hanging requests
5. **HTML Stripping**: All HTML tags removed from extracts to prevent injection

## Troubleshooting

### Wikipedia data not appearing in responses

1. Check feature flag: `ENABLE_WIKIPEDIA_INTEGRATION=true` in Supabase secrets
2. Check edge function logs for Wikipedia-related errors
3. Verify attraction name is spelled correctly and matches Wikipedia page title
4. Check rate limit status (480 requests/hour limit)

### Rate limit exceeded

1. Wait for next hour (counter resets)
2. Reduce request volume
3. Consider implementing caching (Phase 2)
4. Register for Wikipedia API token (increases limit to 5,000/hour)

### Slow response times

1. Check Wikipedia API status: https://www.wikitech.wikimedia.org/wiki/Netmon
2. Verify network connectivity to Wikipedia servers
3. Consider implementing caching to reduce API calls
4. Check timeout settings (default: 2 seconds per call)

### Wikipedia page not found

1. Verify attraction name matches Wikipedia article title
2. Try alternative names (e.g., "Empire State Building" vs "Empire State")
3. Check if Wikipedia page exists at all
4. System will gracefully proceed without Wikipedia data

## Examples

### Example 1: Successful Wikipedia Integration

**Input:**
```json
{
  "attraction": {
    "name": "Eiffel Tower",
    "address": "Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France"
  }
}
```

**Wikipedia Data Retrieved:**
```json
{
  "found": true,
  "pageTitle": "Eiffel Tower",
  "pageUrl": "https://en.wikipedia.org/wiki/Eiffel_Tower",
  "sections": [
    { "title": "History", "level": 1, "index": 1 },
    { "title": "Design", "level": 1, "index": 2 },
    { "title": "Construction", "level": 2, "index": 3 },
    { "title": "Modern usage", "level": 1, "index": 4 }
  ],
  "extracts": {
    "History": "The Eiffel Tower was built for the 1889 World's Fair...",
    "Design": "The design of the Eiffel Tower is attributed to Maurice Koechlin..."
  }
}
```

### Example 2: Wikipedia Page Not Found

**Input:**
```json
{
  "attraction": {
    "name": "Random Local Park XYZ",
    "address": "123 Random St, Anytown, USA"
  }
}
```

**Wikipedia Data Retrieved:**
```json
{
  "found": false,
  "sections": [],
  "extracts": {}
}
```

**Result:** System proceeds with standard narrative generation (no Wikipedia guide)

## Future Enhancements

### Phase 2: Caching Layer
- Implement Redis/Supabase cache for Wikipedia data
- 7-day TTL for cached data
- Reduces API calls by ~95%
- Improves response times by ~500-1,000ms

### Phase 3: Pre-fetching
- Background job to pre-fetch Wikipedia data for popular attractions
- Store in Supabase database
- Real-time fetch only for uncached attractions

### Phase 4: Multi-language Support
- Support Wikipedia articles in multiple languages
- Language selection based on user preferences
- Fallback to English if preferred language not available

### Phase 5: Image Integration
- Extract representative images from Wikipedia
- Include image URLs in response metadata
- Enable richer mobile app experiences

## References

- Wikipedia REST API: https://en.wikipedia.org/api/rest_v1/
- MediaWiki Action API: https://www.mediawiki.org/wiki/API:Main_page
- Wikipedia API Etiquette: https://www.mediawiki.org/wiki/API:Etiquette
- Wikipedia Rate Limits: https://www.mediawiki.org/wiki/API:REST_API#Rate_limits
