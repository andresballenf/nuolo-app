-- Add ai_provider column to user_preferences table
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'openai';

-- Add comment to document the column
COMMENT ON COLUMN public.user_preferences.ai_provider IS 'AI provider selection: openai or gemini';
