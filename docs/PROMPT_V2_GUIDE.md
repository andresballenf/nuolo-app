# Attraction Info Prompt V2 Guide

## Overview

Attraction Info Prompt V2 is a complete refactor of the attraction narration system, delivering more natural, tour-guide-like content with flexible structure, better pacing, and enhanced quality controls.

## Architecture

### Modular Block System

The prompt generation is now based on composable helper functions, each responsible for a specific aspect of the narration:

1. **System Persona** - Establishes tour guide identity and responsibilities
2. **Context Injection** - Spatial hints and situational context
3. **Audience & Preferences** - Theme weighting and voice style guidance
4. **Narrative Orchestration** - Flexible beat structure
5. **Accuracy & Trust** - Fact-checking and myth-busting safeguards
6. **Critical Instructions** - Non-negotiable constraints

### Duration Guidance

Each audio length mode has specific word count targets based on 150 words per minute average speaking pace:

| Mode | Duration | Word Count | Use Case |
|------|----------|------------|----------|
| Short | 1.5–2.5 min | 225-375 words | Quick overview, limited info |
| Medium | 3.5–4.5 min | 525-675 words | Standard tour narration |
| Deep Dive | 5–8 min | 750-1,200 words | Comprehensive exploration |

### Theme Weighting

Preferences are translated into content weighting percentages:

| Theme | History | Architecture | Culture | Nature | Tips |
|-------|---------|--------------|---------|--------|------|
| History | 50% | 20% | 15% | 5% | 10% |
| Nature | 10% | 5% | 15% | 60% | 10% |
| Architecture | 20% | 50% | 10% | 5% | 15% |
| Culture | 15% | 10% | 55% | 10% | 10% |
| General | 25% | 20% | 25% | 15% | 15% |

### Voice Style Pacing

Each voice style has specific pacing guidance:

| Style | Tone | Average Sentence Length |
|-------|------|-------------------------|
| Casual | Friendly, conversational | 12-18 words |
| Formal | Museum curator, precise | 15-22 words |
| Energetic | Dynamic, enthusiastic | 10-16 words |
| Calm | Soothing, contemplative | 14-20 words |

## New Features

### 1. Situational Context Support

Optional contextual enrichment for richer narration:

```typescript
situationalContext?: {
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  crowdLevel?: 'quiet' | 'moderate' | 'busy';
  recentEvents?: string;
}
```

**Example:**
```typescript
situationalContext: {
  season: 'spring',
  timeOfDay: 'afternoon',
  crowdLevel: 'moderate',
  recentEvents: 'Cherry blossoms are in bloom'
}
```

### 2. Flexible Narrative Beats

Replaces rigid checklist with organic 3-5 beat structure:

- **Opening beat**: Situational awareness, what to notice first
- **Core beats**: History, human stories, sensory cues, insider tips, modern relevance
- **Transitions**: Natural callbacks and segues
- **Closing beat**: Forward-looking suggestions

### 3. Deep-Dive Enhancements

For `audioLength: 'deep-dive'`:

- Extended 5-part arc: intro → origin → pivotal era → modern relevance → pro tips
- 2-3 mini-scenes or character spotlights
- Varied paragraph lengths for breathing room
- Transitional phrases for natural pauses
- Target 750-1,200 words (5-8 minutes spoken)

### 4. Accuracy Safeguards

Built-in quality controls:

- **Uncertainty handling**: Explicit acknowledgment of unverified facts
- **Myth-busting**: Gentle correction of common misconceptions
- **Source citation**: Implicit references ("park rangers confirm...", "city records from 1847...")
- **Measurement handling**: Consistent units with conversions when helpful

## Usage Examples

### Basic Usage (Medium Mode)

```typescript
import { generatePrompt } from './promptGenerator';

const prompt = generatePrompt(
  'Central Park Bethesda Fountain',
  'Central Park, New York, NY 10024',
  { lat: 40.7739, lng: -73.9716 },
  {
    language: 'en',
    audioLength: 'medium',
    theme: 'culture',
    voiceStyle: 'casual'
  }
);
```

### Deep-Dive with Situational Context

```typescript
const deepDivePrompt = generatePrompt(
  'Bethesda Fountain',
  'Central Park, New York, NY 10024',
  { lat: 40.7739, lng: -73.9716 },
  {
    language: 'en',
    audioLength: 'deep-dive',
    theme: 'culture',
    voiceStyle: 'formal'
  },
  { lat: 40.7739, lng: -73.9716 }, // POI location
  { cardinal8: 'north', distanceText: '200m' }, // Spatial hints
  {
    season: 'spring',
    timeOfDay: 'afternoon',
    crowdLevel: 'moderate',
    recentEvents: 'Cherry blossoms in bloom'
  }
);
```

### Multilingual Deep-Dive

```typescript
const spanishDeepDive = generatePrompt(
  'Museo del Prado',
  'Calle de Ruiz de Alarcón, 23, 28014 Madrid, Spain',
  { lat: 40.4138, lng: -3.6921 },
  {
    language: 'es',
    audioLength: 'deep-dive',
    theme: 'culture',
    voiceStyle: 'formal'
  },
  null,
  { cardinal8: 'norte', distanceText: '200m' },
  {
    season: 'summer',
    timeOfDay: 'morning',
    crowdLevel: 'busy'
  }
);
```

## Key Improvements Over V1

✅ **Natural tour guide persona** with lived experience and personality
✅ **Flexible narrative structure** replacing rigid bullet-point checklist
✅ **Deep-dive mode** consistently hitting 5-8 minute target (750-1,200 words)
✅ **Better local color** through micro-anecdotes and insider tips
✅ **Accuracy safeguards** for uncertainty handling and myth-busting
✅ **Duration guidance** aligned with detail expectations
✅ **Situational context** support for seasonal/temporal enrichment
✅ **Theme weighting** with concrete percentage allocations
✅ **Voice style pacing** with specific sentence length guidance

## Testing

Run validation tests:

```bash
# Simple prompt validation
node scripts/test-prompt-v2.js

# Full E2E orientation tests (requires geo utils)
npx ts-node scripts/mock-e2e-orientation.ts
```

## Migration Notes

### For Developers

- **No breaking changes**: Existing code continues to work
- **Optional features**: `situationalContext` is completely optional
- **Backward compatible**: All existing preferences are supported
- **Type-safe**: Full TypeScript support with proper types

### For Content

- Prompts are now more structured but flexible
- Deep-dive outputs should be longer and more engaging
- Myth-busting and uncertainty handling are now automatic
- Multilingual quality should be improved across all modes

## Future Enhancements

### Phase 2 (Optional)

1. **Factual reference tags**: Metadata field for citation surfacing
2. **Streaming partial outlines**: For deep-dive mode coherence
3. **Dynamic theme blending**: AI-driven weighting based on available content
4. **Voice sample integration**: Match narration to actual voice characteristics

## Troubleshooting

### Prompts feel too short
- Check `audioLength` preference - ensure deep-dive is selected for longer content
- Verify attraction has sufficient documented information
- Remember: authenticity > length - short is acceptable when info is limited

### Multilingual quality issues
- Verify language code is in supported list (en, es, fr, de, it, pt, ru, ja, ko, zh)
- Check that language-specific instructions are included in system persona
- Test with different AI providers (Gemini vs OpenAI)

### Missing situational context
- Ensure `situationalContext` is passed through provider call chain
- Check that context is properly formatted with typed values
- Verify context isn't being stripped by sanitization

## Support

For issues or questions:
1. Check `docs/ATTRACTION_PROMPT_V2_PLAN.md` for architectural details
2. Review test files: `scripts/test-prompt-v2.js` and `scripts/mock-e2e-orientation.ts`
3. Examine implementation: `supabase/functions/attraction-info/promptGenerator.ts`

---

**Version**: 2.0.0
**Last Updated**: 2025-10-20
**Status**: Production Ready
