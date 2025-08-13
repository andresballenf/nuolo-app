// Safari-optimized base64 conversion
export async function convertToBase64Safari(audioBuffer) {
  const uint8Array = new Uint8Array(audioBuffer);
  try {
    // Build the binary string in chunks to avoid memory issues on Safari with large buffers
    let binaryString = '';
    const chunkSize = 8192; // Use smaller chunks for Safari
    for(let i = 0; i < uint8Array.length; i += chunkSize){
      const chunk = uint8Array.slice(i, i + chunkSize);
      let binaryChunk = '';
      // This is faster than String.fromCharCode.apply(null, chunk) for large chunks
      for(let j = 0; j < chunk.length; j++){
        binaryChunk += String.fromCharCode(chunk[j]);
      }
      binaryString += binaryChunk;
    }
    // Convert the full binary string to base64 at once
    const base64String = btoa(binaryString);
    // Validate the result
    if (!isValidBase64(base64String)) {
      throw new Error('Generated base64 string failed validation');
    }
    console.log(`Safari base64 conversion successful: ${base64String.length} chars`);
    return base64String;
  } catch (error) {
    console.error('Safari base64 conversion failed:', error);
    throw new Error('Safari base64 encoding failed: ' + error.message);
  }
}
// Standard base64 conversion (fixed to prevent chunking issues)
export async function convertToBase64Standard(audioBuffer) {
  const uint8Array = new Uint8Array(audioBuffer);
  try {
    // Convert entire buffer to binary string in one go for non-Safari browsers
    let binaryString = '';
    const chunkSize = 16384; // Larger chunks for better performance on modern browsers
    for(let i = 0; i < uint8Array.length; i += chunkSize){
      const chunk = uint8Array.slice(i, i + chunkSize);
      for(let j = 0; j < chunk.length; j++){
        binaryString += String.fromCharCode(chunk[j]);
      }
    }
    // Convert to base64 in one operation
    const base64String = btoa(binaryString);
    // Validate the result
    if (!isValidBase64(base64String)) {
      throw new Error('Generated base64 string failed validation');
    }
    console.log(`Standard base64 conversion successful: ${base64String.length} chars`);
    return base64String;
  } catch (error) {
    console.error('Standard base64 conversion failed:', error);
    throw new Error('Standard base64 encoding failed: ' + error.message);
  }
}
// Enhanced base64 validation
export function isValidBase64(str) {
  if (!str || typeof str !== 'string') {
    console.error("Base64 validation failed: not a string");
    return false;
  }
  // Check minimum length
  if (str.length < 4) {
    console.error("Base64 validation failed: too short");
    return false;
  }
  // Check length is multiple of 4
  if (str.length % 4 !== 0) {
    console.error("Base64 validation failed: length not multiple of 4");
    return false;
  }
  // Check for valid base64 characters
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Pattern.test(str)) {
    console.error("Base64 validation failed: invalid characters");
    return false;
  }
  // Try to decode a sample to verify it's actually valid
  try {
    const sampleSize = Math.min(1000, str.length);
    const sample = str.substring(0, sampleSize);
    atob(sample);
    return true;
  } catch (e) {
    console.error("Base64 validation failed: cannot decode sample:", e);
    return false;
  }
}
