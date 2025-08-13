import { mapVoiceStyle } from './voiceMapping.ts';
import { prepareTextForAudio } from './textProcessing.ts';
import { convertToBase64Safari, convertToBase64Standard, isValidBase64 } from './base64Utils.ts';
import { generateAudio } from './openaiService.ts';
export async function processAudioGeneration(generatedInfo, preferences, testMode, iosSafari, openAiApiKey) {
  console.log('Starting audio generation process:', {
    textLength: generatedInfo.length,
    iosSafari,
    testMode,
    preferences: preferences
  });
  // Determine if we need Safari optimizations
  const isSafariOptimized = iosSafari || preferences.safariOptimizedAudio;
  // Select voice based on user preferences or use a default
  let voice = mapVoiceStyle(preferences.voiceStyle || 'casual');
  // For Safari, prioritize more compatible voices
  if (isSafariOptimized) {
    voice = 'alloy'; // Most reliable voice for Safari
    console.log("Using Safari-optimized voice:", voice);
  } else {
    console.log("Generating audio with voice:", voice);
  }
  // Prepare text for audio with Safari optimizations
  const textForAudio = prepareTextForAudio(generatedInfo, testMode, isSafariOptimized);
  console.log(`Prepared text for audio: ${textForAudio.length} characters`);
  // Enhanced TTS API options for Safari
  const audioOptions = {
    model: 'tts-1-hd',
    voice: voice,
    input: textForAudio,
    response_format: 'mp3',
    speed: isSafariOptimized ? 0.95 : 1.0
  };
  console.log('Calling OpenAI TTS API with options:', audioOptions);
  try {
    const audioBuffer = await generateAudio(audioOptions, openAiApiKey);
    console.log(`Audio generation successful. Buffer size: ${audioBuffer.byteLength} bytes`);
    // Convert ArrayBuffer to base64 with enhanced error handling and fallback
    let base64String;
    let encodingMethod = isSafariOptimized ? 'safari-optimized' : 'standard';
    try {
      if (isSafariOptimized) {
        console.log('Attempting Safari-optimized base64 conversion...');
        base64String = await convertToBase64Safari(audioBuffer);
      } else {
        console.log('Using standard base64 conversion...');
        base64String = await convertToBase64Standard(audioBuffer);
      }
    } catch (encodingError) {
      console.error(`Initial base64 encoding failed with method: ${encodingMethod}. Error:`, encodingError);
      if (isSafariOptimized) {
        console.log('Falling back to standard base64 conversion...');
        encodingMethod = 'standard-fallback';
        base64String = await convertToBase64Standard(audioBuffer);
      } else {
        // If standard fails, there's not much else to do.
        throw encodingError;
      }
    }
    // Enhanced validation
    if (!isValidBase64(base64String)) {
      throw new Error(`Generated base64 string failed validation using method: ${encodingMethod}`);
    }
    // Additional length check
    if (base64String.length < 100) {
      throw new Error(`Generated base64 string is suspiciously short (method: ${encodingMethod})`);
    }
    console.log("Audio successfully encoded to base64:", {
      originalSize: audioBuffer.byteLength,
      base64Length: base64String.length,
      compressionRatio: (base64String.length / audioBuffer.byteLength).toFixed(2),
      encodingMethod: encodingMethod
    });
    // Return enhanced response data with detailed metadata
    const response = {
      info: generatedInfo,
      audio: base64String,
      audioSize: audioBuffer.byteLength,
      textSize: textForAudio.length,
      format: 'mp3',
      optimizedFor: isSafariOptimized ? 'safari' : 'standard',
      voice: voice,
      speed: audioOptions.speed,
      validation: {
        base64Length: base64String.length,
        isValid: true,
        encoding: encodingMethod,
        compressionRatio: base64String.length / audioBuffer.byteLength,
        originalBufferSize: audioBuffer.byteLength
      }
    };
    console.log('Audio processing completed successfully:', {
      audioSize: response.audioSize,
      base64Length: response.validation?.base64Length,
      optimizedFor: response.optimizedFor
    });
    return response;
  } catch (audioError) {
    console.error('Audio generation failed:', audioError);
    throw new Error(`Audio generation failed: ${audioError.message}`);
  }
}
