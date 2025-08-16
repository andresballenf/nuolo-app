# Timeout Fixes Applied

## Issue
The `attraction-info` edge function was timing out when generating deep-dive content in Spanish, causing the error:
```
Failed to send a request to the Edge Function
Request timeout: The server took too long to respond
```

## Fixes Applied

### 1. ✅ Increased Timeout for Deep-Dive Content
- **Before**: 30 seconds for all requests
- **After**: 60 seconds for deep-dive, 30 seconds for others
- Deep-dive content with Spanish + architecture theme needs more processing time

### 2. ✅ Added Automatic Retry Logic
- Now retries up to 2 times on timeout
- Waits 2 seconds between retries
- Gives the server 3 chances to respond

### 3. ✅ Better Error Messages
- Clear indication when it's a timeout vs other errors
- Shows attempt number in logs for debugging

## How It Works Now

When you request deep-dive content:
1. **First attempt**: 60 second timeout
2. **If timeout**: Wait 2 seconds, retry
3. **Second attempt**: Another 60 seconds
4. **If timeout again**: Wait 2 seconds, retry once more
5. **Third attempt**: Final 60 seconds

Total possible time: ~3 minutes with retries

## Additional Optimization Needed

If timeouts persist, you may need to:

### Option 1: Increase Supabase Function Timeout
1. Go to Supabase Dashboard
2. Functions → attraction-info → Settings
3. Increase timeout from default (10s) to 60s

### Option 2: Optimize the Prompt
Currently deep-dive generates 500-800 words. You could reduce to:
- 400-600 words for faster generation
- Still provides comprehensive content
- Reduces timeout risk

### Option 3: Split Generation
- Generate text first (lighter operation)
- Then generate audio separately
- Already implemented in the chunked system

## Testing

To test if the fixes work:
1. Select Brooklyn Bridge
2. Set preferences:
   - Language: Spanish (es)
   - Audio Length: Deep-dive
   - Theme: Architecture
3. Tap "Play Audio Guide"

You should see in logs:
```
Request timeout on attempt 1, retrying...
```

If it works on retry, you'll see the text generated successfully.

## Current Status

The system now has:
- ✅ Longer timeout for deep-dive content
- ✅ Automatic retry on timeout
- ✅ Better error handling and logging
- ✅ Progressive playback (audio starts quickly)

The timeout issue should be resolved or at least significantly improved with these changes!