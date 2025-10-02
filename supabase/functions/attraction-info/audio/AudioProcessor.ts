// Audio Processing Utilities for AI Providers
// Handles PCM to WAV conversion and Base64 encoding

/**
 * Convert PCM audio data to WAV format
 *
 * @param pcmData - Raw PCM audio data (Int16Array or ArrayBuffer)
 * @param sampleRate - Sample rate in Hz (default: 16000)
 * @param numChannels - Number of channels (default: 1 for mono)
 * @returns WAV formatted ArrayBuffer
 */
export function pcmToWav(
  pcmData: Int16Array | ArrayBuffer,
  sampleRate: number = 16000,
  numChannels: number = 1
): ArrayBuffer {
  // Convert to Int16Array if needed
  const pcmArray = pcmData instanceof Int16Array ? pcmData : new Int16Array(pcmData);

  const numSamples = pcmArray.length;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;

  // WAV header is 44 bytes
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV Header
  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // File size - 8
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // ByteRate
  view.setUint16(32, numChannels * bytesPerSample, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // Write PCM data
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, pcmArray[i], true);
  }

  return buffer;
}

/**
 * Helper function to write ASCII string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Merge multiple PCM audio chunks into a single PCM ArrayBuffer
 */
export function mergePcmChunks(chunks: Int16Array[]): Int16Array {
  // Calculate total length
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

  // Create merged array
  const merged = new Int16Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

/**
 * Complete pipeline: PCM chunks -> Merged PCM -> WAV -> Base64
 */
export function processPcmToBase64Wav(
  pcmChunks: Int16Array[],
  sampleRate: number = 16000,
  numChannels: number = 1
): { audioData: ArrayBuffer; audioBase64: string } {
  // Merge all PCM chunks
  const mergedPcm = mergePcmChunks(pcmChunks);

  // Convert to WAV
  const wavBuffer = pcmToWav(mergedPcm, sampleRate, numChannels);

  // Convert to Base64
  const audioBase64 = arrayBufferToBase64(wavBuffer);

  return {
    audioData: wavBuffer,
    audioBase64,
  };
}

/**
 * Validate PCM data format and properties
 */
export function validatePcmData(data: unknown): data is Int16Array {
  return data instanceof Int16Array && data.length > 0;
}

/**
 * Calculate estimated duration of PCM audio in seconds
 */
export function getPcmDuration(pcmData: Int16Array, sampleRate: number = 16000): number {
  return pcmData.length / sampleRate;
}
