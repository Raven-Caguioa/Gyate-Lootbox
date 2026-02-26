"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Upload, ChevronDown, RefreshCw, ImageIcon, CheckCircle2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PinataFile } from "@/app/api/pinata-images/route";

interface ImagePickerFieldProps {
  value: string;
  onChange: (url: string) => void;
  groupId?: string;
  label?: string;
}

const STYLES = `
  @keyframes ipf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .ipf-dropdown-content {
    background: #ffffff !important;
    border: 2px solid #e9d5ff !important;
    border-radius: 16px !important;
    box-shadow: 5px 5px 0px rgba(201,184,255,0.4) !important;
    padding: 6px !important;
    min-width: 288px !important;
    z-index: 9999 !important;
  }
  .ipf-label {
    font-family: 'Nunito', sans-serif !important;
    font-size: 10px !important;
    font-weight: 800 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
    color: #94a3b8 !important;
    padding: 4px 8px 2px !important;
    display: block !important;
  }
  .ipf-separator {
    background: #f3f0ff !important;
    height: 1.5px !important;
    margin: 4px 0 !important;
    border: none !important;
  }
  .ipf-item {
    border-radius: 10px !important;
    padding: 8px 10px !important;
    cursor: pointer !important;
    transition: background 0.15s !important;
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    border: none !important;
    background: transparent !important;
    width: 100% !important;
    text-align: left !important;
  }
  .ipf-item:hover, .ipf-item:focus {
    background: #f5f3ff !important;
    outline: none !important;
  }
  .ipf-item[data-selected="true"] {
    background: #ede9fe !important;
  }
  .ipf-thumb {
    width: 38px !important;
    height: 38px !important;
    border-radius: 9px !important;
    overflow: hidden !important;
    background: #f3f0ff !important;
    border: 1.5px solid #e9d5ff !important;
    flex-shrink: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .ipf-thumb img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
  }
  .ipf-name {
    font-family: 'Nunito', sans-serif !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    color: #1a1a1a !important;
    line-height: 1.3 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 170px !important;
    display: block !important;
  }
  .ipf-cid {
    font-family: 'Courier New', monospace !important;
    font-size: 9px !important;
    color: #a78bfa !important;
    margin-top: 2px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 170px !important;
    display: block !important;
  }
  .ipf-check { color: #7c3aed !important; flex-shrink: 0 !important; margin-left: auto !important; }
  .ipf-empty {
    padding: 28px 16px !important;
    text-align: center !important;
    font-family: 'Nunito', sans-serif !important;
    font-size: 12px !important;
    color: #a78bfa !important;
    font-weight: 600 !important;
  }
  .ipf-loading {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    padding: 28px 16px !important;
    font-family: 'Nunito', sans-serif !important;
    font-size: 12px !important;
    color: #7c3aed !important;
    font-weight: 600 !important;
  }
  .ipf-scroll {
    max-height: 290px !important;
    overflow-y: auto !important;
    scrollbar-width: thin !important;
    scrollbar-color: #e9d5ff transparent !important;
  }
  .ipf-scroll::-webkit-scrollbar { width: 4px; }
  .ipf-scroll::-webkit-scrollbar-track { background: transparent; }
  .ipf-scroll::-webkit-scrollbar-thumb { background: #c9b8ff; border-radius: 99px; }
  .ipf-header-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 2px 6px 0 !important;
  }
  .ipf-refresh-btn {
    background: none !important;
    border: none !important;
    padding: 5px !important;
    border-radius: 7px !important;
    cursor: pointer !important;
    color: #c9b8ff !important;
    transition: background 0.15s, color 0.15s !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .ipf-refresh-btn:hover { background: #f5f3ff !important; color: #7c3aed !important; }
  .ipf-spinning { animation: ipf-spin 1s linear infinite !important; }

  /* Action buttons */
  .ipf-btn {
    flex: 1;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: white;
    border: 2px solid #e9d5ff;
    border-radius: 12px;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #7c3aed;
    cursor: pointer;
    transition: all 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 2px 2px 0px rgba(201,184,255,0.45);
    white-space: nowrap;
  }
  .ipf-btn:hover {
    border-color: #c9b8ff;
    background: #faf5ff;
    transform: translateY(-1px);
    box-shadow: 3px 3px 0px rgba(201,184,255,0.55);
  }
  .ipf-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .ipf-btn-chevron { margin-left: auto; opacity: 0.5; }

  /* Field layout */
  .ipf-field-label {
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .ipf-clear-btn {
    background: none; border: none; padding: 2px 7px;
    border-radius: 6px; font-family: 'Nunito', sans-serif;
    font-size: 10px; font-weight: 700; color: #a78bfa;
    cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
    transition: color 0.15s, background 0.15s;
  }
  .ipf-clear-btn:hover { color: #dc2626; background: #fff1f2; }
  .ipf-url-wrap { position: relative; margin-top: 6px; }
  .ipf-preview-thumb {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    width: 26px; height: 26px; border-radius: 7px;
    object-fit: cover; border: 1.5px solid #e9d5ff;
  }
`;

export function ImagePickerField({
  value,
  onChange,
  groupId,
  label = "NFT Image",
}: ImagePickerFieldProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PinataFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchImages = async () => {
    setIsLoadingFiles(true);
    try {
      const params = groupId ? `?groupId=${groupId}` : "";
      const res = await fetch(`/api/pinata-images${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch images");
      setFiles(data.files ?? []);
      setHasFetched(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load images", description: err.message });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name);
      if (groupId) form.append("groupId", groupId);
      const res = await fetch("/api/pinata-images", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange(data.url);
      toast({ title: "✦ Uploaded!", description: `${file.name} pinned to IPFS` });
      await fetchImages();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const displayName = (f: PinataFile) => {
    const n = f.name ?? f.cid;
    return n.length > 26 ? n.slice(0, 23) + "…" : n;
  };

  const previewUrl = value.startsWith("http") || value.startsWith("ipfs") ? value : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />

      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="ipf-field-label">{label}</span>
        {value && (
          <button className="ipf-clear-btn" type="button" onClick={() => onChange("")}>
            <X size={10} /> clear
          </button>
        )}
      </div>

      {/* Buttons row */}
      <div style={{ display: "flex", gap: 8 }}>
        {/* Upload */}
        <button
          type="button"
          className="ipf-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading
            ? <RefreshCw size={13} className="ipf-spinning" />
            : <Upload size={13} />}
          {isUploading ? "Uploading…" : "Upload Image"}
        </button>

        {/* Pinata picker */}
        <DropdownMenu onOpenChange={(open) => { if (open && !hasFetched) fetchImages(); }}>
          <DropdownMenuTrigger asChild>
            <button
            type="button"
            className="ipf-btn flex items-center justify-center gap-1"
            >
            <ImageIcon size={13} />
            Pick from Pinata
            <ChevronDown size={11} className="ipf-btn-chevron" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="ipf-dropdown-content" align="end" sideOffset={6}>
            {/* Header */}
            <div className="ipf-header-row">
              <span className="ipf-label">Pinned Images</span>
              <button
                type="button"
                className="ipf-refresh-btn"
                onClick={(e) => { e.stopPropagation(); fetchImages(); }}
                disabled={isLoadingFiles}
              >
                <RefreshCw size={12} className={isLoadingFiles ? "ipf-spinning" : ""} />
              </button>
            </div>

            <div className="ipf-separator" />

            {isLoadingFiles ? (
              <div className="ipf-loading">
                <RefreshCw size={13} className="ipf-spinning" /> Loading…
              </div>
            ) : files.length === 0 ? (
              <div className="ipf-empty">
                {hasFetched ? "No images found in this group" : "Open to load images"}
              </div>
            ) : (
              <div className="ipf-scroll">
                {files.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    className="ipf-item"
                    data-selected={value === f.url ? "true" : "false"}
                    onSelect={() => onChange(f.url)}
                  >
                    <div className="ipf-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.url}
                        alt={f.name}
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="ipf-name">{displayName(f)}</span>
                      <span className="ipf-cid">{f.cid.slice(0, 20)}…</span>
                    </div>
                    {value === f.url && <CheckCircle2 size={15} className="ipf-check" />}
                  </DropdownMenuItem>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* URL input */}
      <div className="ipf-url-wrap">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="or paste IPFS / HTTP URL…"
          style={{ paddingRight: previewUrl ? "42px" : undefined, fontSize: "12px" }}
        />
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="preview"
            className="ipf-preview-thumb"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>
    </>
  );
}