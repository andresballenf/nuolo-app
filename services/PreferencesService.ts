import { supabase } from '../lib/supabase';

export interface UserPreferences {
  theme: string;
  audioLength: string;
  voiceStyle: string;
  language: string;
  batteryOptimization: boolean;
  aiProvider?: string;
}

export class PreferencesService {
  /**
   * Get user preferences from Supabase
   */
  static async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no preferences exist yet, return null
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching user preferences:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        theme: data.theme,
        audioLength: data.audio_length,
        voiceStyle: data.voice_style,
        language: data.language,
        batteryOptimization: data.battery_optimization,
        aiProvider: data.ai_provider,
      };
    } catch (error) {
      console.error('Error in getUserPreferences:', error);
      return null;
    }
  }

  /**
   * Save user preferences to Supabase
   */
  static async saveUserPreferences(
    userId: string,
    preferences: UserPreferences
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          theme: preferences.theme,
          audio_length: preferences.audioLength,
          voice_style: preferences.voiceStyle,
          language: preferences.language,
          battery_optimization: preferences.batteryOptimization,
          ai_provider: preferences.aiProvider,
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving user preferences:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in saveUserPreferences:', error);
      return false;
    }
  }

  /**
   * Update specific preferences
   */
  static async updateUserPreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<boolean> {
    try {
      const updateData: any = { user_id: userId };

      if (updates.theme !== undefined) {
        updateData.theme = updates.theme;
      }
      if (updates.audioLength !== undefined) {
        updateData.audio_length = updates.audioLength;
      }
      if (updates.voiceStyle !== undefined) {
        updateData.voice_style = updates.voiceStyle;
      }
      if (updates.language !== undefined) {
        updateData.language = updates.language;
      }
      if (updates.batteryOptimization !== undefined) {
        updateData.battery_optimization = updates.batteryOptimization;
      }
      if (updates.aiProvider !== undefined) {
        updateData.ai_provider = updates.aiProvider;
      }

      const { error } = await supabase
        .from('user_preferences')
        .upsert(updateData, { onConflict: 'user_id' });

      if (error) {
        console.error('Error updating user preferences:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUserPreferences:', error);
      return false;
    }
  }

  /**
   * Delete user preferences
   */
  static async deleteUserPreferences(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting user preferences:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteUserPreferences:', error);
      return false;
    }
  }

  /**
   * Get default preferences
   */
  static getDefaultPreferences(): UserPreferences {
    return {
      theme: 'general',
      audioLength: 'medium',
      voiceStyle: 'casual',
      language: 'en',
      batteryOptimization: false,
    };
  }
}