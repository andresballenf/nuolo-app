# Fix OpenAI Quota Exceeded Error

## Current Issue
The error message shows:
```
"You exceeded your current quota, please check your plan and billing details"
```

This means the OpenAI API key being used has run out of credits.

## Solution Steps

### 1. Check Your OpenAI Account Balance
1. Visit: https://platform.openai.com/account/billing
2. Log in with your OpenAI account
3. Check your current balance and usage

### 2. Add Credits to Your Account
1. Go to: https://platform.openai.com/account/billing/overview
2. Click "Add payment method" or "Add to credit balance"
3. Add at least $5-10 for testing (TTS API costs ~$0.015 per 1K characters)

### 3. Check Your API Key Usage
1. Visit: https://platform.openai.com/usage
2. See which API key is consuming credits
3. Consider creating a new API key if needed

### 4. Update Supabase with New Key (if needed)
If you create a new API key:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-new-key-here
```

### 5. Monitor Usage
- Each audio generation costs approximately:
  - Short (1000 chars): ~$0.015
  - Medium (3000 chars): ~$0.045
  - Long (6000 chars): ~$0.090

## Alternative Solutions

### Option 1: Use a Different OpenAI Account
1. Create a new OpenAI account
2. Get the free trial credits
3. Generate a new API key
4. Update in Supabase:
   ```bash
   npx supabase secrets set OPENAI_API_KEY=sk-new-key
   ```

### Option 2: Implement Caching (Future Enhancement)
- Cache generated audio for frequently visited attractions
- Reuse audio for same attraction + preferences combination
- This would significantly reduce API costs

### Option 3: Use Test Mode
The app has a test mode that can return sample text without API calls:
- Enable test mode in the app settings
- This bypasses OpenAI for development

## Cost Estimation

For typical usage:
- 100 audio generations per day
- Average 3000 characters each
- Daily cost: ~$4.50
- Monthly cost: ~$135

To reduce costs:
- Use shorter audio lengths in preferences
- Implement caching for popular attractions
- Use test mode during development

## Verification

After adding credits, test with:
```bash
node debug-function.js
```

You should see:
```
✅ Success! Audio generated
```

## Current System Status

The code is working correctly. The issues are:
1. ✅ Code: Working
2. ✅ Deployment: Function is deployed
3. ❌ OpenAI Credits: Need to be added
4. ✅ Error Handling: Now shows clear messages

Once you add credits to your OpenAI account, the audio generation will work immediately.