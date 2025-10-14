// Diagnostic script to check if everything is set up correctly
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Checking Nuolo Audio System Setup...\n');

// Check environment variables
console.log('1. Environment Variables:');
console.log('   SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('   SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('\n❌ Missing environment variables in .env.local');
  console.log('Please ensure .env.local contains:');
  console.log('EXPO_PUBLIC_SUPABASE_URL=your_url');
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key');
  process.exit(1);
}

console.log('\n2. Testing Supabase Connection...');

// Test if Supabase is reachable
fetch(SUPABASE_URL)
  .then(response => {
    console.log('   Supabase reachable:', response.ok ? '✅ Yes' : '⚠️  Unexpected response');
  })
  .catch(error => {
    console.log('   Supabase reachable: ❌ No');
    console.error('   Error:', error.message);
  });

console.log('\n3. Checking Function Deployment...');

// Test the generate-audio-chunk function
async function testFunction() {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-audio-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        text: "Test",
        chunkIndex: 0,
        totalChunks: 1,
        voiceStyle: 'casual'
      })
    });

    if (response.status === 404) {
      console.log('   Function deployed: ❌ No');
      console.log('\n⚠️  The generate-audio-chunk function is not deployed!');
      console.log('   Run: npx supabase functions deploy generate-audio-chunk');
      return false;
    } else if (response.status === 200 || response.status === 201) {
      console.log('   Function deployed: ✅ Yes');
      const data = await response.json();
      if (data.audio) {
        console.log('   Function working: ✅ Yes');
      } else if (data.error) {
        console.log('   Function working: ⚠️  Has errors');
        console.log('   Error:', data.error);
      }
      return true;
    } else {
      console.log('   Function status:', response.status);
      const text = await response.text();
      console.log('   Response:', text.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.log('   Function check failed: ❌');
    console.error('   Error:', error.message);
    return false;
  }
}

// Check OpenAI API key in Supabase
console.log('\n4. Checking API Keys (in Supabase):');
console.log('   Make sure OPENAI_API_KEY is set in Supabase secrets');
console.log('   Run: npx supabase secrets set OPENAI_API_KEY=your_key');

testFunction().then(deployed => {
  console.log('\n========================================');
  if (deployed) {
    console.log('✅ System is ready for chunked audio!');
    console.log('\nYou can now:');
    console.log('1. Start the app: npx expo start');
    console.log('2. Select any attraction');
    console.log('3. Generate audio guides of any length!');
  } else {
    console.log('⚠️  System needs configuration');
    console.log('\nNext steps:');
    console.log('1. Deploy the function: npx supabase functions deploy generate-audio-chunk');
    console.log('2. Set OpenAI key: npx supabase secrets set OPENAI_API_KEY=your_key');
    console.log('3. Run this check again: node check-setup.js');
  }
  console.log('========================================\n');
});