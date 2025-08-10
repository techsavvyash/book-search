import axios from "axios";
import type { ApiResponse, UploadFiles } from "@/types/analysis";

const API_BASE_URL = "http://localhost:3000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for file upload and processing
});

export const analysisApi = {
  // Health check
  health: async () => {
    const response = await apiClient.get("/health");
    return response.data;
  },

  // Analyze story with files
  analyzeStory: async (files: UploadFiles): Promise<ApiResponse> => {
    if (!files.textFile && !files.pdfFile) {
      throw new Error("At least one file (text or PDF) is required");
    }

    const formData = new FormData();
    if (files.textFile) {
      formData.append("textFile", files.textFile);
    }
    if (files.pdfFile) {
      formData.append("pdfFile", files.pdfFile);
    }

    const response = await apiClient.post<ApiResponse>("/analyze", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },

  // Get schema
  getSchema: async () => {
    const response = await apiClient.get("/schema");
    return response.data;
  },

  // Get prompt
  getPrompt: async () => {
    const response = await apiClient.get("/prompt");
    return response.data;
  },
};

export default analysisApi;
