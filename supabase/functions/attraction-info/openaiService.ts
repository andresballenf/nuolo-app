// @ts-nocheck
import { generatePrompt } from './promptGenerator.ts';

async function callChatModel(model, prompt, apiKey, language = 'en') {
  // Map language codes to full language names for the system prompt
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
  
  const targetLanguage = languageNames[language] || 'English';
  const languageInstruction = language && language !== 'en' 
    ? `IMPORTANT: You MUST respond ENTIRELY in ${targetLanguage}. Every word of your response must be in ${targetLanguage}, not English.` 
    : '';
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a local tour guide speaking live to visitors, not writing a book or article.

                    Respond in a clear, natural, conversational tone as if speaking aloud. Use contractions, short sentences, and varied pacing so it sounds like someone talking while walking with the listener.

                    Style constraints
                    - Use simple spoken language, not literary or flowery writing.
                    - Avoid travel blog or fiction book style.
                    - Limit adjectives and metaphors to what is necessary for clarity.
                    - Imagine you are talking live, not reading a prepared script.
                    - Never invent facts, myths, or stories. If little is known, say so plainly.
                    - Do not format as lists or headings in the final output.

                    Immersion rules
                    - Keep the feel spontaneous and conversational, as if walking together.
                    - Do not mention being an AI or that this is scripted.
                    - Use only the requested language. Adapt fluently without naming the language unless asked.`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
      max_tokens: 800
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'Unknown chat error';
    throw new Error(message);
  }
  return data.choices[0].message.content;
}

export async function generateAttractionInfo(attractionName, attractionAddress, userLocation, preferences, openAiApiKey) {
  const prompt = generatePrompt(attractionName, attractionAddress, userLocation, preferences);
  const language = preferences?.language || 'en';
  console.log(`Generating content in language: ${language}`);
  
  const fallbackModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ];
  let lastError = null;
  for (const model of fallbackModels) {
    try {
      console.log(`Attempting text generation with model: ${model} in language: ${language}`);
      const content = await callChatModel(model, prompt, openAiApiKey, language);
      return content;
    } catch (err) {
      lastError = err;
      console.error(`Model failed (${model}):`, err?.message || err);
      continue;
    }
  }
  throw new Error(lastError?.message || 'All chat models failed');
}

export async function generateAudio(audioOptions, openAiApiKey) {
  console.log('Audio generation options:', {
    model: audioOptions.model,
    voice: audioOptions.voice,
    textLength: audioOptions.input.length,
    speed: audioOptions.speed
  });

  async function callTts(modelToUse) {
    const opts = { ...audioOptions, model: modelToUse };
    const audioResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(opts)
    });
    if (!audioResponse.ok) {
      const errorText = await audioResponse.text();
      throw new Error(errorText);
    }
    return audioResponse.arrayBuffer();
  }

  try {
    const primary = await callTts(audioOptions.model || 'tts-1-hd');
    console.log('Received audio buffer (primary). Size:', primary.byteLength);
    return primary;
  } catch (primaryErr) {
    console.warn('Primary TTS failed, falling back to tts-1:', primaryErr?.message || primaryErr);
    const fallback = await callTts('tts-1');
    console.log('Received audio buffer (fallback). Size:', fallback.byteLength);
    return fallback;
  }
}
