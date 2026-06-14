import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onRecorded: (file: File) => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceRecorder({ onRecorded }: Props) {
  const [phase, setPhase] = useState<"idle" | "recording" | "preview">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedSeconds = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // Strip codec suffix (e.g. "audio/webm;codecs=opus" → "audio/webm") so the
        // backend MIME allowlist can do a simple exact match.
        const mimeType = (mr.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioFile(file);
        setPhase("preview");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      recordedSeconds.current = 0;
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        recordedSeconds.current += 1;
        setSeconds(recordedSeconds.current);
      }, 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioFile(null);
    setPhase("idle");
  };

  const attach = () => {
    if (audioFile) {
      onRecorded(audioFile);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioFile(null);
      setPhase("idle");
    }
  };

  if (phase === "idle") {
    return (
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={startRecording}
        >
          <Mic className="w-4 h-4" />
          Record voice note
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
        <span className="text-sm font-mono text-destructive tabular-nums">{formatTime(seconds)}</span>
        <span className="text-sm text-muted-foreground flex-1">Recording…</span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="gap-1.5 h-7 px-2.5"
          onClick={stopRecording}
        >
          <Square className="w-3 h-3 fill-current" />
          Stop
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Volume2 className="w-4 h-4 shrink-0" />
        <span>Voice note preview · {formatTime(seconds)}</span>
      </div>
      {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={discard}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Discard
        </Button>
        <Button type="button" size="sm" className="gap-1.5 ml-auto" onClick={attach}>
          <Mic className="w-3.5 h-3.5" />
          Attach voice note
        </Button>
      </div>
    </div>
  );
}
