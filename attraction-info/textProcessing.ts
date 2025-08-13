// Prepare text for audio generation with Safari optimizations
export function prepareTextForAudio(generatedInfo, testMode, isSafariOptimized) {
  let textForAudio = generatedInfo;
  if (testMode) {
    const maxLength = 200;
    textForAudio = generatedInfo.substring(0, maxLength);
    if (generatedInfo.length > maxLength) {
      textForAudio += ".";
    }
    console.log(`Using shortened test text (${textForAudio.length} chars)`);
    return textForAudio;
  }
  // Safari-specific text optimization
  if (isSafariOptimized) {
    console.log("Applying Safari optimizations for audio generation");
    const maxLength = 300;
    if (textForAudio.length > maxLength) {
      const truncatedText = textForAudio.substring(0, maxLength);
      const lastPeriodIndex = truncatedText.lastIndexOf('.');
      if (lastPeriodIndex > 0) {
        textForAudio = truncatedText.substring(0, lastPeriodIndex + 1);
      } else {
        textForAudio = truncatedText + "...";
      }
      console.log(`Safari optimized text length: ${textForAudio.length} chars`);
    }
  }
  return textForAudio;
}
