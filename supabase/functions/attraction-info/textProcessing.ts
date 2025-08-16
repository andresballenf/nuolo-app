// Prepare text for audio generation with proper length limits
export function prepareTextForAudio(generatedInfo, testMode, isSafariOptimized) {
  let textForAudio = generatedInfo;
  
  // Log original text length
  console.log(`Original text length: ${generatedInfo.length} characters`);
  
  // Test mode: use a reasonable subset for testing (1000 chars instead of 200)
  if (testMode) {
    const testMaxLength = 1000;
    if (textForAudio.length > testMaxLength) {
      textForAudio = generatedInfo.substring(0, testMaxLength);
      // Find the last sentence boundary
      const lastPeriodIndex = textForAudio.lastIndexOf('.');
      if (lastPeriodIndex > 500) {
        textForAudio = textForAudio.substring(0, lastPeriodIndex + 1);
      } else {
        textForAudio += ".";
      }
      console.log(`Test mode: shortened text to ${textForAudio.length} chars (from ${generatedInfo.length} chars)`);
    }
    return textForAudio;
  }
  
  // OpenAI TTS API has a 4096 character limit
  const TTS_MAX_LENGTH = 4096;
  
  // Check if text exceeds OpenAI's limit
  if (textForAudio.length > TTS_MAX_LENGTH) {
    console.log(`Text exceeds OpenAI TTS limit (${textForAudio.length} > ${TTS_MAX_LENGTH}), truncating...`);
    
    // Truncate at 4000 to leave some buffer
    const truncatedText = textForAudio.substring(0, 4000);
    
    // Find the last complete sentence
    const lastPeriodIndex = truncatedText.lastIndexOf('.');
    const lastExclamationIndex = truncatedText.lastIndexOf('!');
    const lastQuestionIndex = truncatedText.lastIndexOf('?');
    
    // Find the last sentence boundary
    const lastSentenceEnd = Math.max(lastPeriodIndex, lastExclamationIndex, lastQuestionIndex);
    
    if (lastSentenceEnd > 2000) {
      // If we have a good sentence boundary after 2000 chars, use it
      textForAudio = truncatedText.substring(0, lastSentenceEnd + 1);
    } else {
      // Otherwise just truncate and add ellipsis
      textForAudio = truncatedText + "...";
    }
    
    console.log(`Truncated text to ${textForAudio.length} chars to fit OpenAI TTS limit`);
  }
  
  // Log final text length being sent to TTS
  console.log(`Final text for TTS: ${textForAudio.length} characters (Safari optimized: ${isSafariOptimized})`);
  
  return textForAudio;
}
