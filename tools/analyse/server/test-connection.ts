#!/usr/bin/env bun

import { GoogleGenAI } from "@google/genai";

async function testConnection() {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "❌ No API key found. Please set GOOGLE_API_KEY or GEMINI_API_KEY environment variable."
      );
      process.exit(1);
    }

    console.log("🔄 Testing Gemini API connection...");

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: "Test connection. Respond with: Connection successful!",
    });

    console.log("✅ Connection test successful!");
    console.log("📝 Response:", response.text);

    // Test JSON generation
    console.log("\n🧪 Testing JSON generation...");
    const jsonResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents:
        'Return only this JSON object: {"test": "success", "timestamp": "' +
        new Date().toISOString() +
        '"}',
    });

    console.log("📊 JSON Response:", jsonResponse.text);

    try {
      const parsed = JSON.parse(jsonResponse.text.match(/\{.*\}/)?.[0] || "{}");
      console.log("✅ JSON parsing successful:", parsed);
    } catch (e) {
      console.log("⚠️  JSON parsing failed, but response received");
    }
  } catch (error) {
    console.error("❌ Connection test failed:", error);
    process.exit(1);
  }
}

testConnection();
