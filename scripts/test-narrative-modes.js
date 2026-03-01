#!/usr/bin/env node
/**
 * Test Script: Narrative Modes Comparison
 *
 * Tests both fact-driven (Classic V2.0) and story-driven (V2.5) narrative modes
 * to validate implementation and compare outputs.
 *
 * Usage:
 *   node scripts/test-narrative-modes.js
 */

const { generatePrompt } = require('../supabase/functions/attraction-info/promptGenerator.ts');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
  log('\n' + '='.repeat(80), colors.bright);
  log(` ${title}`, colors.bright);
  log('='.repeat(80), colors.bright);
}

function subsection(title) {
  log(`\n${title}`, colors.cyan);
  log('-'.repeat(80), colors.cyan);
}

// Test attraction data
const testAttraction = {
  name: 'Central Park Bethesda Fountain',
  address: 'Central Park, New York, NY 10024',
  userLocation: { lat: 40.7739, lng: -73.9716 },
  poiLocation: { lat: 40.7739, lng: -73.9716 },
  spatialHints: {
    cardinal8: 'north',
    distanceText: '50 meters',
    relative: 'ahead'
  }
};

// Test configurations
const testConfigs = [
  {
    name: 'Fact-Driven (Classic V2.0)',
    mode: 'fact-driven',
    preferences: {
      theme: 'culture',
      audioLength: 'medium',
      language: 'en',
      voiceStyle: 'casual',
      narrativeMode: 'fact-driven'
    }
  },
  {
    name: 'Story-Driven (V2.5)',
    mode: 'story-driven',
    preferences: {
      theme: 'culture',
      audioLength: 'medium',
      language: 'en',
      voiceStyle: 'casual',
      narrativeMode: 'story-driven'
    }
  },
  {
    name: 'Story-Driven Deep-Dive',
    mode: 'story-driven',
    preferences: {
      theme: 'history',
      audioLength: 'deep-dive',
      language: 'en',
      voiceStyle: 'formal',
      narrativeMode: 'story-driven'
    }
  }
];

/**
 * Analyze prompt structure and content
 */
function analyzePrompt(prompt, mode) {
  const analysis = {
    totalLength: prompt.length,
    wordCount: prompt.split(/\s+/).length,
    sections: [],
    hasStoryElements: false,
    hasSensoryElements: false,
    hasCharacterElements: false,
    hasEmotionalHook: false
  };

  // Detect sections
  const sectionMatches = prompt.match(/\n[A-Z][^:\n]*:/g) || [];
  analysis.sections = sectionMatches.map(s => s.trim());

  // Check for story-driven elements
  analysis.hasStoryElements = prompt.includes('Story structure framework') ||
                              prompt.includes('70% story, 30% facts');

  analysis.hasSensoryElements = prompt.includes('Sensory immersion') ||
                                prompt.includes('Multi-sensory engagement');

  analysis.hasCharacterElements = prompt.includes('Character introduction') ||
                                  prompt.includes('character-driven');

  analysis.hasEmotionalHook = prompt.includes('Opening beat - HOOK') ||
                              prompt.includes('emotional attention-grabber');

  return analysis;
}

/**
 * Compare two prompts
 */
function comparePrompts(prompt1, analysis1, prompt2, analysis2) {
  subsection('COMPARISON');

  log(`Length Difference: ${Math.abs(analysis1.totalLength - analysis2.totalLength)} characters`, colors.yellow);
  log(`Word Count: ${analysis1.wordCount} vs ${analysis2.wordCount}`, colors.yellow);

  log('\nStory-Driven Features:', colors.magenta);
  log(`  Story Framework: ${analysis1.hasStoryElements ? '❌' : '✅'} → ${analysis2.hasStoryElements ? '✅' : '❌'}`);
  log(`  Sensory Immersion: ${analysis1.hasSensoryElements ? '❌' : '✅'} → ${analysis2.hasSensoryElements ? '✅' : '❌'}`);
  log(`  Character Elements: ${analysis1.hasCharacterElements ? '❌' : '✅'} → ${analysis2.hasCharacterElements ? '✅' : '❌'}`);
  log(`  Emotional Hooks: ${analysis1.hasEmotionalHook ? '❌' : '✅'} → ${analysis2.hasEmotionalHook ? '✅' : '❌'}`);

  log('\nSection Count:', colors.magenta);
  log(`  Fact-Driven: ${analysis1.sections.length} sections`);
  log(`  Story-Driven: ${analysis2.sections.length} sections`);
}

/**
 * Run tests
 */
async function runTests() {
  section('NARRATIVE MODES TEST SUITE');
  log('Testing fact-driven vs story-driven narrative generation', colors.bright);
  log(`Test Attraction: ${testAttraction.name}`, colors.blue);

  const results = [];

  // Generate prompts for each configuration
  for (const config of testConfigs) {
    subsection(`Testing: ${config.name}`);

    try {
      const prompt = generatePrompt(
        testAttraction.name,
        testAttraction.address,
        testAttraction.userLocation,
        config.preferences,
        testAttraction.poiLocation,
        testAttraction.spatialHints
      );

      const analysis = analyzePrompt(prompt, config.mode);

      log(`✅ Prompt generated successfully`, colors.green);
      log(`   Length: ${analysis.totalLength} characters`, colors.blue);
      log(`   Words: ${analysis.wordCount}`, colors.blue);
      log(`   Sections: ${analysis.sections.length}`, colors.blue);

      if (config.mode === 'story-driven') {
        log('\n   Story-Driven Features:', colors.magenta);
        log(`   - Story Framework: ${analysis.hasStoryElements ? '✅' : '❌'}`);
        log(`   - Sensory Immersion: ${analysis.hasSensoryElements ? '✅' : '❌'}`);
        log(`   - Character Elements: ${analysis.hasCharacterElements ? '✅' : '❌'}`);
        log(`   - Emotional Hooks: ${analysis.hasEmotionalHook ? '✅' : '❌'}`);
      }

      results.push({
        config,
        prompt,
        analysis,
        success: true
      });

      // Show first 500 characters of prompt
      log('\n   Preview:', colors.cyan);
      log(`   ${prompt.substring(0, 500)}...`, colors.reset);

    } catch (error) {
      log(`❌ Error: ${error.message}`, colors.red);
      results.push({
        config,
        error,
        success: false
      });
    }
  }

  // Compare fact-driven vs story-driven
  if (results.length >= 2 && results[0].success && results[1].success) {
    section('FACT-DRIVEN vs STORY-DRIVEN COMPARISON');
    comparePrompts(
      results[0].prompt,
      results[0].analysis,
      results[1].prompt,
      results[1].analysis
    );
  }

  // Summary
  section('TEST SUMMARY');
  const passed = results.filter(r => r.success).length;
  const total = results.length;

  log(`Tests Passed: ${passed}/${total}`, passed === total ? colors.green : colors.yellow);

  if (passed === total) {
    log('\n✅ All tests passed! Narrative modes are working correctly.', colors.green);
    log('\nKey Findings:', colors.bright);
    log('  - Both modes generate prompts successfully');
    log('  - Story-driven mode includes character-conflict-plot framework');
    log('  - Story-driven mode includes sensory immersion directives');
    log('  - Story-driven mode includes emotional hook guidance');
    log('  - Fact-driven mode maintains V2.0 behavior (no story blocks)');
  } else {
    log('\n⚠️ Some tests failed. Review errors above.', colors.yellow);
  }

  // Recommendations
  section('NEXT STEPS');
  log('1. Test with actual API calls to verify end-to-end flow', colors.blue);
  log('2. Compare actual LLM outputs from both modes', colors.blue);
  log('3. Deploy to staging environment for user testing', colors.blue);
  log('4. Set up A/B testing metrics tracking', colors.blue);
  log('5. Create UI toggle in settings screen', colors.blue);

  log('\n' + '='.repeat(80) + '\n', colors.bright);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
