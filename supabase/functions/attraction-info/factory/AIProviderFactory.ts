// AI Provider Factory
// Creates and configures AI provider instances based on environment/request

import { IAIProvider } from '../types/aiProvider.ts';
import { AIProviderType, getProviderType, validateProviderApiKey, PROVIDER_METADATA } from '../types/providers.ts';
import { OpenAIProvider } from '../providers/openai/OpenAIProvider.ts';

// Lazy import for Gemini to avoid loading if not needed
let GeminiProvider: any = null;

/**
 * Factory for creating AI provider instances
 */
export class AIProviderFactory {
  /**
   * Create provider based on environment variable or explicit type
   */
  static async createProvider(providerTypeString?: string): Promise<IAIProvider> {
    // Determine provider type from parameter or environment
    const envProvider = Deno.env.get('AI_PROVIDER_TYPE');
    const providerType = getProviderType(providerTypeString || envProvider);

    console.log(`[Factory] Creating AI provider: ${providerType}`);

    // Validate API key exists
    if (!validateProviderApiKey(providerType)) {
      const metadata = PROVIDER_METADATA[providerType];
      throw new Error(
        `Missing API key for ${metadata.displayName}. Please set ${metadata.requiresApiKey} environment variable.`
      );
    }

    // Create provider based on type
    switch (providerType) {
      case AIProviderType.OPENAI:
        return this.createOpenAIProvider();

      case AIProviderType.GEMINI:
        return await this.createGeminiProvider();

      default:
        console.warn(`[Factory] Unknown provider type: ${providerType}, falling back to OpenAI`);
        return this.createOpenAIProvider();
    }
  }

  /**
   * Create OpenAI provider instance
   */
  private static createOpenAIProvider(): IAIProvider {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    console.log('[Factory] Initialized OpenAI provider');
    return new OpenAIProvider(apiKey);
  }

  /**
   * Create Gemini provider instance (lazy loaded)
   */
  private static async createGeminiProvider(): Promise<IAIProvider> {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required for Gemini provider');
    }

    // Lazy load Gemini provider to avoid loading if not needed
    if (!GeminiProvider) {
      try {
        const module = await import('../providers/gemini/GeminiProvider.ts');
        GeminiProvider = module.GeminiProvider;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load Gemini provider: ${message}`);
      }
    }

    console.log('[Factory] Initialized Gemini provider');
    return new GeminiProvider(apiKey);
  }

  /**
   * Get list of available providers based on configured API keys
   */
  static getAvailableProviders(): AIProviderType[] {
    const available: AIProviderType[] = [];

    for (const providerType of Object.values(AIProviderType)) {
      if (validateProviderApiKey(providerType)) {
        available.push(providerType);
      }
    }

    return available;
  }

  /**
   * Check if a specific provider is available
   */
  static isProviderAvailable(providerType: AIProviderType): boolean {
    return validateProviderApiKey(providerType);
  }
}
