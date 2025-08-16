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
    ? '100-150 words (30-60 seconds of audio)'
    : preferences.audioLength === 'medium'
      ? '250-400 words (1-3 minutes of audio)'
      : '500-800 words (3-5 minutes of audio)';

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

  return `${languageInstruction}Create a ${wordCount} audio tour narrative for "${attractionName}" that sounds like a knowledgeable local guide with Wikipedia-level detail but delivered in an engaging, fun way.

**Voice & Tone Instructions:**
${voiceStyle}

**Content Focus - ${preferences.theme} theme:**
Prioritize ${themeFocus}.

**Required Structure (blend naturally, not as a list):**

1. **Opening Hook**: Paint a vivid scene of what visitors see/feel when they arrive. Make them excited to be there.

2. **Core Information**: Provide Wikipedia-level factual details about the ${preferences.theme === 'general' ? 'place' : preferences.theme} aspects. Include dates, names, specific facts, and verifiable information.

3. **Cultural Color** (if authentically available):
   - Include any real urban legends, myths, or local gossip about the place
   - Share quirky facts or lesser-known trivia that locals might know
   - Mention any pop culture connections (movies filmed here, famous visitors, etc.)
   - If none exist, don't force it - just skip this section

4. **The Human Touch**: 
   - Why do locals care about this place?
   - Any community stories or collective memories?
   - What role does it play in daily life?

5. **Practical Insider Tip**: One specific, useful tip for visiting (best time, where to stand for photos, hidden details to look for, etc.)

**Critical Instructions:**
- ${unitSystem} for all measurements
- If information is limited, be honest: "Not much is documented about this specific spot, but..." then share what IS known about the area
- Never invent facts, myths, or stories - only include what's real and verifiable
- Speak directly to the listener using "you" throughout
- Keep paragraphs short and varied for easy listening
- No lists, bullet points, or structured formatting in the output
- Make it sound natural, like a real person talking, not reading from a script${isNonEnglish ? `
- REMINDER: THE ENTIRE OUTPUT MUST BE IN ${targetLanguage.toUpperCase()}, NOT ENGLISH!` : ''}

**Context** (use naturally if relevant, don't state explicitly):
- Address: ${attractionAddress}
- User location: ${userLocation.lat}, ${userLocation.lng}

Remember: Be fun and engaging while maintaining factual accuracy. If the place is ordinary, find what makes it special to locals. If it's famous, share both well-known and surprising facts. Keep it real, keep it interesting.`;
}