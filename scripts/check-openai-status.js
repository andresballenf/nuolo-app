// Check OpenAI API status and quota
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function checkOpenAIStatus() {
  console.log('🔍 Checking OpenAI API Status via Supabase...\n');
  
  try {
    // Test with minimal text to save quota
    const testRequest = {
      text: "Test",
      chunkIndex: 0,
      totalChunks: 1,
      voiceStyle: 'alloy',
      language: 'en',
      speed: 1.0
    };

    console.log('Sending test request to generate-audio-chunk...');
    
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
      console.log('Raw response:', responseText);
      return;
    }

    if (response.status === 200) {
      console.log('\n✅ OpenAI API is working!');
      console.log('Audio generated successfully');
      if (data.audio) {
        console.log('Audio data length:', data.audio.length, 'characters');
      }
    } else if (response.status === 500 && data.error) {
      console.log('\n❌ OpenAI API Error:');
      
      if (data.error.includes('insufficient_quota')) {
        console.log('\n🔴 QUOTA EXCEEDED');
        console.log('Your OpenAI account has run out of credits.\n');
        console.log('To fix this:');
        console.log('1. Go to: https://platform.openai.com/account/billing');
        console.log('2. Add credits to your account ($5-10 for testing)');
        console.log('3. The audio will start working immediately\n');
        console.log('Cost estimate:');
        console.log('- Each audio generation: ~$0.015 per 1000 characters');
        console.log('- Your typical request (3000 chars): ~$0.045');
      } else if (data.error.includes('401') || data.error.includes('Unauthorized')) {
        console.log('\n🔴 INVALID API KEY');
        console.log('The OpenAI API key is invalid.\n');
        console.log('To fix this:');
        console.log('1. Get a valid key from: https://platform.openai.com/api-keys');
        console.log('2. Update in Supabase:');
        console.log('   npx supabase secrets set OPENAI_API_KEY=sk-...');
      } else if (data.error.includes('OPENAI_API_KEY')) {
        console.log('\n🔴 API KEY NOT SET');
        console.log('The OpenAI API key is not configured in Supabase.\n');
        console.log('To fix this:');
        console.log('1. Get your key from: https://platform.openai.com/api-keys');
        console.log('2. Set it in Supabase:');
        console.log('   npx supabase secrets set OPENAI_API_KEY=sk-...');
      } else {
        console.log('Error details:', data.error);
      }
    } else {
      console.log('\n⚠️  Unexpected response:');
      console.log(JSON.stringify(data, null, 2));
    }
    
    console.log('\n========================================');
    console.log('Diagnosis Complete');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('Failed to check status:', error.message);
  }
}

checkOpenAIStatus();