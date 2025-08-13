// @ts-nocheck
import { generatePrompt } from './promptGenerator.ts';

async function callChatModel(model, prompt, apiKey) {
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
          content: 'You are an experienced, friendly local tour guide. Speak naturally, as if you are walking with the visitor. Use vivid, sensory details and clear, concise sentences. Avoid robotic phrasing, lists, or disclaimers. Be helpful, accurate, and engaging.'
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
  const fallbackModels = [
    'chatgpt-5',
    'gpt-4o',
    'gpt-4.1',
    'gpt-4o-mini',
    'gpt-4.1-mini'
  ];
  let lastError = null;
  for (const model of fallbackModels) {
    try {
      console.log(`Attempting text generation with model: ${model}`);
      const content = await callChatModel(model, prompt, openAiApiKey);
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
