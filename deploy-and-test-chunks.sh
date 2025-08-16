#!/bin/bash

# Deploy and test the chunked audio generation system

echo "========================================="
echo "Chunked Audio System Deployment & Testing"
echo "========================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local not found"
    echo "Please create .env.local with your Supabase credentials"
    exit 1
fi

# Load environment variables
source .env.local

echo "✅ Environment variables loaded"
echo ""

# Step 1: Deploy the generate-audio-chunk function
echo "Step 1: Deploying generate-audio-chunk function to Supabase..."
echo "----------------------------------------"
npx supabase functions deploy generate-audio-chunk

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully"
else
    echo "❌ Function deployment failed"
    echo "Please check your Supabase configuration"
    exit 1
fi

echo ""
echo "Step 2: Testing the deployed function..."
echo "----------------------------------------"

# Run the test script
node test-chunk-generation.js

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps to test in the app:"
echo "1. Start the app: npx expo start"
echo "2. Navigate to a location with attractions"
echo "3. Select an attraction and tap 'Play Audio Guide'"
echo "4. The app will now use chunked generation for unlimited text!"
echo ""
echo "The system will automatically:"
echo "- Split long text into ~3900 character chunks"
echo "- Generate audio for each chunk in parallel"
echo "- Play the first chunk while others are still loading"
echo "- Seamlessly transition between chunks"
echo ""
echo "Monitor the console for detailed logs about chunk generation."