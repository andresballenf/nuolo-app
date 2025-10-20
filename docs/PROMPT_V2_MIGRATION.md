# Attraction Prompt V2 - Migration Guide

## Overview

Attraction Prompt V2 is **100% backward compatible**. No changes are required to existing code, but new features are available when you're ready.

## ✅ No Breaking Changes

Your existing code will continue to work exactly as before:

```typescript
// This still works! No changes needed.
const result = await provider.generateContent({
  attractionName: 'Central Park',
  attractionAddress: 'Central Park, New York, NY 10024',
  userLocation: { lat: 40.7739, lng: -73.9716 },
  preferences: {
    language: 'en',
    audioLength: 'medium',
    theme: 'culture',
    voiceStyle: 'casual'
  }
});
```

## 🆕 New Features (Optional)

### 1. Situational Context Enrichment

Add seasonal and temporal context for richer narration:

```typescript
const result = await provider.generateContent({
  attractionName: 'Central Park Bethesda Fountain',
  attractionAddress: 'Central Park, New York, NY 10024',
  userLocation: { lat: 40.7739, lng: -73.9716 },
  preferences: {
    language: 'en',
    audioLength: 'deep-dive',
    theme: 'culture',
    voiceStyle: 'formal'
  },
  // NEW: Optional situational context (auto-derived by edge function)
  // You can optionally override these values
  situationalContext: {
    season: 'spring',          // Auto-derived from coordinates + date
    timeOfDay: 'afternoon',    // Auto-derived from timezone
    // crowdLevel: 'moderate', // NOT YET IMPLEMENTED (placeholder)
    recentEvents: 'Cherry blossoms are in bloom'  // Auto-derived from holidays API
  }
});
```

**Supported Context Fields:**
- `season`: 'spring' | 'summer' | 'fall' | 'winter' (auto-derived)
- `timeOfDay`: 'morning' | 'afternoon' | 'evening' | 'night' (auto-derived)
- ~~`crowdLevel`: 'quiet' | 'moderate' | 'busy'~~ (NOT IMPLEMENTED - placeholder for future)
- `recentEvents`: string (e.g., "Festival this weekend") (auto-derived from holidays API)

### 2. Improved Deep-Dive Mode

Deep-dive narrations are now optimized for 5-8 minutes (750-1,200 words) with:
- Extended 5-part narrative arc
- 2-3 mini-scenes or character spotlights
- Natural transitions and breathing room
- More engaging storytelling

```typescript
// Already works, but now produces richer output!
preferences: {
  audioLength: 'deep-dive',
  // ... other preferences
}
```

## 📈 What Changed Under the Hood

### Prompt Architecture

**Before (V1):**
- Monolithic prompt with rigid bullet-point structure
- Fixed sequencing of narrative elements
- Basic duration guidance

**After (V2):**
- Modular block architecture
- Flexible narrative beats
- Theme weighting percentages
- Voice style pacing guidance
- Accuracy safeguards

### Duration Targets

| Mode | V1 Target | V2 Target | V2 Word Count |
|------|-----------|-----------|---------------|
| Short | ~2 min | 1.5–2.5 min | 225-375 words |
| Medium | ~4 min | 3.5–4.5 min | 525-675 words |
| Deep Dive | ~7 min | 5–8 min | 750-1,200 words |

### Theme Handling

**Before:** Vague emphasis on theme
**After:** Precise weighting percentages

Example for `theme: 'history'`:
- History: 50%
- Architecture: 20%
- Culture: 15%
- Nature: 5%
- Tips: 10%

## 🎯 Recommended Upgrades

### Priority 1: Enable Deep-Dive for Key Attractions

For marquee attractions with rich content:

```typescript
preferences: {
  audioLength: 'deep-dive', // Up from 'medium'
  theme: 'history',
  voiceStyle: 'formal'
}
```

### Priority 2: Add Situational Context

If you track user context (time, season, etc.):

```typescript
const currentSeason = getCurrentSeason(); // Your function
const currentTime = getTimeOfDay(); // Your function

const result = await provider.generateContent({
  // ... existing params
  situationalContext: {
    season: currentSeason,
    timeOfDay: currentTime,
    crowdLevel: 'moderate', // Based on real-time data
  }
});
```

### Priority 3: Optimize Voice Styles

Match voice style to attraction type:

```typescript
// Museum, historical site
voiceStyle: 'formal'

// Park, casual attraction
voiceStyle: 'casual'

// Adventure activity
voiceStyle: 'energetic'

// Temple, meditation space
voiceStyle: 'calm'
```

## 🧪 Testing Your Migration

### Step 1: Validate Existing Functionality

Run your existing tests - they should all pass unchanged.

### Step 2: Test New Features (Optional)

If adding situational context:

```typescript
// Test with various contexts
const testContexts = [
  { season: 'spring', timeOfDay: 'morning' },
  { season: 'winter', crowdLevel: 'quiet' },
  { recentEvents: 'Cherry blossoms blooming' }
];

for (const context of testContexts) {
  const result = await provider.generateContent({
    // ... params
    situationalContext: context
  });
  console.log('Generated with context:', context);
}
```

### Step 3: Compare Outputs

Generate samples with V2 and compare quality:

```typescript
// V1 style (still works)
const v1Result = await provider.generateContent({
  attractionName: 'Test Attraction',
  preferences: { audioLength: 'medium', theme: 'history' }
});

// V2 enhanced
const v2Result = await provider.generateContent({
  attractionName: 'Test Attraction',
  preferences: { audioLength: 'deep-dive', theme: 'history' },
  situationalContext: { season: 'spring', timeOfDay: 'afternoon' }
});

// Compare word counts, structure, engagement
console.log('V1 words:', v1Result.content.split(' ').length);
console.log('V2 words:', v2Result.content.split(' ').length);
```

## 📚 Resources

- **Full Guide**: `docs/PROMPT_V2_GUIDE.md`
- **Implementation Details**: `docs/ATTRACTION_PROMPT_V2_IMPLEMENTATION.md`
- **Original Plan**: `docs/ATTRACTION_PROMPT_V2_PLAN.md`
- **Test Examples**: `scripts/test-prompt-v2.js`

## ❓ FAQ

### Q: Do I need to update my code?
**A:** No! V2 is 100% backward compatible.

### Q: Should I use situational context?
**A:** It's optional but recommended if you have the data. Adds richness without breaking changes.

### Q: Will my existing narrations change?
**A:** Quality may improve slightly due to better prompt structure, but basic behavior is preserved.

### Q: Is deep-dive mode better now?
**A:** Yes! Consistently produces 750-1,200 words (5-8 minutes) with more engaging structure.

### Q: Do I need to change AI providers?
**A:** No. V2 works with both OpenAI and Gemini providers seamlessly.

### Q: Can I mix V1 and V2 features?
**A:** Yes! Use situational context on some requests and not others. It's completely flexible.

### Q: What about multilingual support?
**A:** All 10 supported languages work the same. Quality improvements apply across all languages.

## 🚀 Quick Start Checklist

- [ ] Review this migration guide
- [ ] Read `PROMPT_V2_GUIDE.md` for detailed features
- [ ] Run existing tests to confirm backward compatibility
- [ ] (Optional) Add situational context to key attractions
- [ ] (Optional) Upgrade important attractions to deep-dive mode
- [ ] (Optional) Test multilingual outputs with new structure
- [ ] Share feedback with the team!

---

**Need Help?** Check the documentation or ask the team. V2 is designed to be easy to adopt at your own pace.
