import { Hono } from "hono";
import { readFileSync } from "fs";
import { join } from "path";
import { GeminiService } from "./gemini";
import { ValidationService } from "./validator";
import type { AnalysisResult, ApiResponse } from "./types";

const app = new Hono();
const geminiService = new GeminiService();
const validationService = new ValidationService();

// Load the prompt templates
const promptPath = join(import.meta.dir, "..", "prompt.md");
const promptTemplate = readFileSync(promptPath, "utf-8");

const promptTextOnlyPath = join(
  import.meta.dir,
  "..",
  "prompt-text-only.v1-2.md"
);
const promptTextOnlyTemplate = readFileSync(promptTextOnlyPath, "utf-8");

const promptPdfOnlyPath = join(
  import.meta.dir,
  "..",
  "prompt-pdf-only.v1-2.md"
);
const promptPdfOnlyTemplate = readFileSync(promptPdfOnlyPath, "utf-8");

// Middleware for CORS
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (c.req.method === "OPTIONS") {
    return c.text("", 200);
  }

  await next();
});

// Health check endpoint
app.get("/health", async (c) => {
  try {
    const geminiConnected = await geminiService.testConnection();
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        gemini: geminiConnected ? "connected" : "disconnected",
      },
    });
  } catch (error) {
    return c.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Main analysis endpoint
app.post("/analyze", async (c) => {
  try {
    const body = await c.req.parseBody();
    const textFile = body["textFile"] as File;
    const pdfFile = body["pdfFile"] as File;

    if (!textFile || !pdfFile) {
      const response: ApiResponse = {
        success: false,
        error: "Both textFile and pdfFile are required",
      };
      return c.json(response, 400);
    }

    // Validate file types
    if (!textFile.type.includes("text") && !textFile.name.endsWith(".txt")) {
      const response: ApiResponse = {
        success: false,
        error: "Text file must be a .txt file",
      };
      return c.json(response, 400);
    }

    if (!pdfFile.type.includes("pdf") && !pdfFile.name.endsWith(".pdf")) {
      const response: ApiResponse = {
        success: false,
        error: "PDF file must be a .pdf file",
      };
      return c.json(response, 400);
    }

    // Read file contents
    const textContent = await textFile.text();
    const pdfBuffer = await pdfFile.arrayBuffer();

    console.log(`Processing files: ${textFile.name}, ${pdfFile.name}`);
    console.log(`Text content length: ${textContent.length}`);
    console.log(`PDF size: ${pdfBuffer.byteLength} bytes`);

    // Analyze with Gemini
    const analysisResult = await geminiService.analyzeStory(
      promptTemplate,
      textContent,
      pdfBuffer
    );

    // Validate the result
    const validation = validationService.validateAnalysisResult(analysisResult);

    let finalResult: AnalysisResult;
    let validationErrors: string[] = [];

    if (validation.valid) {
      finalResult = analysisResult;
    } else {
      console.warn(
        "Validation failed, attempting to sanitize:",
        validation.errors
      );
      finalResult = validationService.sanitizeAnalysisResult(analysisResult);
      validationErrors = validation.errors;

      // Re-validate the sanitized result
      const revalidation =
        validationService.validateAnalysisResult(finalResult);
      if (!revalidation.valid) {
        const response: ApiResponse = {
          success: false,
          error: "Failed to produce valid analysis result",
          validationErrors: revalidation.errors,
        };
        return c.json(response, 500);
      }
    }

    const response: ApiResponse = {
      success: true,
      data: finalResult,
      ...(validationErrors.length > 0 && { validationErrors }),
    };

    return c.json(response);
  } catch (error) {
    console.error("Analysis failed:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
    };
    return c.json(response, 500);
  }
});

// Main text-only analysis endpoint
app.post("/analyze-text", async (c) => {
  try {
    const body = await c.req.parseBody();
    const textFile = body["textFile"] as File;

    if (!textFile) {
      const response: ApiResponse = {
        success: false,
        error: "textFile is required",
      };
      return c.json(response, 400);
    }

    // Validate file type
    if (!textFile.type.includes("text") && !textFile.name.endsWith(".txt")) {
      const response: ApiResponse = {
        success: false,
        error: "Text file must be a .txt file",
      };
      return c.json(response, 400);
    }

    // Read file content
    const textContent = await textFile.text();

    console.log(`Processing text file: ${textFile.name}`);
    console.log(`Text content length: ${textContent.length}`);

    // Analyze with Gemini (text-only)
    const analysisResult = await geminiService.analyzeStoryTextOnly(
      promptTextOnlyTemplate,
      textContent
    );

    // Validate the result
    const validation = validationService.validateAnalysisResult(analysisResult);

    let finalResult: AnalysisResult;
    let validationErrors: string[] = [];

    if (validation.valid) {
      finalResult = analysisResult;
    } else {
      console.warn(
        "Validation failed, attempting to sanitize:",
        validation.errors
      );
      finalResult = validationService.sanitizeAnalysisResult(analysisResult);
      validationErrors = validation.errors;

      // Re-validate the sanitized result
      const revalidation =
        validationService.validateAnalysisResult(finalResult);
      if (!revalidation.valid) {
        const response: ApiResponse = {
          success: false,
          error: "Failed to produce valid analysis result",
          validationErrors: revalidation.errors,
        };
        return c.json(response, 500);
      }
    }

    const response: ApiResponse = {
      success: true,
      data: finalResult,
      ...(validationErrors.length > 0 && { validationErrors }),
    };

    return c.json(response);
  } catch (error) {
    console.error("Text analysis failed:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
    };
    return c.json(response, 500);
  }
});

// Main PDF-only analysis endpoint
app.post("/analyze-pdf", async (c) => {
  try {
    const body = await c.req.parseBody();
    const pdfFile = body["pdfFile"] as File;

    if (!pdfFile) {
      const response: ApiResponse = {
        success: false,
        error: "pdfFile is required",
      };
      return c.json(response, 400);
    }

    // Validate file type
    if (!pdfFile.type.includes("pdf") && !pdfFile.name.endsWith(".pdf")) {
      const response: ApiResponse = {
        success: false,
        error: "PDF file must be a .pdf file",
      };
      return c.json(response, 400);
    }

    // Read file content
    const pdfBuffer = await pdfFile.arrayBuffer();

    console.log(`Processing PDF file: ${pdfFile.name}`);
    console.log(`PDF size: ${pdfBuffer.byteLength} bytes`);

    // Analyze with Gemini (PDF-only)
    const analysisResult = await geminiService.analyzeStoryPdfOnly(
      promptPdfOnlyTemplate,
      pdfBuffer
    );

    // Validate the result
    const validation = validationService.validateAnalysisResult(analysisResult);

    let finalResult: AnalysisResult;
    let validationErrors: string[] = [];

    if (validation.valid) {
      finalResult = analysisResult;
    } else {
      console.warn(
        "Validation failed, attempting to sanitize:",
        validation.errors
      );
      finalResult = validationService.sanitizeAnalysisResult(analysisResult);
      validationErrors = validation.errors;

      // Re-validate the sanitized result
      const revalidation =
        validationService.validateAnalysisResult(finalResult);
      if (!revalidation.valid) {
        const response: ApiResponse = {
          success: false,
          error: "Failed to produce valid analysis result",
          validationErrors: revalidation.errors,
        };
        return c.json(response, 500);
      }
    }

    const response: ApiResponse = {
      success: true,
      data: finalResult,
      ...(validationErrors.length > 0 && { validationErrors }),
    };

    return c.json(response);
  } catch (error) {
    console.error("PDF analysis failed:", error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
    };
    return c.json(response, 500);
  }
});

// Get prompt template endpoint
app.get("/prompt", (c) => {
  return c.text(promptTemplate);
});

// Get text-only prompt template endpoint
app.get("/prompt-text", (c) => {
  return c.text(promptTextOnlyTemplate);
});

// Get PDF-only prompt template endpoint
app.get("/prompt-pdf", (c) => {
  return c.text(promptPdfOnlyTemplate);
});

// Get schema endpoint
app.get("/schema", (c) => {
  const schemaPath = join(import.meta.dir, "..", "schema.json");
  const schema = readFileSync(schemaPath, "utf-8");
  return c.json(JSON.parse(schema));
});

// Default route
app.get("/", (c) => {
  return c.json({
    name: "Children's Literature Analysis API",
    version: "1.0.0",
    endpoints: {
      "POST /analyze": "Analyze a story with text and PDF files",
      "POST /analyze-text": "Analyze a story with text file only",
      "POST /analyze-pdf": "Analyze a story with PDF file only",
      "GET /health": "Health check",
      "GET /prompt": "Get the analysis prompt template (PDF + text)",
      "GET /prompt-text": "Get the text-only analysis prompt template",
      "GET /prompt-pdf": "Get the PDF-only analysis prompt template",
      "GET /schema": "Get the JSON schema for analysis results",
    },
  });
});

const port = parseInt(process.env.PORT || "3000");

console.log(`🚀 Server starting on port ${port}`);
console.log(`📚 Children's Literature Analysis API ready`);
console.log(`🔗 Available at: http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
