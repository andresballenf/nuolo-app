// Map user preference voice styles to OpenAI voice options
export function mapVoiceStyle(voiceStyle) {
  switch(voiceStyle){
    case 'formal':
      return 'onyx';
    case 'energetic':
      return 'nova';
    case 'calm':
      return 'shimmer';
    case 'casual':
    default:
      return 'alloy';
  }
}
