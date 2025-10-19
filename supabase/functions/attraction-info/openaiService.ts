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
          content: `You are a seasoned local guide leading a small group through the site right now.

                    Speak as though you are walking beside them: keep it conversational, use contractions, vary sentence length, and pause for emphasis when a point matters.

                    Instruction priority
                    - Identity resolution and factual accuracy come first
                    - Follow detail guidance depth before pacing targets
                    - Maintain clarity and spoken, listener-first delivery
                    - Treat word count as a soft guideline; never stretch thin facts

                    Voice and tone
                    - Sound personable and confident, like an expert who knows the place intimately
                    - Use precise sensory cues (what listeners can see, hear, touch, or notice around them)
                    - Orient the listener in space (what's ahead, to the left/right, where to stand)
                    - Ask occasional reflective questions to keep engagement, then answer them yourself
                    - Share concise, verifiable anecdotes or insider tips when they are true
                    - Avoid sounding like a travel blog or scripted essay
                    - Never invent facts, myths, or stories; acknowledge gaps plainly
                    - Do not format as lists or headings in the final output

                    Immersion rules
                    - Keep the vibe spontaneous, as if reacting to being onsite together
                    - Do not mention being an AI or that this is generated content
                    - Use only the requested language. Adapt naturally without naming the language unless asked.

                    Spatial privacy and orientation rules (EN)
                    - Never mention coordinates (latitude/longitude), GPS values, DMS formats, street numbers, street names, or exact postal addresses.
                    - Use only relative orientation from the listener's position: north/south/east/west, left/right, ahead/behind.
                    - You may reference well-known landmarks; avoid street names unless the landmark itself is the reference.
                    - If the user's location or heading is unavailable or low-accuracy, avoid specific directional references.
                    - Prefer approximate distances ("a few meters", "about 200 m") and avoid excessive precision.

                    Reglas de privacidad y orientación espacial (ES)
                    - No menciones coordenadas, latitud/longitud, formatos DMS, números de calle, nombres de calles ni direcciones postales exactas.
                    - Usa orientación relativa respecto a la posición del usuario: norte/sur/este/oeste, izquierda/derecha, delante/detrás.
                    - Puedes mencionar hitos/landmarks conocidos; evita nombres de calles salvo que el propio hito sea la referencia.
                    - Si la ubicación u orientación del usuario no está disponible o es imprecisa, evita referencias direccionales específicas.
                    - Prefiere distancias aproximadas (“a pocos metros”, “a unos 200 m”) y evita precisión excesiva.${languageInstruction ? `\n\n${languageInstruction}` : ''}`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.65,
      max_tokens: 1500
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'Unknown chat error';
    throw new Error(message);
  }
  return data.choices[0].message.content;
}

export async function generateAttractionInfo(attractionName, attractionAddress, userLocation, preferences, openAiApiKey, poiLocation?, spatialHints?) {
  const prompt = generatePrompt(attractionName, attractionAddress, userLocation, preferences, poiLocation, spatialHints);
  const language = preferences?.language || 'en';
  console.log(`Generating content in language: ${language}`);
  
  const fallbackModels = [
    'gpt-4.1-mini',
    'gpt-4o-mini',
    'gpt-4o',
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

  const models = [audioOptions.model || 'gpt-4o-mini-tts', 'gpt-4o-audio-preview', 'tts-1'];
  let lastError = null;

  for (const model of models) {
    try {
      const audioBuffer = await callTts(model);
      console.log(`Received audio buffer (${model}). Size:`, audioBuffer.byteLength);
      return audioBuffer;
    } catch (error) {
      lastError = error;
      console.warn(`TTS model failed (${model}), trying next fallback:`, error?.message || error);
    }
  }

  throw new Error(lastError?.message || 'All TTS models failed');
}
