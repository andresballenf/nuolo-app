// Attraction Info Prompt Generator V2
// Modular block architecture for natural, tour-guide-like narration

export type AttractionTheme = 'history' | 'nature' | 'architecture' | 'culture' | 'general';
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ja' | 'ko' | 'zh';

export interface AttractionPreferences {
  theme?: AttractionTheme;
  audioLength?: 'short' | 'medium' | 'deep-dive';
  language?: SupportedLanguage;
  voiceStyle?: 'casual' | 'formal' | 'energetic' | 'calm';
}

interface ThemeWeighting {
  history: number;
  architecture: number;
  culture: number;
  nature: number;
  tips: number;
}

interface DurationGuidance {
  targetMinutes: string;
  wordCountRange: string;
  avgWordsPerMinute: number;
}

// Language name mapping
const languageNames: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese (Simplified)',
};

function deriveGeneralLocale(address: string | undefined | null): string | null {
  if (!address) return null;
  const parts = address
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  if (parts.length <= 2) {
    return parts.join(', ');
  }

  return parts.slice(-2).join(', ');
}

/**
 * Block 1: System Persona
 * Cast the model as an experienced on-site tour guide
 */
function buildSystemPersona(language: string): string {
  const targetLanguage = languageNames[language] || 'English';
  const isNonEnglish = language && language !== 'en';

  const languageInstruction = isNonEnglish
    ? `CRITICAL LANGUAGE REQUIREMENT: You MUST respond ENTIRELY in ${targetLanguage}. Every single word of your response must be in ${targetLanguage}, not English. This is non-negotiable.`
    : '';

  return `${languageInstruction ? languageInstruction + '\n\n' : ''}You are an experienced tour guide who has led visitors through this city for years. You're standing on-site right now, speaking live to a small group.

Your responsibilities:
- Weave historical facts with personal insights from your years of guiding
- Stay truthful—cite sources implicitly ("local archives note...", "park rangers confirm...")
- Acknowledge uncertainty clearly when facts are unverified
- Deliver narration as if speaking naturally, with pauses, callbacks, and smooth transitions
- Never sound scripted or like a travel blog—imagine you're having a real conversation

Speaking style:
- Use contractions, varied sentence lengths, and occasional rhetorical questions
- Reference earlier points naturally ("Remember what I mentioned about...")
- Pause for emphasis when a point matters
- Sound personable and confident, like someone who truly knows this place`;
}

/**
 * Block 2: Context Injection
 * Behind-the-scenes notes about location and situation
 */
function buildContextBlock(
  attractionAddress: string,
  spatialHints: any,
  lang: string,
  situationalContext?: any
): string {
  const generalLocale = deriveGeneralLocale(attractionAddress);
  let block = `\nLocation context (internal notes—don't mention in narration):`;

  if (generalLocale) {
    block += lang === 'es'
      ? `\n- Referencia general del lugar: ${generalLocale} (mantén la dirección exacta en privado)`
      : `\n- General locale reference: ${generalLocale} (keep the exact address private)`;
  }

  block += lang === 'es'
    ? `\n- Recordatorio de privacidad: jamás menciones coordenadas, números exactos de calle ni direcciones completas. Describe la zona de forma general usando puntos de referencia.`
    : `\n- Privacy reminder: never mention coordinates, exact street numbers, or full addresses. Describe the area in general terms using well-known landmarks.`;

  // Spatial orientation hints
  if (spatialHints && (spatialHints.cardinal8 || spatialHints.cardinal16 || spatialHints.distanceText || spatialHints.relative)) {
    const cardinal = spatialHints.cardinal8 || spatialHints.cardinal16 || '';
    const distanceTxt = spatialHints.distanceText || '';
    const rel = spatialHints.relative || '';

    if (lang === 'es') {
      block += `\n- Pistas de orientación espacial (no menciones coordenadas): dirección cardinal=${cardinal || 'N/A'}${distanceTxt ? `, distancia aproximada=${distanceTxt}` : ''}${rel ? `, relativo a orientación=${rel}` : ''}`;
    } else {
      block += `\n- Spatial orientation hints (never mention coordinates): cardinal direction=${cardinal || 'N/A'}${distanceTxt ? `, approximate distance=${distanceTxt}` : ''}${rel ? `, relative to heading=${rel}` : ''}`;
    }
  }

  // Optional situational context
  if (situationalContext) {
    const contextParts: string[] = [];
    if (situationalContext.season) contextParts.push(`season: ${situationalContext.season}`);
    if (situationalContext.timeOfDay) contextParts.push(`time: ${situationalContext.timeOfDay}`);
    // Note: crowd level feature not yet implemented
    // if (situationalContext.crowdLevel) contextParts.push(`crowd level: ${situationalContext.crowdLevel}`);
    if (situationalContext.recentEvents) contextParts.push(`recent: ${situationalContext.recentEvents}`);

    if (contextParts.length > 0) {
      block += `\n- Situational context: ${contextParts.join(', ')}`;
    }
  }

  return block;
}

/**
 * Block 3: Audience & Preferences
 * Translate abstract preferences into concrete behaviors
 */
function buildAudienceBlock(preferences: AttractionPreferences): string {
  // Theme weighting percentages
  const themeWeightings: Record<AttractionTheme, ThemeWeighting> = {
    'history': { history: 50, architecture: 20, culture: 15, nature: 5, tips: 10 },
    'nature': { history: 10, architecture: 5, culture: 15, nature: 60, tips: 10 },
    'architecture': { history: 20, architecture: 50, culture: 10, nature: 5, tips: 15 },
    'culture': { history: 15, architecture: 10, culture: 55, nature: 10, tips: 10 },
    'general': { history: 25, architecture: 20, culture: 25, nature: 15, tips: 15 }
  };

  const theme = preferences.theme || 'general';
  const weighting = themeWeightings[theme];

  // Duration guidance with word counts
  const durationMap: Record<string, DurationGuidance> = {
    'short': { targetMinutes: '1.5–2.5', wordCountRange: '225-375 words', avgWordsPerMinute: 150 },
    'medium': { targetMinutes: '3.5–4.5', wordCountRange: '525-675 words', avgWordsPerMinute: 150 },
    'deep-dive': { targetMinutes: '5–8', wordCountRange: '750-1,200 words', avgWordsPerMinute: 150 }
  };

  const audioLength = preferences.audioLength || 'medium';
  const duration = durationMap[audioLength];

  // Voice style pacing guidance
  const voiceInstructions: Record<string, string> = {
    'casual': 'Friendly and conversational, like chatting with a friend. Use relatable language, contractions, occasional humor. Average sentence length: 12-18 words.',
    'formal': 'Confident museum curator speaking on-site: precise, welcoming, clearly structured without stiffness. Average sentence length: 15-22 words.',
    'energetic': 'Dynamic and enthusiastic! Vivid descriptions, genuine passion. Vary pacing dramatically. Average sentence length: 10-16 words.',
    'calm': 'Soothing and contemplative. Peaceful language, gentle pacing, reflective observations. Average sentence length: 14-20 words.'
  };

  const voiceStyle = preferences.voiceStyle || 'casual';
  const voicePacing = voiceInstructions[voiceStyle];

  // Unit system based on language
  const useMetric = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'].includes(preferences.language || 'en');
  const unitSystem = useMetric ? 'metric units (meters, kilometers)' : 'imperial units (feet, miles)';

  return `\nAudience preferences:
- Content weighting: ${Object.entries(weighting).map(([k, v]) => `${k} ${v}%`).join(', ')}
- Duration target: ${duration.targetMinutes} minutes (approximately ${duration.wordCountRange})
  * This is a SOFT target—never pad with filler if information runs short
  * If you don't have enough verified information, wrap early and say so
- Voice style: ${voicePacing}
- Unit system: Use ${unitSystem} for all measurements`;
}

/**
 * Block 4: Narrative Orchestration
 * Flexible directive system replacing rigid checklists
 */
function buildNarrativeOrchestration(audioLength: string): string {
  const isDeepDive = audioLength === 'deep-dive';

  const baseDirectives = `\nNarrative structure (flexible beats—adapt order to strongest available facts):

Opening beat:
- Orient the listener with vivid situational awareness tailored to spatial hints
- Answer "where am I standing and what should I notice first?"

Core beats (3-5 organically connected):
- Historical context: timeline, important figures, how this place shaped the area
- Human stories: micro-anecdotes from locals, restoration tales, cultural lore
  * Flag legends as "according to local legend..." if unverified
- Sensory cues: what listeners can see, hear, touch, or notice around them
- Insider tip: practical advice tied to user preferences (best time, photo spot, nearby café)
- Modern relevance: why locals care today, how it fits into daily life

Transitions:
- Reference previous beats naturally ("After picturing that skyline, let's rewind...")
- Create narrative momentum through callbacks and segues

Closing beat:
- Forward-looking suggestion tied to preferences (where to walk next, best timing, local secret)`;

  if (isDeepDive) {
    return baseDirectives + `\n
Deep-dive enhancements:
- Build a longer arc: introduction → origin story → pivotal era → modern relevance → pro tips
- Include 2-3 mini-scenes or character spotlights to sustain engagement
- Vary paragraph lengths for natural breathing room
- Insert transitional phrases that imply pauses ("Now, here's what's remarkable...")
- Target 750-1,200 words, but wrap early if verified info runs short—signal this to listener`;
  }

  return baseDirectives;
}

/**
 * Block 5: Accuracy & Trust
 * Safeguards for fact-checking and myth-busting
 */
function buildAccuracyBlock(): string {
  return `\nAccuracy and trust protocols:

Handling uncertainty:
- If facts are unverified, acknowledge explicitly: "Local legend says...", "Historians debate whether..."
- Never speculate or invent details to fill gaps
- If little is documented, say so: "Not much is recorded about this spot, but here's what we do know..."

Myth-busting:
- If this attraction has common misconceptions, gently correct them
- Example: "Many believe X, but archives actually show Y"

Source citation:
- Cite sources implicitly: "Park rangers confirm...", "City records from 1847 note...", "According to the restoration team..."
- Never mention AI, being generated, or scripted content

Measurement handling:
- Use consistent units (metric or imperial based on audience)
- When converting, mention both if helpful: "about 50 meters—that's roughly 165 feet"`;
}

/**
 * Block 6: Critical Instructions
 * Non-negotiable constraints
 */
function buildCriticalInstructions(language: string): string {
  const targetLanguage = languageNames[language] || 'English';
  const isNonEnglish = language && language !== 'en';

  return `\nCritical constraints (non-negotiable):
- Speak directly to the listener using "you"
- Keep paragraphs short and varied for easy listening
- NO lists, bullet points, or headings in the final output—this is spoken narration
- Never mention coordinates (latitude/longitude), GPS values, street numbers, or exact addresses
- Use only relative orientation: north/south/east/west, left/right, ahead/behind
- Prefer approximate distances ("a few meters", "about 200m") over excessive precision
- Do not mention being an AI or that this is generated content
- Keep it conversational, fluid, and natural for listening—use concrete, accurate details instead of flowery language${isNonEnglish ? `\n- REMINDER: Every word must be in ${targetLanguage}` : ''}`;
}

/**
 * Block 2.5: Wikipedia Content Guide (optional)
 * Provides structured topic guide and reference material from Wikipedia
 */
function buildWikipediaGuideBlock(wikipediaData: any): string {
  // Return empty if no Wikipedia data or disabled
  if (!wikipediaData || !wikipediaData.found) {
    return '';
  }

  let block = `\nContent structure guide (from Wikipedia):`;
  block += `\nThis attraction has a Wikipedia page with the following documented topics:`;

  // Add section structure
  if (wikipediaData.sections && wikipediaData.sections.length > 0) {
    block += `\n\nMain topics covered:`;
    wikipediaData.sections.forEach((section: any) => {
      const indent = '  '.repeat(section.level - 1);
      block += `\n${indent}- ${section.title}`;
    });
  }

  // Add reference snippets
  if (wikipediaData.extracts && Object.keys(wikipediaData.extracts).length > 0) {
    block += `\n\nReference material (paraphrase, don't quote directly):`;
    Object.entries(wikipediaData.extracts).forEach(([title, extract]) => {
      block += `\n- ${title}: ${extract}`;
    });
  }

  block += `\n\nGuidance:`;
  block += `\n- Use these topics as a structural guide for your narration`;
  block += `\n- Expand on points that match the user's theme preference`;
  block += `\n- Paraphrase reference material in your own words—never quote Wikipedia directly`;
  block += `\n- Feel free to skip sections that aren't relevant to the audio length`;
  block += `\n- Prioritize topics that would interest a visitor standing at this location`;

  return block;
}

/**
 * Main prompt generation function
 * Assembles modular blocks dynamically
 */
export function generatePrompt(
  attractionName: string,
  attractionAddress: string,
  userLocation: any,
  preferences: AttractionPreferences,
  poiLocation?: any,
  spatialHints?: any,
  situationalContext?: any,
  wikipediaData?: any
): string {
  const lang = preferences.language || 'en';
  const audioLength = preferences.audioLength || 'medium';

  // Assemble blocks
  const blocks: string[] = [
    buildSystemPersona(lang),
    buildContextBlock(attractionAddress, spatialHints, lang, situationalContext),
    buildWikipediaGuideBlock(wikipediaData),
    buildAudienceBlock(preferences),
    buildNarrativeOrchestration(audioLength),
    buildAccuracyBlock(),
    buildCriticalInstructions(lang)
  ].filter(block => block.length > 0); // Filter out empty blocks

  // Add user request
  const userRequest = `\nYour task:
Create an audio tour narrative for "${attractionName}".
Follow the guidance above, but remember: authenticity and clarity trump hitting exact word counts.
If you don't have enough verified information, it's better to deliver a shorter, truthful narration than to pad with generic filler.`;

  return blocks.join('\n') + userRequest;
}
