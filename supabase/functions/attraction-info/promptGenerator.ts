// Attraction Info Prompt Generator V2
// Modular block architecture for natural, tour-guide-like narration

export type AttractionTheme = 'history' | 'nature' | 'architecture' | 'culture' | 'general';
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ja' | 'ko' | 'zh';

export interface AttractionPreferences {
  theme?: AttractionTheme;
  audioLength?: 'short' | 'medium' | 'deep-dive';
  language?: SupportedLanguage;
  voiceStyle?: 'casual' | 'formal' | 'energetic' | 'calm';
  narrativeMode?: 'story-driven' | 'fact-driven';
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
 * Block 7: Story Structure (Story-Driven Mode)
 * Character-conflict-plot framework with 70/30 storytelling rule
 */
function buildStoryStructureBlock(): string {
  return `\nStory structure framework (70% story, 30% facts):

Character introduction (30-60 seconds):
- Introduce a relatable person, group, or personified place connected to this attraction
- Make them human and memorable with specific details
- Examples: historical figure with personality, local resident with a story, the building itself as character
- Show their motivations, struggles, dreams - make listeners care

Conflict/tension (middle section):
- Present challenge, mystery, or transformation that creates narrative momentum
- Universal emotions work best: fear, joy, frustration, love, triumph, loss
- Stakes should be clear - what was at risk? What could have been lost?
- Build emotional investment through rising action

Plot resolution:
- Show how tension resolves or transforms
- Connect resolution to visitor's present experience
- Leave with insight or thought-provoking question
- Create a sense of completion while opening new perspectives

Narrative arc options (choose best fit for this attraction's story):
- Man in a hole: fall → rise (overcome challenge, resilience story)
- Rags to riches: rise (transformation, growth, achievement)
- Cinderella: rise → fall → rise (setback and comeback, perseverance)
- Tragedy: rise → fall (loss, sacrifice, what was left behind)
- Apply arc to attraction's story, not just timeline of facts

Content balance guideline:
- 70% storytelling: Character moments, scenes, emotional beats, human experiences
- 30% facts: Historical dates, dimensions, technical details - EMBEDDED in narrative
- Maximum 3-5 key facts per tour - quality over quantity
- Human interest stories take priority over chronological completeness`;
}

/**
 * Block 8: Story-Driven Opening Beat
 * Hook-focused opener for emotional capture
 */
function buildStoryDrivenOpeningBeat(): string {
  return `\nOpening beat - HOOK (First 15-30 seconds - CRITICAL FOR ENGAGEMENT):

Start with ONE powerful attention-grabber:
- Universal emotion: Tap into fear, wonder, joy, mystery, curiosity
- Surprising fact: Something that challenges assumptions or reveals the unexpected
- Vivid sensory detail: Pull listener into the scene immediately with specific sensations
- Intriguing question: "What if I told you...", "Have you ever wondered..."
- Character moment: Drop listener into a compelling human story mid-scene

Examples of strong hooks:
✅ "Imagine standing here 200 years ago, hearing church bells ring as the city burned..."
✅ "Listen closely—can you hear the echo? That's not just sound. That's history talking."
✅ "Everyone thinks this building is 100 years old. It's actually been standing for 300."
✅ "Maria was 22 when she opened her café here. She had no idea it would spark a revolution."

Examples of weak hooks to AVOID:
❌ "Welcome to [attraction name]. This is located at [address]."
❌ "Today we're going to learn about the history of this place."
❌ "This attraction is known for its architectural features."

Goal: Capture attention and create curiosity BEFORE providing orientation details
Orientation can come after the hook - first make them want to listen`;
}

/**
 * Block 9: Sensory Immersion (Story-Driven Mode)
 * Multi-sensory engagement directives for memory retention
 */
function buildSensoryImmersionBlock(): string {
  return `\nSensory immersion directives (throughout narrative - ENHANCES MEMORY):

Multi-sensory engagement (minimum 3 of 5 senses per tour):
- Sight: Precise visual details, not generic descriptions
  * Good: "Notice the worn limestone steps, polished smooth by centuries of footsteps"
  * Avoid: "The building looks old and interesting"
- Sound: What listeners can hear around them right now
  * Good: "The echo you hear is the same acoustics musicians heard in 1847"
  * Avoid: "There were sounds here in the past"
- Smell: Aromas that define this place, past or present
  * Good: "The aroma of fresh-baked empanadas still fills this corner at dawn"
  * Avoid: "There were smells associated with this place"
- Touch: Textures, temperatures, physical sensations
  * Good: "Run your hand along the rough limestone—it's been here since 1847"
  * Avoid: "The walls are made of stone"
- Taste: If relevant to food/culture attractions
  * Good: "The recipe hasn't changed—same sweet cinnamon locals tasted in 1920"
  * Avoid: Generic food references

Pacing and balance:
- Target: 1 sensory detail per 100 words (roughly every 40 seconds of speech)
- Don't overload - be selective and precise
- Vary which senses you engage to maintain interest
- Connect sensory details to emotional or historical significance

Purpose: Pull listeners INTO the story, make them feel present in the narrative
Sensory details create vivid mental pictures that enhance memory retention by 40-60%`;
}

/**
 * Block 10: Show Don't Tell (Story-Driven Mode)
 * Audio-adapted techniques for discovery vs. exposition
 */
function buildShowDontTellBlock(): string {
  return `\n"Show Don't Tell" directives (audio adaptation - CREATE DISCOVERY):

Core principle: Let listeners discover insights through scenes and details rather than stating conclusions

Create "Aha!" moments:
- Present evidence and let listeners connect the dots
- Use concrete examples instead of abstract concepts
- Show through scenes, characters, and details rather than explaining
- Trust your listener to make connections

Scene-building for audio:
- Drop listeners into specific moments with vivid details
- Use dialogue or quotes to bring characters alive
- Build atmosphere through sound cues and pacing
- Let actions reveal character and meaning

Examples of SHOWING vs. TELLING:

SHOWING (Good):
✅ "Maria stood at this very corner every morning at 5 AM, watching the neighborhood change. One by one, her neighbors left. But she stayed, rolling out dough while the bulldozers moved in across the street."
✅ "The silence here tells you everything. No echo. No resonance. The acoustics were deliberately killed when they converted it from a church—couldn't have sound carrying during speeches."
✅ "Look at the doorframe—see those marks? Each one is a family's height measurement. The Johnsons, 1952. The Lees, 1963. The Garcias, 1978. Generations watching their children grow right here."

TELLING (Avoid):
❌ "This was an important historical event that changed things."
❌ "Many people were affected by this development."
❌ "The building has cultural significance."
❌ "This place played a role in the community."

Avoid spoon-feeding conclusions:
- Don't say "This shows that..." or "This proves..."
- Present the evidence and let insight emerge naturally
- Use specific details over general statements
- Create moments of realization rather than stating facts`;
}

/**
 * Block 11: Story-Driven Orchestration
 * Enhanced narrative structure with 70/30 rule
 */
function buildStoryDrivenOrchestration(audioLength: string): string {
  const isDeepDive = audioLength === 'deep-dive';

  const baseDirectives = `\nNarrative orchestration (story-driven mode):

Content balance: 70% storytelling, 30% facts
- Facts should be EMBEDDED in narrative, not listed separately
- Maximum 3-5 key facts per tour (quality over quantity)
- Human interest stories take priority over chronological completeness
- If you must choose between a great story and a minor fact, choose the story

Opening hook (15-30 sec):
- Emotional attention-grabber (see opening beat block)
- Create immediate curiosity and engagement
- Hook comes BEFORE orientation

Character introduction (30-60 sec):
- Relatable person/place with specific human elements
- Make them memorable with personality, quirks, struggles
- Establish emotional connection early

Story arc (middle section):
- Rising action: Build narrative momentum and tension
- Conflict: Present challenge, mystery, or transformation
- Resolution: Show how tension resolves or transforms
- Use callbacks to earlier points for coherence

Human connection (REQUIRED - not optional):
- Minimum 1-2 personal anecdotes or character spotlights
- At least 1 light humor moment (culturally appropriate, natural)
- Local legends or personal stories prioritized over generic history
- Micro-anecdotes (brief, vivid scenes) create memorability

Sensory weaving (throughout):
- Engage minimum 3 of 5 senses
- Target: 1 sensory detail per 100 words
- Connect sensory details to emotional significance
- Vary senses to maintain interest

Transitions and flow:
- Natural callbacks to previous points
- "Remember when I mentioned..." creates coherence
- Use transitional phrases that imply reflection
- Vary pacing: fast exciting moments + slow reflective pauses

Closing insight (final 30 seconds):
- Thought-provoking question or forward-looking connection
- Link story to visitor's ongoing experience
- Leave them with something to notice, think about, or explore
- Create sense of completion while opening new perspectives`;

  if (isDeepDive) {
    return baseDirectives + `\n
Deep-dive enhancements (story-driven mode):
- Extended arc: introduction → origin story → pivotal era → transformation → lasting impact → insight
- Target 2-3 character spotlights or mini-scenes for sustained engagement
- Build multiple emotional beats (not just one arc) - create emotional variety
- Layer sensory details to create rich atmosphere throughout
- Target 1,200-1,800 words (8-12 min spoken) - sweet spot for attention
- Vary pacing dramatically: intense moments followed by reflective breathing room
- Use "chapter" transitions: "Now, here's what changed everything..."
- Include surprising twists or lesser-known details that challenge assumptions
- Weave multiple narrative threads that connect by the end
- Aim for 5-7 memorable takeaways (stories, not facts) that stick with listener`;
  }

  return baseDirectives;
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
  const narrativeMode = preferences.narrativeMode || 'fact-driven'; // Default to fact-driven (V2.0 behavior)

  // Start with common blocks
  const blocks: string[] = [
    buildSystemPersona(lang),
    buildContextBlock(attractionAddress, spatialHints, lang, situationalContext),
    buildWikipediaGuideBlock(wikipediaData),
    buildAudienceBlock(preferences)
  ];

  // Conditional block assembly based on narrative mode
  if (narrativeMode === 'story-driven') {
    // Story-driven mode: Add storytelling-enhanced blocks
    blocks.push(
      buildStoryStructureBlock(),           // Character-conflict-plot framework
      buildStoryDrivenOpeningBeat(),        // Emotional hook guidance
      buildSensoryImmersionBlock(),         // Multi-sensory engagement
      buildShowDontTellBlock(),             // Discovery vs. exposition
      buildStoryDrivenOrchestration(audioLength)  // 70/30 rule orchestration
    );
  } else {
    // Fact-driven mode: Keep current V2.0 blocks (default)
    blocks.push(
      buildNarrativeOrchestration(audioLength)  // Current V2.0 flexible beats
    );
  }

  // Common blocks for both modes
  blocks.push(
    buildAccuracyBlock(),
    buildCriticalInstructions(lang)
  );

  // Filter out empty blocks
  const assembledBlocks = blocks.filter(block => block.length > 0);

  // Add user request (different for each mode)
  const userRequest = narrativeMode === 'story-driven'
    ? `\nYour task:
Create a STORY-DRIVEN audio tour for "${attractionName}".
Remember the 70/30 rule: 70% storytelling, 30% facts embedded naturally.
Lead with narrative, create emotional connection, make it memorable.
Prioritize human stories and sensory experiences over comprehensive factual coverage.
If you don't have compelling stories to tell, it's better to deliver shorter, authentic narration than to pad with generic descriptions.`
    : `\nYour task:
Create an audio tour narrative for "${attractionName}".
Follow the guidance above, but remember: authenticity and clarity trump hitting exact word counts.
If you don't have enough verified information, it's better to deliver a shorter, truthful narration than to pad with generic filler.`;

  return assembledBlocks.join('\n') + userRequest;
}
