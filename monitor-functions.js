// Monitor Supabase functions health
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function testFunction(name, endpoint, body) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(body),
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    const status = response.status;
    
    if (status === 200) {
      return { name, status: '✅ OK', responseTime: `${responseTime}ms`, error: null };
    } else {
      const text = await response.text();
      let error = text.substring(0, 100);
      try {
        const json = JSON.parse(text);
        error = json.error ? json.error.substring(0, 100) : 'Unknown error';
      } catch (e) {}
      return { name, status: `❌ ${status}`, responseTime: `${responseTime}ms`, error };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { 
      name, 
      status: '❌ Failed', 
      responseTime: `${responseTime}ms`, 
      error: error.message 
    };
  }
}

async function monitorFunctions() {
  console.log('🔍 Monitoring Supabase Functions Health\n');
  console.log('Time:', new Date().toLocaleString());
  console.log('========================================\n');
  
  const tests = [
    {
      name: 'generate-audio-chunk',
      endpoint: 'generate-audio-chunk',
      body: {
        text: 'Test',
        chunkIndex: 0,
        totalChunks: 1,
        voiceStyle: 'casual',
        language: 'en'
      }
    },
    {
      name: 'attraction-info (text)',
      endpoint: 'attraction-info',
      body: {
        attractionName: 'Test Location',
        attractionAddress: 'Test Address',
        userLocation: { lat: 40.7128, lng: -74.0060 },
        preferences: {
          theme: 'general',
          audioLength: 'short',
          voiceStyle: 'casual',
          language: 'en'
        },
        testMode: true
      }
    }
  ];
  
  console.log('Testing functions...\n');
  
  const results = await Promise.all(tests.map(test => 
    testFunction(test.name, test.endpoint, test.body)
  ));
  
  // Display results in a table
  console.log('Function                  | Status   | Response Time | Error');
  console.log('--------------------------|----------|---------------|-------');
  
  for (const result of results) {
    const name = result.name.padEnd(24);
    const status = result.status.padEnd(8);
    const time = result.responseTime.padEnd(13);
    const error = result.error ? result.error.substring(0, 40) : '';
    console.log(`${name} | ${status} | ${time} | ${error}`);
  }
  
  console.log('\n========================================');
  
  // Check overall health
  const allHealthy = results.every(r => r.status.includes('✅'));
  
  if (allHealthy) {
    console.log('✅ All functions are healthy!\n');
  } else {
    console.log('⚠️  Some functions are experiencing issues\n');
    console.log('Troubleshooting:');
    console.log('1. Check Supabase dashboard for function logs');
    console.log('2. Verify OpenAI API key is set and has credits');
    console.log('3. Check network connectivity');
    console.log('4. Try redeploying affected functions\n');
  }
}

// Run once
monitorFunctions();

// Optional: Run continuously
// setInterval(monitorFunctions, 30000); // Every 30 seconds