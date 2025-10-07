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
