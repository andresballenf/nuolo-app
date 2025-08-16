// Test Spanish audio generation with exact parameters from the app
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function testSpanishAudio() {
  console.log('🔍 Testing Spanish Audio Generation...\n');
  
  try {
    // Use the exact parameters from your app logs
    const testRequest = {
      text: "Cuando llegas al majestuoso Puente de Brooklyn, estás ante una obra maestra de la ingeniería del siglo XIX. Esta estructura icónica conecta Manhattan con Brooklyn sobre el East River, combinando función y belleza en una sinfonía de cables de acero y torres góticas de piedra.",
      chunkIndex: 0,
      totalChunks: 1,
      voiceStyle: 'calm',  // This should map to 'shimmer' in the function
      language: 'es',
      speed: 1.0
    };

    console.log('Request parameters:');
    console.log('- Text length:', testRequest.text.length, 'characters');
    console.log('- Voice style:', testRequest.voiceStyle);
    console.log('- Language:', testRequest.language);
    console.log('- Chunk:', testRequest.chunkIndex + 1, '/', testRequest.totalChunks);
    console.log('');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-audio-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(testRequest)
    });

    console.log('Response Status:', response.status, response.statusText);
    
    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.log('Failed to parse JSON. Raw response:', responseText.substring(0, 500));
      return;
    }

    if (response.status === 200) {
      console.log('\n✅ Spanish audio generation successful!');
      if (data.audio) {
        console.log('Audio data received:', data.audio.length, 'characters');
        console.log('Character count:', data.characterCount);
        console.log('Chunk index:', data.chunkIndex);
      }
    } else {
      console.log('\n❌ Error generating Spanish audio:');
      console.log('Status:', response.status);
      if (data.error) {
        console.log('Error message:', data.error);
        
        // Check for specific issues
        if (data.error.includes('insufficient_quota')) {
          console.log('\n⚠️  OpenAI quota exceeded - add credits at platform.openai.com');
        } else if (data.error.includes('voice')) {
          console.log('\n⚠️  Voice mapping issue - check voice style mapping');
        }
      } else {
        console.log('Response data:', JSON.stringify(data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSpanishAudio();