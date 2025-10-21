// Wikipedia Integration Service
// Fetches article structure and extracts from Wikipedia for attraction narration guidance

import type { WikipediaData, WikipediaSection } from './types/aiProvider.ts';

// Rate limiting state (in-memory, resets on function cold start)
let requestCount = 0;
let lastResetTime = Date.now();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_MAX = 480; // Conservative limit (500 actual limit)
const RATE_LIMIT_WARNING = 400;

/**
 * Check if Wikipedia integration is enabled via feature flag
 */
export function isWikipediaEnabled(): boolean {
  const enabled = Deno.env.get('ENABLE_WIKIPEDIA_INTEGRATION');
  return enabled === 'true';
}

/**
 * Check and update rate limiting
 * Returns true if request should proceed, false if rate limit exceeded
 */
function checkRateLimit(): boolean {
  const now = Date.now();

  // Reset counter if window has passed
  if (now - lastResetTime > RATE_LIMIT_WINDOW) {
    requestCount = 0;
    lastResetTime = now;
  }

  // Check if approaching limit
  if (requestCount >= RATE_LIMIT_MAX) {
    console.warn('[Wikipedia] Rate limit exceeded, requests disabled until reset');
    return false;
  }

  if (requestCount >= RATE_LIMIT_WARNING) {
    console.warn(`[Wikipedia] Approaching rate limit: ${requestCount}/${RATE_LIMIT_MAX}`);
  }

  requestCount++;
  return true;
}

/**
 * Search for Wikipedia page by attraction name
 * Returns page info if found, or { found: false } if not found
 */
async function searchWikipediaPage(
  attractionName: string,
  attractionAddress: string
): Promise<{ found: boolean; title?: string; url?: string; pageId?: number }> {
  if (!checkRateLimit()) {
    return { found: false };
  }

  try {
    // Clean attraction name for search
    const searchTerm = attractionName
      .replace(/[,\.]/g, '') // Remove punctuation
      .trim();

    // Try REST API summary endpoint first (handles redirects automatically)
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(summaryUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Nuolo-AudioGuide/1.0 (https://nuolo.app; contact@nuolo.app)',
        'Api-User-Agent': 'Nuolo-AudioGuide/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Wikipedia] No page found for: ${searchTerm}`);
        return { found: false };
      }
      throw new Error(`Wikipedia API returned ${response.status}`);
    }

    const data = await response.json();

    // Check if it's a valid content page (not disambiguation, etc.)
    if (data.type !== 'standard') {
      console.log(`[Wikipedia] Page found but not standard content: ${data.type}`);
      return { found: false };
    }

    return {
      found: true,
      title: data.title,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
      pageId: data.pageid
    };

  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn('[Wikipedia] Search timeout');
    } else {
      console.warn('[Wikipedia] Search failed:', (error as Error).message);
    }
    return { found: false };
  }
}

/**
 * Fetch article section structure from Wikipedia
 */
async function fetchArticleStructure(pageTitle: string): Promise<{ sections: WikipediaSection[] }> {
  if (!checkRateLimit()) {
    return { sections: [] };
  }

  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?` +
      `action=parse&` +
      `page=${encodeURIComponent(pageTitle)}&` +
      `prop=sections&` +
      `format=json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Nuolo-AudioGuide/1.0 (https://nuolo.app; contact@nuolo.app)',
        'Api-User-Agent': 'Nuolo-AudioGuide/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Wikipedia API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.info || 'Unknown API error');
    }

    if (!data.parse || !data.parse.sections) {
      return { sections: [] };
    }

    // Convert to our format and limit to top 15 sections
    const sections: WikipediaSection[] = data.parse.sections
      .filter((s: any) => {
        // Skip "See also", "References", "External links", etc.
        const skipSections = ['see also', 'references', 'external links', 'notes', 'bibliography', 'further reading'];
        return !skipSections.includes(s.line.toLowerCase());
      })
      .slice(0, 15)
      .map((s: any) => ({
        title: s.line,
        level: parseInt(s.level, 10),
        index: parseInt(s.index, 10)
      }));

    return { sections };

  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn('[Wikipedia] Structure fetch timeout');
    } else {
      console.warn('[Wikipedia] Structure fetch failed:', (error as Error).message);
    }
    return { sections: [] };
  }
}

/**
 * Fetch text extracts for given sections
 * Returns mapping of section title to extract text
 */
async function fetchSectionExtracts(
  pageTitle: string,
  sections: WikipediaSection[]
): Promise<Record<string, string>> {
  const extracts: Record<string, string> = {};

  // Limit to top 10 sections to avoid too many API calls
  const sectionsToFetch = sections.slice(0, 10);

  // Fetch extracts in parallel (but respect rate limits)
  const fetchPromises = sectionsToFetch.map(async (section) => {
    if (!checkRateLimit()) {
      return;
    }

    try {
      const apiUrl = `https://en.wikipedia.org/w/api.php?` +
        `action=parse&` +
        `page=${encodeURIComponent(pageTitle)}&` +
        `section=${section.index}&` +
        `prop=text&` +
        `format=json`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Nuolo-AudioGuide/1.0 (https://nuolo.app; contact@nuolo.app)',
          'Api-User-Agent': 'Nuolo-AudioGuide/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Wikipedia API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.error || !data.parse || !data.parse.text) {
        return;
      }

      // Extract plain text from HTML
      const htmlText = data.parse.text['*'];
      const plainText = stripHtmlAndExtractSentences(htmlText, 2); // Get first 2 sentences

      if (plainText) {
        extracts[section.title] = plainText;
      }

    } catch (error) {
      // Silently skip failed sections
      console.warn(`[Wikipedia] Failed to fetch extract for section: ${section.title}`);
    }
  });

  await Promise.all(fetchPromises);

  return extracts;
}

/**
 * Strip HTML tags and extract first N sentences
 */
function stripHtmlAndExtractSentences(html: string, maxSentences: number): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove citation markers like [1], [2], etc.
  text = text.replace(/\[\d+\]/g, '');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Extract first N sentences
  const sentences = text.split(/\.\s+/);
  const extracted = sentences.slice(0, maxSentences).join('. ');

  // Add period if it doesn't end with one
  return extracted.endsWith('.') ? extracted : extracted + '.';
}

/**
 * Main orchestration function to enrich with Wikipedia data
 * Returns complete Wikipedia data structure or { found: false } if unavailable
 */
export async function enrichWithWikipedia(
  attractionName: string,
  attractionAddress: string
): Promise<WikipediaData> {
  // 1. Search for page
  const searchResult = await searchWikipediaPage(attractionName, attractionAddress);

  if (!searchResult.found || !searchResult.title) {
    return { found: false, sections: [], extracts: {} };
  }

  // 2. Fetch article structure
  const structure = await fetchArticleStructure(searchResult.title);

  if (structure.sections.length === 0) {
    return { found: false, sections: [], extracts: {} };
  }

  // 3. Fetch extracts for sections
  const extracts = await fetchSectionExtracts(searchResult.title, structure.sections);

  return {
    found: true,
    pageTitle: searchResult.title,
    pageUrl: searchResult.url,
    sections: structure.sections,
    extracts: extracts
  };
}

/**
 * Get current rate limit status (for monitoring/debugging)
 */
export function getRateLimitStatus(): { count: number; limit: number; resetIn: number } {
  const now = Date.now();
  const resetIn = RATE_LIMIT_WINDOW - (now - lastResetTime);

  return {
    count: requestCount,
    limit: RATE_LIMIT_MAX,
    resetIn: Math.max(0, resetIn)
  };
}
