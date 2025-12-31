// Shared constants for the application

export const MODELS = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", supportsThinking: true },
  { id: "gemini-flash-latest", name: "Gemini Flash Latest", supportsThinking: false },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", supportsThinking: true },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", supportsThinking: true },
] as const;

export const THINKING_LEVELS = [
  { id: "off", name: "Off", budget: 0 },
  { id: "low", name: "Low", budget: 1024 },
  { id: "medium", name: "Medium", budget: 8192 },
  { id: "high", name: "High", budget: 24576 },
  { id: "max", name: "Max", budget: -1 },
] as const;

export const TTS_VOICES = [
  { id: "Kore", name: "Kore", description: "Female, warm" },
  { id: "Puck", name: "Puck", description: "Male, friendly" },
  { id: "Charon", name: "Charon", description: "Male, deep" },
  { id: "Fenrir", name: "Fenrir", description: "Male, strong" },
  { id: "Aoede", name: "Aoede", description: "Female, clear" },
] as const;

// Thinking budget map for API
export const THINKING_BUDGET_MAP: Record<string, number> = {
  off: 0,
  low: 1024,
  medium: 8192,
  high: 24576,
  max: -1,
};

// Default values
export const DEFAULT_MODEL = "gemini-3-flash-preview";
export const DEFAULT_VOICE = "Kore";
export const DEFAULT_THINKING_LEVEL = "off";

// API config
export const MAX_OUTPUT_TOKENS = 16384;
export const TTS_SAMPLE_RATE = 24000;

// Type exports
export type ModelId = typeof MODELS[number]["id"];
export type ThinkingLevelId = typeof THINKING_LEVELS[number]["id"];
export type VoiceId = typeof TTS_VOICES[number]["id"];
