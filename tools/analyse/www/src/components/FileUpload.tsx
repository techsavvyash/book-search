import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, File, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UploadFiles } from '@/types/analysis';

interface FileUploadProps {
  files: UploadFiles;
  onFilesChange: (files: UploadFiles) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  progress?: number;
  error?: string;
}

export function FileUpload({ 
  files, 
  onFilesChange, 
  onAnalyze, 
  isAnalyzing, 
  progress = 0,
  error 
}: FileUploadProps) {
  const textFileRef = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState<'text' | 'pdf' | null>(null);

  const handleTextFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFilesChange({ ...files, textFile: file });
    }
  };

  const handlePdfFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFilesChange({ ...files, pdfFile: file });
    }
  };

  const handleDrop = (event: React.DragEvent, type: 'text' | 'pdf') => {
    event.preventDefault();
    setDragOver(null);
    
    const droppedFile = event.dataTransfer.files[0];
    if (!droppedFile) return;

    if (type === 'text' && droppedFile.type.includes('text')) {
      onFilesChange({ ...files, textFile: droppedFile });
    } else if (type === 'pdf' && droppedFile.type === 'application/pdf') {
      onFilesChange({ ...files, pdfFile: droppedFile });
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDragEnter = (type: 'text' | 'pdf') => {
    setDragOver(type);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const removeFile = (type: 'text' | 'pdf') => {
    if (type === 'text') {
      onFilesChange({ ...files, textFile: null });
      if (textFileRef.current) textFileRef.current.value = '';
    } else {
      onFilesChange({ ...files, pdfFile: null });
      if (pdfFileRef.current) pdfFileRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canAnalyze = (files.textFile || files.pdfFile) && !isAnalyzing;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Story Files
        </CardTitle>
        <CardDescription>
          Upload a text file (.txt) or PDF file (or both) for analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Text File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Text File (.txt)</label>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
              dragOver === 'text' ? "border-primary bg-primary/10" : "border-muted-foreground/25",
              files.textFile ? "border-green-500 bg-green-50" : "hover:border-primary/50"
            )}
            onDrop={(e) => handleDrop(e, 'text')}
            onDragOver={handleDragOver}
            onDragEnter={() => handleDragEnter('text')}
            onDragLeave={handleDragLeave}
            onClick={() => textFileRef.current?.click()}
          >
            <input
              ref={textFileRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleTextFileChange}
              className="hidden"
            />
            {files.textFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{files.textFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(files.textFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile('text');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click or drag text file here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* PDF File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">PDF File (.pdf)</label>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
              dragOver === 'pdf' ? "border-primary bg-primary/10" : "border-muted-foreground/25",
              files.pdfFile ? "border-green-500 bg-green-50" : "hover:border-primary/50"
            )}
            onDrop={(e) => handleDrop(e, 'pdf')}
            onDragOver={handleDragOver}
            onDragEnter={() => handleDragEnter('pdf')}
            onDragLeave={handleDragLeave}
            onClick={() => pdfFileRef.current?.click()}
          >
            <input
              ref={pdfFileRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handlePdfFileChange}
              className="hidden"
            />
            {files.pdfFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-red-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{files.pdfFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(files.pdfFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile('pdf');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <File className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click or drag PDF file here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isAnalyzing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Analyzing story with AI...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
            <div className="text-xs text-muted-foreground text-center">
              {progress < 95 ? (
                <>
                  Expected time: ~50 seconds • Processing characters, themes, emotions...
                </>
              ) : (
                <>
                  Finalizing analysis results...
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Analyze Button */}
        <Button 
          onClick={onAnalyze} 
          disabled={!canAnalyze}
          className="w-full"
          size="lg"
        >
          {isAnalyzing ? (
            "Analyzing..."
          ) : canAnalyze ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Analyze Story
            </>
          ) : (
            "Select File(s) to Analyze"
          )}
        </Button>
      </CardContent>
    </Card>
  );
} 