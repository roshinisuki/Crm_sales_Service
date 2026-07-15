"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Trash2, Upload, Loader2, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/ui-utils";

// ─── Signature Pad ───────────────────────────────────────────────────────────
interface SignaturePadProps {
  onChange: (data: string | null) => void;
  value?: string | null;
}

export function SignaturePad({ onChange, value }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (value === null) {
      setHasContent(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [value]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPoint.current = getPointerPos(e);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.strokeStyle = "#0b1f3a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPoint.current = pos;
    if (!hasContent) setHasContent(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPoint.current = null;
      const canvas = canvasRef.current;
      if (canvas && hasContent) {
        onChange(canvas.toDataURL("image/png"));
      }
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative border border-[var(--border)] rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-[150px] touch-none cursor-crosshair"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-gray-400">Sign here with mouse or touch...</span>
          </div>
        )}
      </div>
      {hasContent && (
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-400"
        >
          <Trash2 size={12} /> Clear Signature
        </button>
      )}
    </div>
  );
}

// ─── Photo Uploader ──────────────────────────────────────────────────────────
interface PhotoUploaderProps {
  visitId: string;
  photos: { url: string; caption?: string }[];
  onPhotosChange: (photos: { url: string; caption?: string }[]) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}

export function PhotoUploader({ visitId, photos, onPhotosChange, uploading, setUploading }: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("entityType", "ServiceVisit");
        formData.append("entityId", visitId);
        const res = await fetch(`/api/visits/${visitId}/attachments`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.fileUrl) {
            onPhotosChange([...photos, { url: json.data.fileUrl }]);
          }
        }
      }
    } catch (err) {
      console.error("Photo upload error:", err);
      alert("Failed to upload photo(s).");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [photos, onPhotosChange, setUploading, visitId]);

  const removePhoto = (idx: number) => {
    onPhotosChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading..." : "Upload Photos"}
        </button>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-[var(--border)]">
              <img
                src={photo.url}
                alt={photo.caption || `Photo ${idx + 1}`}
                className="w-full h-20 object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <p className="text-[10px] text-[var(--text-muted)]">No photos uploaded yet.</p>
      )}
    </div>
  );
}
