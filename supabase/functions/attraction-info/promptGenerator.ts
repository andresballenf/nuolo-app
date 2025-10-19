export function generatePrompt(attractionName, attractionAddress, userLocation, preferences, poiLocation?, spatialHints?) {
  // Map language codes to full language names
  const languageNames = {
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
  
  const targetLanguage = languageNames[preferences.language] || 'English';
  const isNonEnglish = preferences.language && preferences.language !== 'en';
  const lang = preferences.language || 'en';
  
  // Adjust pacing guidance based on audio length preference
  const durationGoal = preferences.audioLength === 'short'
    ? 'about 2 minutes of spoken narration'
    : preferences.audioLength === 'medium'
      ? 'around 4 minutes of spoken narration'
      : 'roughly 7 minutes of spoken narration';

  // Map theme preferences to content focus
  const themeGuide = {
    'history': 'historical events, timelines, important figures, and how this place shaped the area',
    'nature': 'natural features, ecology, flora/fauna, environmental significance, and seasonal changes',
    'architecture': 'architectural style, design elements, construction techniques, architects, and structural innovations',
    'culture': 'cultural significance, local traditions, community impact, festivals, and social importance',
    'general': 'a balanced mix of history, culture, architecture, and interesting facts'
  };
  
  const themeFocus = themeGuide[preferences.theme] || themeGuide['general'];

  // Map voice style to narrative tone
  const voiceInstructions = {
    'casual': 'Write in a friendly, conversational tone like chatting with a friend. Use relatable language, contractions, and occasional humor.',
    'formal': 'Write like a confident museum curator speaking on-site: precise, welcoming, and clearly structured without sounding stiff.',
    'energetic': 'Write with enthusiasm and excitement! Use dynamic language, vivid descriptions, and convey genuine passion for the place.',
    'calm': 'Write in a soothing, contemplative tone. Use peaceful language, gentle pacing, and reflective observations.'
  };
  
  const voiceStyle = voiceInstructions[preferences.voiceStyle] || voiceInstructions['casual'];
  
  // Language-specific instruction
  const languageInstruction = isNonEnglish 
    ? `LANGUAGE REQUIREMENT: Respond entirely in ${targetLanguage}. Do not include any English words.`
    : '';

  // Orientation hints derived without exposing raw coordinates
  let orientationHints = '';
  const hints = spatialHints || null;
  if (hints && (hints.cardinal8 || hints.cardinal16 || hints.distanceText || hints.relative)) {
    const cardinal = hints.cardinal8 || hints.cardinal16 || '';
    const distanceTxt = hints.distanceText ? hints.distanceText : '';
    const rel = hints.relative ? hints.relative : '';
    if (lang === 'es') {
      orientationHints = `Pistas de orientación (no menciones coordenadas ni calles): cardinal=${cardinal || 'N/A'}${distanceTxt ? `, distancia aproximada=${distanceTxt}` : ''}${rel ? `, relativo a tu orientación=${rel}` : ''}.`;
    } else {
      orientationHints = `Orientation hints (do not mention coordinates or streets): cardinal=${cardinal || 'N/A'}${distanceTxt ? `, approximate distance=${distanceTxt}` : ''}${rel ? `, relative to heading=${rel}` : ''}.`;
    }
  }

  // Adjust units based on language/region
  const useMetric = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'].includes(preferences.language);
  const unitSystem = useMetric ? 'Use metric units (meters, kilometers)' : 'Use imperial units (feet, miles)';

  return `${languageInstruction ? languageInstruction + '\n\n' : ''}Create an audio tour narrative for "${attractionName}" targeting ${durationGoal}, but treat this as guidance rather than a quota.

Identity resolution
Use the full address to ensure you describe the correct place, but avoid mentioning the address in the output:
- Address: ${attractionAddress}
${orientationHints ? `\n${orientationHints}\n` : ''}
Voice and tone
${voiceStyle}

Theme guidance
Emphasize ${themeFocus} if verifiable details exist, but keep a balanced mix of history, culture, architecture, and practical details. Do not force the theme if information is lacking.

Narrative ingredients
Blend naturally (order can vary):
- Begin by orienting the listener to where they are standing and what to look at first
- Paint one vivid sensory moment using sight, sound, or texture grounded in reality
- Share core factual details, spotlighting the theme if possible
- Offer authentic local color or trivia only when verified
- Explain why locals care or how it fits daily life today
- Give one insider tip or next-step suggestion for visitors

Detail guidance
- If this place has strong, verifiable facts, share several specific details that teach the listener something new. Prefer concrete names, dates, design features, cultural context, or cause and effect. Vary angles to avoid repetition.
- Do not force a specific count of facts. Let available evidence determine depth.
- If little is documented or the place is ordinary, say so briefly with a line like "Not much is documented about this spot, but…" then share only what is truly known or what locals notice day to day.
- Never pad with filler to meet a length target.

Precedence rule
- If Detail guidance conflicts with pacing guidance, follow Detail guidance. It is acceptable to go shorter when little is known or slightly longer when genuine depth adds value. Keep the narrative tight and spoken-first either way.

Critical instructions
- ${unitSystem} for all measurements
- Speak directly to the listener using "you"
- Keep paragraphs short and varied for easy listening
- No lists, bullet points, or headings in the final output

Final reminder
Keep it conversational, fluid, and natural for listening. Use concrete, accurate details instead of flowery language.${isNonEnglish ? ` Remember: use only ${targetLanguage}.` : ''}`;
}
