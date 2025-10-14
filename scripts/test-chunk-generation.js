// Test script to verify chunk generation works
// Load environment variables first
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function testChunkGeneration() {
  try {
    const request = {
      text: "This is a test message for the audio generation system.",
      chunkIndex: 0,
      totalChunks: 1,
      voiceStyle: 'casual',
      language: 'en',
      speed: 1.0
    };

    console.log('Testing chunk generation with:', request);
    console.log('Supabase URL:', SUPABASE_URL);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-audio-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(request)
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', {
      hasAudio: !!data.audio,
      audioLength: data.audio ? data.audio.length : 0,
      error: data.error,
      chunkIndex: data.chunkIndex
    });

    if (data.error) {
      console.error('Error from function:', data.error);
    } else if (data.audio) {
      console.log('Success! Audio chunk generated');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testChunkGeneration();