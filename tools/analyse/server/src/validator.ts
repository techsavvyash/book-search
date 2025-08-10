import Ajv from "ajv";
import type { AnalysisResult } from "./types";
import schema from "../schema.json";

export class ValidationService {
  private ajv: Ajv;
  private validate: any;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.validate = this.ajv.compile(schema);
  }

  validateAnalysisResult(data: any): { valid: boolean; errors: string[] } {
    const valid = this.validate(data);
    const errors: string[] = [];

    if (!valid && this.validate.errors) {
      for (const error of this.validate.errors) {
        const path = error.instancePath || "root";
        const message = error.message || "validation error";
        errors.push(`${path}: ${message}`);
      }
    }

    return { valid, errors };
  }

  sanitizeAnalysisResult(data: any): AnalysisResult {
    // Helper function to filter and ensure non-empty arrays
    const sanitizeArray = (
      arr: any[],
      defaultValue: string = "Unknown"
    ): string[] => {
      if (!Array.isArray(arr)) return [defaultValue];
      const filtered = arr.filter(
        (item) => typeof item === "string" && item.trim().length > 0
      );
      return filtered.length > 0 ? filtered : [defaultValue];
    };

    // Helper function to sanitize secondary arrays (can be empty)
    const sanitizeSecondaryArray = (arr: any[]): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (item) => typeof item === "string" && item.trim().length > 0
      );
    };

    // Ensure required fields exist with default values
    const sanitized: AnalysisResult = {
      characters: {
        primary: sanitizeArray(data.characters?.primary, "Character"),
        secondary: sanitizeSecondaryArray(data.characters?.secondary),
      },
      settings: {
        primary: sanitizeArray(data.settings?.primary, "Setting"),
        secondary: sanitizeSecondaryArray(data.settings?.secondary),
      },
      themes: {
        primary: sanitizeArray(data.themes?.primary, "General"),
        secondary: sanitizeSecondaryArray(data.themes?.secondary),
        // Only add amazon field if it exists and is valid
        ...(data.themes?.amazon &&
        typeof data.themes.amazon === "string" &&
        data.themes.amazon.trim().length > 0
          ? { amazon: data.themes.amazon.trim() }
          : {}),
      },
      events: {
        primary: sanitizeArray(data.events?.primary, "Story event"),
        secondary: sanitizeSecondaryArray(data.events?.secondary),
      },
      emotions: {
        primary: sanitizeArray(data.emotions?.primary, "Emotion"),
        secondary: sanitizeSecondaryArray(data.emotions?.secondary),
      },
      keywords: sanitizeArray(data.keywords, "keyword"),
    };

    // Add optional fields if they exist (relaxed validation)
    if (data.story_title && typeof data.story_title === "string") {
      const trimmed = data.story_title.trim();
      if (trimmed.length > 0) {
        sanitized.story_title = trimmed;
      }
    }

    // Level field - accept any non-empty string (relaxed validation)
    if (data.level && typeof data.level === "string") {
      const trimmed = data.level.trim();
      if (trimmed.length > 0) {
        sanitized.level = trimmed;
      }
    }

    return sanitized;
  }
}
