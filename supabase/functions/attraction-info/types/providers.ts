// AI Provider Types and Metadata

export enum AIProviderType {
  OPENAI = 'openai',
  GEMINI = 'gemini'
}

export interface AIProviderMetadata {
  name: string;
  displayName: string;
  supportsSimultaneous: boolean;
  requiresApiKey: string;
  description: string;
}

export const PROVIDER_METADATA: Record<AIProviderType, AIProviderMetadata> = {
  [AIProviderType.OPENAI]: {
    name: 'openai',
    displayName: 'OpenAI + ElevenLabs',
    supportsSimultaneous: false,
    requiresApiKey: 'OPENAI_API_KEY',
    description: 'Two-step process: GPT-4 for narrative, TTS for audio',
  },
  [AIProviderType.GEMINI]: {
    name: 'gemini',
    displayName: 'Gemini Native Audio',
    supportsSimultaneous: true,
    requiresApiKey: 'GOOGLE_AI_API_KEY',
    description: 'Single-step: Gemini 2.5 Flash generates narrative and audio simultaneously',
  },
};

/**
 * Get provider type from string (with validation)
 */
export function getProviderType(providerString?: string): AIProviderType {
  if (!providerString) {
    return AIProviderType.OPENAI; // Default
  }

  const normalized = providerString.toLowerCase();
  if (normalized === AIProviderType.OPENAI) {
    return AIProviderType.OPENAI;
  }
  if (normalized === AIProviderType.GEMINI) {
    return AIProviderType.GEMINI;
  }

  console.warn(`Unknown AI provider: ${providerString}, defaulting to OpenAI`);
  return AIProviderType.OPENAI;
}

/**
 * Validate that required API key exists for provider
 */
export function validateProviderApiKey(providerType: AIProviderType): boolean {
  const metadata = PROVIDER_METADATA[providerType];
  const apiKey = Deno.env.get(metadata.requiresApiKey);
  return !!apiKey && apiKey.length > 0;
}
