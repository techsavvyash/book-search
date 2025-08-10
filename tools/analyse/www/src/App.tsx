import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileUpload } from "./components/FileUpload";
import { AnalysisResults } from "./components/AnalysisResults";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { analysisApi } from "./lib/api";
import type { AnalysisResult, UploadFiles } from "./types/analysis";

function App() {
  const [files, setFiles] = useState<UploadFiles>({
    textFile: null,
    pdfFile: null,
  });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [uploadProgress, setUploadProgress] = useState(0);

  // Health check query
  const { data: healthStatus, isError: healthError } = useQuery({
    queryKey: ["health"],
    queryFn: () => analysisApi.health(),
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: (uploadFiles: UploadFiles) =>
      analysisApi.analyzeStory(uploadFiles),
    onMutate: () => {
      setUploadProgress(0);
      const startTime = Date.now();
      const expectedDuration = 50000; // 50 seconds
      
      // Progress based on expected 50-second timeline
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const timeBasedProgress = (elapsed / expectedDuration) * 100;
        
        // Cap at 95% until API actually completes
        const cappedProgress = Math.min(timeBasedProgress, 95);
        setUploadProgress(cappedProgress);
        
        // Clear interval if we've reached the cap
        if (cappedProgress >= 95) {
          clearInterval(progressInterval);
        }
      }, 1000); // Update every second

      return { progressInterval };
    },
    onSuccess: (data) => {
      setUploadProgress(100);
      if (data.success && data.data) {
        setAnalysisResult(data.data);
      }
    },
    onError: (error, _, context) => {
      setUploadProgress(0);
      if (context?.progressInterval) {
        clearInterval(context.progressInterval);
      }
    },
  });

  const handleAnalyze = () => {
    if (files.textFile || files.pdfFile) {
      analysisMutation.mutate(files);
    }
  };

  const handleResultChange = (newResult: AnalysisResult) => {
    setAnalysisResult(newResult);
  };

  const resetAnalysis = () => {
    setFiles({ textFile: null, pdfFile: null });
    setAnalysisResult(null);
    setUploadProgress(0);
    analysisMutation.reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-gray-900">
              StoryWeaver Book Analysis
            </h1>
          </div>
          
        </div>

        {/* Server Status */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            {healthError ? (
              <>
                <AlertCircle className="h-4 w-4 text-red-500" />
                <Badge variant="destructive">Server Offline</Badge>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Server Online
                </Badge>
              </>
            )}
          </div>
          {healthStatus?.geminiStatus && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              <Badge
                variant="outline"
                className="border-blue-200 text-blue-800"
              >
                Gemini Connected
              </Badge>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={resetAnalysis}
            className="text-sm text-muted-foreground hover:text-foreground underline hover:no-underline"
          >
            Start New Analysis
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - File Upload */}
          <div className="lg:col-span-1 space-y-6">
            <FileUpload
              files={files}
              onFilesChange={setFiles}
              onAnalyze={handleAnalyze}
              isAnalyzing={analysisMutation.isPending}
              progress={uploadProgress}
              error={analysisMutation.error?.message}
            />

            {/* Upload Instructions */}
            {/* <Card>
              <CardHeader>
                <CardTitle className="text-lg">How it works</CardTitle>
                <CardDescription>
                  Simple steps to analyze your story
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Upload Files</p>
                                         <p className="text-sm text-muted-foreground">
                       Upload a text (.txt) or PDF version of your story (or both)
                     </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">AI Analysis</p>
                    <p className="text-sm text-muted-foreground">
                      Our AI analyzes characters, themes, emotions, and more
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Edit & Export</p>
                    <p className="text-sm text-muted-foreground">
                      Edit any results and export as JSON
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card> */}

            {/* API Error Display */}
            {analysisMutation.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Analysis Failed:</strong>{" "}
                  {analysisMutation.error.message}
                  <br />
                  <button
                    onClick={() => analysisMutation.reset()}
                    className="underline hover:no-underline mt-1"
                  >
                    Clear error
                  </button>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-3 space-y-6">
            {analysisResult ? (
              <div className="space-y-4">
                <AnalysisResults
                  result={analysisResult}
                  onResultChange={handleResultChange}
                />
              </div>
            ) : (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Analysis Results
                  </CardTitle>
                  <CardDescription>
                    Upload and analyze files to see results here
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-lg mb-2">Ready for Analysis</p>
                    <p className="text-sm">
                      Upload your story files and click "Analyze Story" to get
                      started
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-200">
        {/* <p className="text-center text-sm text-gray-500">
          Powered by Google Gemini AI • Built with React, TypeScript, and
          Tailwind CSS
        </p> */}
      </div>
    </div>
  );
}

export default App;
