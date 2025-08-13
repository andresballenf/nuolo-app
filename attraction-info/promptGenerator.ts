export function generatePrompt(attractionName, attractionAddress, userLocation, preferences) {
  // Format the prompt based on user preferences
  const formatText = preferences.audioLength === 'short'
    ? 'about 100 words'
    : preferences.audioLength === 'medium'
      ? 'about 250 words'
      : 'roughly 500 words';

  const theme = preferences.theme || 'general history and culture';

  return `Guide a visitor through "${attractionName}" in a warm, conversational tone (${formatText}).

Speak like a real local guide walking beside them—natural, fluid, and vivid. Favor short paragraphs and varied sentence lengths. Avoid lists, disclaimers, filler, or repeating greetings.

Include:
- A welcoming, paint-the-scene opener that captures what makes it special.
- 1–3 engaging insights tied to ${theme} (historical or cultural), only if well-known.
- A fun, memorable detail or anecdote if it’s commonly mentioned; do not invent facts.
- Why this place matters from a ${theme} perspective.
- One practical insider tip to improve their visit.

Context you may use but should not state explicitly: address is ${attractionAddress}; user coordinates are (${userLocation.lat}, ${userLocation.lng}). Only mention location details if naturally relevant.

Write in the second person (“you”), avoid list formatting in the output, and keep it friendly, precise, and trustworthy.`;
}
