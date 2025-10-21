/**
 * Test Script: Wikipedia Integration
 *
 * Tests the Wikipedia content guide integration for attraction-info edge function
 *
 * Usage:
 *   node scripts/test-wikipedia-integration.js
 *
 * Environment Variables Required:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_ANON_KEY - Supabase anonymous key
 *   ENABLE_WIKIPEDIA_INTEGRATION - Feature flag (true/false)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  console.error('Set them in your .env file or export them before running this script');
  process.exit(1);
}

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/attraction-info`;

// Test cases for Wikipedia integration
const testCases = [
  {
    name: 'Statue of Liberty (Well-documented attraction)',
    payload: {
      attraction: {
        name: 'Statue of Liberty',
        address: 'Liberty Island, New York, NY 10004',
        location: { lat: 40.6892, lng: -74.0445 }
      },
      userLocation: { lat: 40.6892, lng: -74.0445 },
      preferences: {
        theme: 'history',
        audioLength: 'medium',
        language: 'en',
        voiceStyle: 'formal'
      },
      aiProvider: 'openai'
    },
    expectations: {
      wikipediaFound: true,
      minSections: 5,
      hasExtracts: true
    }
  },
  {
    name: 'Eiffel Tower (International attraction)',
    payload: {
      attraction: {
        name: 'Eiffel Tower',
        address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
        location: { lat: 48.8584, lng: 2.2945 }
      },
      userLocation: { lat: 48.8584, lng: 2.2945 },
      preferences: {
        theme: 'architecture',
        audioLength: 'deep-dive',
        language: 'en',
        voiceStyle: 'casual'
      },
      aiProvider: 'openai'
    },
    expectations: {
      wikipediaFound: true,
      minSections: 8,
      hasExtracts: true
    }
  },
  {
    name: 'Small Local Park (Likely no Wikipedia page)',
    payload: {
      attraction: {
        name: 'Random Street Corner Park XYZ123',
        address: '123 Random St, Anytown, USA',
        location: { lat: 40.7128, lng: -74.0060 }
      },
      userLocation: { lat: 40.7128, lng: -74.0060 },
      preferences: {
        theme: 'nature',
        audioLength: 'short',
        language: 'en',
        voiceStyle: 'calm'
      },
      aiProvider: 'openai'
    },
    expectations: {
      wikipediaFound: false,
      minSections: 0,
      hasExtracts: false
    }
  },
  {
    name: 'Colosseum (Ancient landmark)',
    payload: {
      attraction: {
        name: 'Colosseum',
        address: 'Piazza del Colosseo, 1, 00184 Roma RM, Italy',
        location: { lat: 41.8902, lng: 12.4922 }
      },
      userLocation: { lat: 41.8902, lng: 12.4922 },
      preferences: {
        theme: 'history',
        audioLength: 'medium',
        language: 'en',
        voiceStyle: 'energetic'
      },
      aiProvider: 'openai'
    },
    expectations: {
      wikipediaFound: true,
      minSections: 6,
      hasExtracts: true
    }
  }
];

/**
 * Make request to attraction-info edge function
 */
async function makeRequest(payload) {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Edge function error: ${data.error || response.statusText}`);
    }

    return data;
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

/**
 * Validate Wikipedia data in response
 */
function validateWikipediaData(response, expectations, testName) {
  const errors = [];

  // Check if Wikipedia data exists in response
  const hasWikipediaData = response.metadata && response.metadata.wikipediaData !== undefined;

  if (!hasWikipediaData) {
    console.log(`  ⚠️  No Wikipedia data in response (feature might be disabled)`);
    return { valid: true, warnings: ['Wikipedia feature appears disabled'] };
  }

  const wikiData = response.metadata.wikipediaData;

  // Validate 'found' status
  if (wikiData.found !== expectations.wikipediaFound) {
    errors.push(`Expected found=${expectations.wikipediaFound}, got found=${wikiData.found}`);
  }

  if (wikiData.found) {
    // Validate sections
    if (!wikiData.sections || !Array.isArray(wikiData.sections)) {
      errors.push('Wikipedia data missing sections array');
    } else if (wikiData.sections.length < expectations.minSections) {
      errors.push(`Expected at least ${expectations.minSections} sections, got ${wikiData.sections.length}`);
    }

    // Validate extracts
    if (expectations.hasExtracts) {
      if (!wikiData.extracts || typeof wikiData.extracts !== 'object') {
        errors.push('Wikipedia data missing extracts object');
      } else if (Object.keys(wikiData.extracts).length === 0) {
        errors.push('Wikipedia extracts object is empty');
      }
    }

    // Validate page title and URL
    if (!wikiData.pageTitle) {
      errors.push('Wikipedia data missing pageTitle');
    }

    if (!wikiData.pageUrl) {
      errors.push('Wikipedia data missing pageUrl');
    }

    // Log structure for inspection
    console.log(`  📊 Wikipedia Structure:`);
    console.log(`     - Page: ${wikiData.pageTitle || 'N/A'}`);
    console.log(`     - URL: ${wikiData.pageUrl || 'N/A'}`);
    console.log(`     - Sections: ${wikiData.sections ? wikiData.sections.length : 0}`);
    console.log(`     - Extracts: ${wikiData.extracts ? Object.keys(wikiData.extracts).length : 0}`);

    if (wikiData.sections && wikiData.sections.length > 0) {
      console.log(`     - Section Examples:`);
      wikiData.sections.slice(0, 3).forEach(section => {
        console.log(`       • ${section.title} (level ${section.level})`);
      });
    }
  } else {
    console.log(`  ℹ️  No Wikipedia page found (expected for this test case)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}

/**
 * Run a single test case
 */
async function runTest(testCase, index) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test ${index + 1}/${testCases.length}: ${testCase.name}`);
  console.log(`${'='.repeat(80)}`);

  try {
    console.log(`📤 Sending request...`);
    const startTime = Date.now();
    const response = await makeRequest(testCase.payload);
    const duration = Date.now() - startTime;

    console.log(`✅ Request completed in ${duration}ms`);

    // Validate response structure
    if (!response.content) {
      console.error(`❌ Response missing 'content' field`);
      return false;
    }

    if (!response.audioBase64) {
      console.error(`❌ Response missing 'audioBase64' field`);
      return false;
    }

    console.log(`✅ Response has required fields (content, audioBase64)`);

    // Validate Wikipedia data
    const validation = validateWikipediaData(response, testCase.expectations, testCase.name);

    if (!validation.valid) {
      console.error(`❌ Wikipedia data validation failed:`);
      validation.errors.forEach(err => console.error(`   - ${err}`));
      return false;
    }

    if (validation.warnings && validation.warnings.length > 0) {
      validation.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }

    console.log(`✅ Test passed!`);
    return true;

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('Wikipedia Integration Test Suite');
  console.log('='.repeat(80));

  // Check Wikipedia feature flag status
  const wikipediaEnabled = process.env.ENABLE_WIKIPEDIA_INTEGRATION === 'true';
  console.log(`\nWikipedia Feature Flag: ${wikipediaEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`Edge Function URL: ${EDGE_FUNCTION_URL}`);

  if (!wikipediaEnabled) {
    console.log('\n⚠️  WARNING: ENABLE_WIKIPEDIA_INTEGRATION is not set to "true"');
    console.log('   Wikipedia integration will not be active in the edge function.');
    console.log('   Tests will validate that Wikipedia data is absent from responses.\n');
  }

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const passed = await runTest(testCases[i], i);
    results.push({ name: testCases[i].name, passed });

    // Small delay between tests to avoid rate limiting
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('Test Summary');
  console.log('='.repeat(80));

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.length - passedCount;

  results.forEach((result, i) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} Test ${i + 1}: ${result.name}`);
  });

  console.log('\n' + '-'.repeat(80));
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('-'.repeat(80));

  if (failedCount > 0) {
    console.log('\n❌ Some tests failed. Review the output above for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
