// Debug script to test the Supabase function with better error details
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function debugFunction() {
  try {
    const request = {
      text: "Esta es una prueba del sistema de audio.",
      chunkIndex: 0,
      totalChunks: 1,
      voiceStyle: 'calm',
      language: 'es',
      speed: 1.0
    };

    console.log('Testing function with request:', request);
    console.log('URL:', `${SUPABASE_URL}/functions/v1/generate-audio-chunk`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-audio-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(request)
    });

    console.log('\n=== Response Details ===');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('\n=== Response Body ===');
    
    try {
      const data = JSON.parse(responseText);
      console.log(JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.error('\n❌ Function returned error:', data.error);
        
        if (data.error.includes('OPENAI_API_KEY')) {
          console.log('\n🔑 OpenAI API key issue detected!');
          console.log('To fix this, run:');
          console.log('npx supabase secrets set OPENAI_API_KEY=your_openai_api_key');
        }
      } else if (data.audio) {
        console.log('\n✅ Success! Audio generated');
        console.log('Audio data length:', data.audio.length);
      }
    } catch (e) {
      console.log('Raw response:', responseText.substring(0, 500));
      
      if (responseText.includes('missing') || responseText.includes('OPENAI_API_KEY')) {
        console.log('\n🔑 OpenAI API key is missing!');
        console.log('To fix this:');
        console.log('1. Get your OpenAI API key from https://platform.openai.com/api-keys');
        console.log('2. Set it in Supabase:');
        console.log('   npx supabase secrets set OPENAI_API_KEY=sk-...');
        console.log('3. The function will automatically restart with the new key');
      }
    }
    
  } catch (error) {
    console.error('Request failed:', error);
  }
}

console.log('🔍 Debugging Supabase Function...\n');
debugFunction();