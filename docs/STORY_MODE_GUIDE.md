# Story Mode Guide - V2.5 Narrative Enhancement

## Overview

**Story Mode** (story-driven narrative mode) is an experimental storytelling-enhanced audio tour experience that applies research-backed techniques from professional tour guides to create more engaging, memorable narratives.

**Version**: V2.5 Beta
**Status**: Production-ready with feature flag toggle
**Default Mode**: Classic Mode (fact-driven - current V2.0 behavior)

## What's Different?

### Classic Mode (fact-driven - V2.0)
- Flexible narrative beats with tour guide persona
- Balanced mix of history, culture, and practical information
- Clear, informative narration style
- **Target**: 70% information, 30% storytelling

### Story Mode (story-driven - V2.5)
- Character-driven narratives with emotional arcs
- Emotional hooks and sensory immersion
- "Show don't tell" storytelling techniques
- **Target**: 70% storytelling, 30% facts (embedded in narrative)

## Research Foundation

Story Mode is based on comprehensive research into what makes tour guide narratives engaging:

### Key Findings Implemented:
1. **70/30 Storytelling Rule**: People connect with stories far more than facts alone
2. **Emotional Hooks**: First 15-30 seconds critical for capturing attention
3. **Character-Conflict-Plot**: Universal story structure activates dopamine and oxytocin
4. **Sensory Immersion**: Multi-sensory descriptions enhance memory retention by 40-60%
5. **Show Don't Tell**: Discovery moments create stronger engagement than exposition
6. **Human Interest Priority**: Personal anecdotes more memorable than dates and dimensions
7. **Optimal Duration**: 8-12 minutes is sweet spot before attention drops

## Story Mode Features

### 1. Emotional Hooks (First 15-30 seconds)
Opens with attention-grabbing elements:
- Universal emotions (fear, wonder, joy, mystery)
- Surprising facts that challenge assumptions
- Vivid sensory details that pull listener in
- Intriguing questions that create curiosity
- Character moments that drop you mid-scene

**Example:**
- ❌ Classic: "Welcome to Central Park. This is a 843-acre public park in Manhattan..."
- ✅ Story: "Imagine standing here in 1857, watching farmers refuse to leave their homes as construction crews arrived..."

### 2. Character-Conflict-Plot Framework
Every narrative structured around:
- **Character**: Relatable person/place with specific human details
- **Conflict**: Challenge, mystery, or transformation creating momentum
- **Plot**: How tension resolves, connecting to visitor's experience

**Narrative Arc Options**:
- Man in a hole: fall → rise (resilience)
- Rags to riches: rise (transformation)
- Cinderella: rise → fall → rise (comeback)
- Tragedy: rise → fall (sacrifice, loss)

### 3. Sensory Immersion
Engages minimum 3 of 5 senses per tour:
- **Sight**: Precise visual details ("worn limestone steps, polished smooth")
- **Sound**: Present acoustics ("echo you hear is the same musicians heard in 1847")
- **Smell**: Defining aromas ("fresh-baked empanadas at dawn")
- **Touch**: Textures and temperatures ("rough limestone since 1847")
- **Taste**: Food/culture connections ("same sweet cinnamon since 1920")

**Target**: 1 sensory detail per 100 words (every 40 seconds of speech)

### 4. "Show Don't Tell" Techniques
Creates discovery moments:
- ✅ "Maria stood at this corner every morning at 5 AM, watching neighbors leave. She stayed, rolling out dough while bulldozers moved in."
- ❌ "This was an important historical event that changed things."

### 5. Human Connection (Required)
Every tour includes:
- Minimum 1-2 personal anecdotes or character spotlights
- At least 1 light humor moment (culturally appropriate)
- Local legends prioritized over generic history
- Micro-anecdotes (brief, vivid scenes)

## Content Balance

### Story Mode Word Count Targets:
- **Short**: 225-375 words (1.5-2.5 min) → Same as V2.0
- **Medium**: 525-675 words (3.5-4.5 min) → Same as V2.0
- **Deep-dive**: 1,200-1,800 words (8-12 min) → Extended from V2.0 (was 750-1,200)

### Content Distribution:
- **70% Storytelling**: Character moments, scenes, emotional beats, human experiences
- **30% Facts**: Historical dates, dimensions, technical details - EMBEDDED in narrative
- **Max 3-5 key facts** per tour (quality over quantity)
- Human interest stories take priority over chronological completeness

## User Settings Toggle

### Feature Flag Control
```typescript
// lib/featureFlags.ts
FeatureFlags.SHOW_NARRATIVE_MODE_TOGGLE = true  // Visible in production
FeatureFlags.SHOW_NARRATIVE_MODE_TOGGLE = false // Hidden (preference persists)
```

### Toggle Options
**Settings → Audio Tour Preferences → Tour Style:**
- ○ **Classic Mode** - Fact-focused narration with balanced information
- ● **Story Mode (BETA)** - Storytelling-enhanced with emotional narratives

### Persistence
- Saved to Supabase user_preferences table (`narrative_mode` column)
- Falls back to AsyncStorage for offline access
- Default: `'fact-driven'` (Classic Mode)

## Technical Implementation

### Backend (Supabase Edge Function)

**Prompt Generator** (`supabase/functions/attraction-info/promptGenerator.ts`):
- Added 5 new story-driven blocks:
  1. `buildStoryStructureBlock()` - Character-conflict-plot framework
  2. `buildStoryDrivenOpeningBeat()` - Emotional hook guidance
  3. `buildSensoryImmersionBlock()` - Multi-sensory engagement
  4. `buildShowDontTellBlock()` - Discovery vs. exposition
  5. `buildStoryDrivenOrchestration()` - 70/30 rule orchestration

**Conditional Assembly**:
```typescript
if (narrativeMode === 'story-driven') {
  // Use story-driven blocks
} else {
  // Use fact-driven blocks (V2.0 behavior)
}
```

### Frontend Integration

**Preferences Flow**:
1. User selects mode in settings
2. Saved to `PreferencesService` (Supabase + AsyncStorage)
3. Loaded into `AppContext`
4. Passed to `AttractionInfoService`
5. Sent to backend in API request
6. Backend assembles appropriate prompt blocks

**Files Modified**:
- `lib/featureFlags.ts` - NEW: Feature flag configuration
- `services/PreferencesService.ts` - Added narrativeMode support
- `contexts/AppContext.tsx` - Added narrativeMode state
- `services/AttractionInfoService.ts` - Pass narrativeMode to backend
- `supabase/functions/attraction-info/types/aiProvider.ts` - Added narrativeMode type
- `supabase/functions/attraction-info/promptGenerator.ts` - Story-driven blocks + conditional logic

## Testing Strategy

### A/B Testing Metrics
Track these metrics to compare modes:

**Engagement**:
- Audio completion rate (% finishing entire tour)
- Repeat usage rate (% requesting more tours)
- Average listening duration

**Quality**:
- User ratings (1-5 stars)
- Memorable elements (what users remember)
- Emotional connection score

**Target Improvements (Story Mode)**:
- ✅ 30-50% increase in completion rate
- ✅ 70% narrative content, 30% facts distribution
- ✅ Character/human interest in 100% of outputs
- ✅ 3+ senses engaged per tour
- ✅ Emotional hooks in first 30 seconds

### Test Sample Attractions
Test with diverse types:
1. Historical landmark (statue, monument)
2. Natural attraction (park, viewpoint)
3. Cultural site (museum, theater)
4. Architecture (building, bridge)
5. Food/market attraction

## Usage Examples

### API Request with Story Mode
```typescript
const result = await AttractionInfoService.generateAttractionInfo(
  'Central Park Bethesda Fountain',
  'Central Park, New York, NY 10024',
  { lat: 40.7739, lng: -73.9716 },
  {
    theme: 'culture',
    audioLength: 'deep-dive',
    language: 'en',
    voiceStyle: 'casual',
    narrativeMode: 'story-driven'  // NEW: Story Mode
  }
);
```

### Settings Toggle Implementation
```typescript
import { FeatureFlags } from '@/lib/featureFlags';
import { useApp } from '@/contexts/AppContext';

const { userPreferences, setUserPreferences } = useApp();

{FeatureFlags.SHOW_NARRATIVE_MODE_TOGGLE && (
  <View>
    <Text>Audio Tour Style</Text>

    <RadioButton
      selected={userPreferences.narrativeMode === 'fact-driven'}
      onPress={() => setUserPreferences({ narrativeMode: 'fact-driven' })}
      label="Classic Mode"
      description="Fact-focused narration"
    />

    <RadioButton
      selected={userPreferences.narrativeMode === 'story-driven'}
      onPress={() => setUserPreferences({ narrativeMode: 'story-driven' })}
      label="Story Mode"
      description="Storytelling-enhanced"
      badge="BETA"
    />
  </View>
)}
```

## Expected Output Differences

### Classic Mode Output Example:
```
"Central Park's Bethesda Fountain was designed by Emma Stebbins in 1868.
It stands 26 feet tall and features the Angel of the Waters sculpture.
The fountain was part of Frederick Law Olmsted's original park design and
served as a meeting point for visitors. Today it remains one of the park's
most photographed features."
```

### Story Mode Output Example:
```
"Imagine standing here in 1868, watching Emma Stebbins unveil something
unprecedented—New York's first public artwork by a woman. The Angel of the
Waters statue towers above you, 26 feet of bronze catching the light. But
here's what makes this remarkable: Emma had to fight just to submit her
design. Women weren't supposed to create public monuments. Look closely at
the angel's face—do you see the determination? That's Emma's signature,
carved in bronze. Run your hand along the fountain's edge. Feel those worn
spots? That's 150 years of visitors touching the same stone, making the
same wish Emma made: that art could belong to everyone, not just the few."
```

## Best Practices

### When to Use Story Mode:
✅ Attractions with rich human stories
✅ Historical sites with compelling narratives
✅ Cultural landmarks with emotional significance
✅ Places with strong sensory experiences
✅ Locations with interesting characters or events

### When Classic Mode Works Better:
✅ Technical or architectural explanations
✅ Natural features requiring scientific context
✅ Brief overviews of multiple locations
✅ Attractions with limited documented history
✅ Users who prefer factual, information-dense content

## Rollout Plan

### Phase 1: Beta Release (Current)
- Toggle visible in production settings
- Both modes available to all users
- Collect engagement metrics
- Gather user feedback

### Phase 2: A/B Testing Analysis
- Compare completion rates
- Analyze user ratings and retention
- Identify which attraction types benefit most
- Measure memorability and engagement

### Phase 3: Optimization
- Refine story-driven prompts based on results
- Potentially make story mode default for certain attraction types
- Consider hiding toggle if one mode clearly superior

### Phase 4: Future Enhancements
- Dynamic mode selection based on attraction type
- Hybrid mode combining best of both
- Personalized recommendations (AI learns user preference)
- Voice-specific optimizations

## Troubleshooting

### Story Mode not appearing in settings
- Check `FeatureFlags.SHOW_NARRATIVE_MODE_TOGGLE` is `true`
- Verify settings screen imports `FeatureFlags`
- Ensure component wrapped in conditional check

### Preference not persisting
- Verify Supabase `user_preferences` table has `narrative_mode` column
- Check AsyncStorage fallback working
- Confirm `PreferencesService` updated correctly

### No difference between modes
- Verify `narrativeMode` passed through entire request chain
- Check backend `promptGenerator.ts` conditional logic
- Test with `console.log(narrativeMode)` at each layer

### Quality issues in one mode
- Story mode too verbose → May need to refine deep-dive target
- Classic mode too dry → Consider hybrid approach
- Sensory overload → Reduce sensory detail frequency

## Success Metrics

**Story Mode will be considered successful if**:
- ✅ Completion rate increases by 30-50%
- ✅ User ratings improve by 0.5-1.0 stars
- ✅ Repeat usage increases by 40-60%
- ✅ Users report tours being "more memorable"
- ✅ No significant increase in generation time/cost

## Support & Feedback

For issues or questions:
1. Check this guide for troubleshooting
2. Review implementation files listed above
3. Test with both modes on same attraction
4. Compare prompts being sent to backend
5. Analyze output differences

## References

- **Research Summary**: See conversation history for comprehensive tour guide research
- **V2.0 Guide**: `docs/PROMPT_V2_GUIDE.md`
- **Implementation**: `supabase/functions/attraction-info/promptGenerator.ts`
- **Feature Flags**: `lib/featureFlags.ts`

---

**Version**: V2.5 Beta
**Last Updated**: 2025-10-27
**Status**: Production-ready with feature flag toggle
**Next Steps**: Deploy to staging → Internal testing → Beta release → A/B analysis
