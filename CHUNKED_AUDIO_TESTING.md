# Chunked Audio System Testing Guide

## System Overview
The new chunked audio system bypasses OpenAI's 4096 character limit by splitting text into chunks and generating audio for each chunk separately. This allows for unlimited audio length while maintaining seamless playback.

## Quick Start

### 1. Deploy the Supabase Function
```bash
# Run the deployment script
./deploy-and-test-chunks.sh

# Or manually deploy
npx supabase functions deploy generate-audio-chunk
```

### 2. Verify Deployment
```bash
# Test the function directly
node test-chunk-generation.js
```

### 3. Test in the App
```bash
# Start the app
npx expo start

# Use iOS Simulator or Android Emulator
# Press 'i' for iOS or 'a' for Android
```

## Testing Scenarios

### Test 1: Short Text (< 3900 characters)
1. Select an attraction
2. Set audio length preference to "Short" in settings
3. Tap "Play Audio Guide"
4. **Expected**: Single chunk generation, immediate playback

### Test 2: Medium Text (3900-8000 characters)
1. Select an attraction
2. Set audio length preference to "Medium" in settings
3. Tap "Play Audio Guide"
4. **Expected**: 2-3 chunks generated, first chunk plays while others load

### Test 3: Long Text (> 8000 characters)
1. Select an attraction
2. Set audio length preference to "Long" in settings
3. Tap "Play Audio Guide"
4. **Expected**: Multiple chunks generated, seamless playback between chunks

### Test 4: Voice Style Mapping
Test each voice style to ensure proper mapping:
- **Casual** → alloy voice
- **Formal** → onyx voice
- **Energetic** → nova voice
- **Calm** → shimmer voice

### Test 5: Error Recovery
1. Turn off internet briefly during generation
2. **Expected**: Retry mechanism activates (up to 3 attempts per chunk)
3. First chunk gets 5 retry attempts for priority

### Test 6: Attraction Switching
1. Start generating audio for one attraction
2. Before it completes, select another attraction
3. **Expected**: Previous generation cancels, new one starts

## Console Monitoring

Watch for these key log messages:

### Successful Flow
```
Text generated: [X] characters
Splitting text into chunks...
Chunk statistics: { totalChunks: X, averageChunkSize: Y }
Generating first chunk with priority...
Chunk 1/X generated successfully
First chunk ready, starting playback
Generating 2 remaining chunks in parallel...
Chunk 2/X generated successfully
Chunk 3/X generated successfully
Audio generation complete: X/X chunks successful
```

### Feature Flag
The system uses a feature flag in `app/map.tsx`:
```typescript
const USE_APP_CHUNKED_AUDIO = true; // Set to false to use old method
```

## Architecture Components

### 1. TTSChunkService
- Splits text at natural boundaries (sentences, paragraphs)
- Maintains 3900 character limit per chunk
- Optimizes by merging small chunks

### 2. AudioGenerationService
- Orchestrates parallel chunk generation
- Manages retry logic and error handling
- Prioritizes first chunk for quick playback

### 3. AudioChunkManager
- Manages chunk queue and playback
- Handles seamless transitions between chunks
- Supports seeking across chunk boundaries

### 4. Supabase Function (generate-audio-chunk)
- Receives individual chunk requests
- Calls OpenAI TTS API with proper voice mapping
- Returns base64 encoded audio

## Troubleshooting

### "Function not deployed" Error
```bash
# Deploy the function
npx supabase functions deploy generate-audio-chunk

# Verify deployment
npx supabase functions list
```

### Audio Cuts Off
- Check if text is being truncated before chunking
- Verify chunk boundaries in console logs
- Ensure all chunks are generating successfully

### Long Generation Time
- Normal for first chunk: ~2-3 seconds
- Subsequent chunks generate in parallel
- Total time depends on text length and network speed

### Voice Doesn't Match Selection
- Verify voice mapping in generate-audio-chunk function
- Check preferences are being passed correctly

## Performance Metrics

Expected performance for different text lengths:

| Text Length | Chunks | First Audio | Total Time |
|------------|--------|-------------|------------|
| 2,000 chars | 1 | 2-3s | 2-3s |
| 5,000 chars | 2 | 2-3s | 4-5s |
| 10,000 chars | 3 | 2-3s | 6-8s |
| 20,000 chars | 6 | 2-3s | 10-15s |

## Advanced Testing

### Memory Monitoring
The system caches chunks in memory during the session:
- Each chunk is ~50-200KB (depending on duration)
- Chunks are cleared when switching attractions
- Monitor memory usage in development tools

### Network Optimization
- Uses up to 3 concurrent requests for chunk generation
- Implements exponential backoff for retries
- First chunk always gets priority

### Edge Cases
1. **Empty text**: Should handle gracefully with no audio
2. **Exactly 3900 chars**: Should create single chunk
3. **Network interruption**: Should retry and recover
4. **App backgrounding**: Audio should continue playing

## Success Criteria

✅ The system successfully generates audio for text of any length
✅ First chunk plays within 3 seconds of request
✅ Transitions between chunks are seamless
✅ Voice styles map correctly to OpenAI voices
✅ Error handling provides clear user feedback
✅ Memory usage remains reasonable
✅ System falls back to old method if needed

## Rolling Back

If issues arise, you can disable the new system:

1. Edit `app/map.tsx`
2. Set `USE_APP_CHUNKED_AUDIO = false`
3. The app will use the old single-chunk method (limited to 4096 chars)