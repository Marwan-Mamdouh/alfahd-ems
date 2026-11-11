"use client";

import React, { useRef, useState, useCallback } from "react";
import { UploadCloud, FileText, X, AlertCircle } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  validateCsvFile,
  formatFileSize,
  MAX_CSV_FILE_SIZE,
} from "./csv-validator";

export interface CsvDropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  requiredHeaders?: string[];
  maxSizeBytes?: number;
  disabled?: boolean;
  helperText?: string;
  className?: string;
}

export function CsvDropzone({
  onFileSelect,
  selectedFile,
  requiredHeaders,
  maxSizeBytes = MAX_CSV_FILE_SIZE,
  disabled = false,
  helperText = "CSV files up to 5MB",
  className,
}: CsvDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setValidationError(null);
      const result = await validateCsvFile(file, { requiredHeaders, maxSizeBytes });

      if (!result.isValid) {
        setValidationError(result.error || "Invalid CSV file");
        onFileSelect(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        onFileSelect(file);
      }
    },
    [requiredHeaders, maxSizeBytes, onFileSelect]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValidationError(null);
    onFileSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerBrowse = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Enter" || e.key === " ") && !selectedFile && !disabled) {
      e.preventDefault();
      triggerBrowse();
    }
  };

  return (
    <div className={cn("w-full space-y-3", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
        data-testid="csv-file-input"
      />

      {!selectedFile ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={triggerBrowse}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Upload CSV file"
          className={cn(
            "relative flex flex-col items-center justify-center p-6 text-center border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-150 outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isDragOver
              ? "border-primary bg-primary/5 text-primary"
              : "border-muted-foreground/25 hover:border-muted-foreground/50 bg-background",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
          data-testid="csv-dropzone-container"
        >
          <div className="flex items-center justify-center size-12 rounded-full bg-muted/60 mb-3 text-muted-foreground">
            <UploadCloud className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Click to browse or drag and drop your file here
            </p>
            <p className="text-xs text-muted-foreground">{helperText}</p>
            {requiredHeaders && requiredHeaders.length > 0 && (
              <p className="text-xs text-muted-foreground/80 mt-1">
                Required columns:{" "}
                <span className="font-mono text-foreground/80">
                  {requiredHeaders.join(", ")}
                </span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-between p-3.5 border rounded-lg bg-muted/30"
          data-testid="csv-selected-file-card"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center size-10 rounded-md bg-primary/10 text-primary shrink-0">
              <FileText className="size-5" />
            </div>
            <div className="truncate">
              <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleRemove}
              aria-label="Remove selected file"
              className="text-muted-foreground hover:text-destructive shrink-0"
              data-testid="csv-remove-file-button"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      )}

      {validationError && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20"
          data-testid="csv-validation-error"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}

