export function generatePrompt(attractionName, attractionAddress, userLocation, preferences) {
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
  
  // Adjust word count based on audio length preference
  const wordCount = preferences.audioLength === 'short'
    ? '100-250 words (30-60 seconds of audio)'
    : preferences.audioLength === 'medium'
      ? '400-600 words (1-3 minutes of audio)'
      : '800-1000 words (3-5 minutes of audio)';

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
    'formal': 'Write in a professional, informative tone like a Wikipedia article but still engaging. Use clear, structured information.',
    'energetic': 'Write with enthusiasm and excitement! Use dynamic language, vivid descriptions, and convey genuine passion for the place.',
    'calm': 'Write in a soothing, contemplative tone. Use peaceful language, gentle pacing, and reflective observations.'
  };
  
  const voiceStyle = voiceInstructions[preferences.voiceStyle] || voiceInstructions['casual'];
  
  // Language-specific instructions - MOVED TO THE VERY TOP AND MADE MORE EMPHATIC
  const languageInstruction = isNonEnglish 
    ? `🚨🚨🚨 CRITICAL LANGUAGE REQUIREMENT 🚨🚨🚨
YOU MUST WRITE YOUR ENTIRE RESPONSE IN ${targetLanguage.toUpperCase()}!
DO NOT USE ENGLISH! USE ONLY ${targetLanguage.toUpperCase()}!

Every single word must be in ${targetLanguage}:
- All descriptions must be in ${targetLanguage}
- All facts must be in ${targetLanguage}
- All storytelling must be in ${targetLanguage}
- Use ${targetLanguage} grammar and sentence structure
- Use culturally appropriate expressions in ${targetLanguage}

THIS IS MANDATORY: THE ENTIRE OUTPUT MUST BE IN ${targetLanguage.toUpperCase()}, NOT ENGLISH!

` 
    : '';

  // Adjust units based on language/region
  const useMetric = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'].includes(preferences.language);
  const unitSystem = useMetric ? 'Use metric units (meters, kilometers)' : 'Use imperial units (feet, miles)';

  return `${languageInstruction}Create a ${wordCount} audio tour narrative for "${attractionName}".

Identity resolution
Use the full address and coordinates to ensure you describe the correct place:
- Address: ${attractionAddress}
- Coordinates: ${userLocation.lat}, ${userLocation.lng}

Voice and tone
${voiceStyle}

Theme guidance
Emphasize ${themeFocus} if verifiable details exist, but keep a balanced mix of history, culture, architecture, and practical details. Do not force the theme if information is lacking.

Narrative ingredients
Blend naturally (order can vary):
- A vivid opening moment
- Core factual details, spotlighting the theme if possible
- Authentic local color or trivia, only if true
- Why locals care or how it fits daily life
- One insider tip for visitors

Critical instructions
- ${unitSystem} for all measurements
- Speak directly to the listener using "you"
- Keep paragraphs short and varied for easy listening
- No lists, bullet points, or headings in the final output

Final reminder
Keep it conversational, fluid, and natural for listening, not decorated or literary.${isNonEnglish ? `

REMINDER: THE ENTIRE OUTPUT MUST BE IN ${targetLanguage.toUpperCase()}, NOT ENGLISH!` : ''}`;
}