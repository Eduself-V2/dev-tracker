import { useRef, useState } from "react";
import { Paperclip, X, FileText, FileSpreadsheet, Image, Upload, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACCEPTED = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.xls,.xlsx,.csv";
const ACCEPTED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "application/csv",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  compact?: boolean;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
  if (type === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
  if (type.startsWith("audio/")) return <Mic className="w-4 h-4 text-violet-500" />;
  return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadZone({ files, onChange, maxFiles = 5, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setError(null);
    const valid: File[] = [];
    for (const f of Array.from(incoming)) {
      if (!ACCEPTED_MIME.has(f.type)) {
        setError(`"${f.name}" is not allowed. Use images, PDF, Excel, or CSV.`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        setError(`"${f.name}" exceeds the 10 MB limit.`);
        continue;
      }
      valid.push(f);
    }
    const combined = [...files, ...valid].slice(0, maxFiles);
    onChange(combined);
  };

  const remove = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 cursor-pointer transition-colors text-sm
          ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
          ${compact ? "py-2" : "py-3"}`}
      >
        <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">
          {compact ? "Attach files" : "Drop files here or click to browse"}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground/60">
          Images, PDF, Excel, CSV · max 10 MB each
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
              {fileIcon(f.type)}
              <span className="flex-1 truncate min-w-0">{f.name}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={(e) => { e.stopPropagation(); remove(i); }}
              >
                <X className="w-3 h-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { Props as FileUploadZoneProps };
