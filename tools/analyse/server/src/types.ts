export interface AnalysisRequest {
  textFile: File;
  pdfFile: File;
}

export interface CharacterGroup {
  primary: string[];
  secondary: string[];
}

export interface SettingGroup {
  primary: string[];
  secondary: string[];
}

export interface ThemeGroup {
  primary: string[];
  secondary: string[];
  amazon?: string;
}

export interface EventGroup {
  primary: string[];
  secondary: string[];
}

export interface EmotionGroup {
  primary: string[];
  secondary: string[];
}

export interface AnalysisResult {
  story_title?: string;
  level?: string;
  characters: CharacterGroup;
  settings: SettingGroup;
  themes: ThemeGroup;
  events: EventGroup;
  emotions: EmotionGroup;
  keywords: string[];
}

export interface ApiResponse {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
  validationErrors?: string[];
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}
