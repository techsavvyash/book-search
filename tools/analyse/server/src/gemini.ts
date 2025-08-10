import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from "./types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    console.log("apiKey", apiKey);
    if (!apiKey) {
      throw new Error(
        "GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required"
      );
    }

    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeStory(
    prompt: string,
    textContent: string,
    pdfBuffer: ArrayBuffer
  ): Promise<AnalysisResult> {
    try {
      // Convert PDF to base64 for Gemini API
      const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

      const fullPrompt = `${prompt}

TEXT CONTENT:
${textContent}

Please analyze this children's story and return ONLY a valid JSON object following the specified schema. Do not include any additional text or explanations.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: fullPrompt,
              },
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64,
                },
              },
            ],
          },
        ],
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response text received from Gemini");
      }

      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const analysisResult = JSON.parse(jsonMatch[0]);
      return analysisResult;
    } catch (error) {
      console.error("Error analyzing story with Gemini:", error);
      throw new Error(
        `Failed to analyze story: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async analyzeStoryTextOnly(
    prompt: string,
    textContent: string
  ): Promise<AnalysisResult> {
    try {
      const fullPrompt = `${prompt}

TEXT CONTENT:
${textContent}

Please analyze this children's story and return ONLY a valid JSON object following the specified schema. Do not include any additional text or explanations.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response text received from Gemini");
      }

      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const analysisResult = JSON.parse(jsonMatch[0]);
      return analysisResult;
    } catch (error) {
      console.error("Error analyzing story with Gemini (text-only):", error);
      throw new Error(
        `Failed to analyze story: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async analyzeStoryPdfOnly(
    prompt: string,
    pdfBuffer: ArrayBuffer
  ): Promise<AnalysisResult> {
    try {
      // Convert PDF to base64 for Gemini API
      const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

      const fullPrompt = `${prompt}

Please analyze this children's story PDF and return ONLY a valid JSON object following the specified schema. Analyze both the text content and visual elements from the illustrations. Do not include any additional text or explanations.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: fullPrompt,
              },
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64,
                },
              },
            ],
          },
        ],
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response text received from Gemini");
      }

      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const analysisResult = JSON.parse(jsonMatch[0]);
      return analysisResult;
    } catch (error) {
      console.error("Error analyzing story with Gemini (PDF-only):", error);
      throw new Error(
        `Failed to analyze story: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-001",
        contents: "Test connection. Respond with: OK",
      });
      return response.text?.includes("OK") ?? false;
    } catch (error) {
      console.error("Gemini connection test failed:", error);
      return false;
    }
  }
}
