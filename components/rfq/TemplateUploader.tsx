"use client";

import { useState, useRef } from "react";
import { UploadCloud, File as FileIcon, X, CheckCircle, Loader2 } from "lucide-react";

export interface ParsedLineItem {
  item_description: string;
  quantity: string;
  unit: string;
  target_price: string;
  specifications: string;
}

interface TemplateUploaderProps {
  onParsed: (data: {
    lineItems: ParsedLineItem[];
    templateFileName: string;
    templateFileUrl: string;
    rawText?: string;
  }) => void;
}

export function TemplateUploader({ onParsed }: TemplateUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setError(null);
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|xlsx?|csv)$/i)) {
      setError("Please upload a PDF, Excel (.xlsx/.xls), or CSV file.");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/rfq/parse-template", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (result.success && result.data) {
        onParsed(result.data);
      } else {
        setError(result.message || "Failed to parse template");
      }
    } catch (err: any) {
      setError(err.message || "Network error while uploading");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200 ease-in-out ${
          isDragging
            ? "border-primary-500 bg-primary-50"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.xlsx,.xls,.csv"
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
            <p className="text-sm font-medium text-slate-700">Extracting Line Items...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mb-2">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold text-slate-800">
              Click or drag template to upload
            </p>
            <p className="text-sm text-slate-500">
              Supports PDF, Excel (.xlsx/.xls), and CSV
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md text-sm font-medium flex items-start gap-2">
          <X className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
