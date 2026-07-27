import { useCallback, useEffect, useRef, useState } from "react";

// Duração máxima do clipe -- curto de propósito: mantém o arquivo pequeno
// (importante já que hoje fica tudo no IndexedDB do navegador) e obriga o
// jogador a ser direto na pose, sem enrolar.
export const MAX_CLIP_MS = 8_000;

type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus("ready");
    } catch {
      setStatus("denied");
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  const record = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const stream = streamRef.current;
      if (!stream) {
        reject(new Error("Câmera não iniciada"));
        return;
      }
      // video/webm é o formato que o MediaRecorder consegue gravar sem
      // plugin em todo navegador moderno (Chrome/Firefox/Edge no Android;
      // Safari/iOS só suporta a partir da v14.3+, com mp4 -- deixamos o
      // navegador escolher o mimeType suportado em vez de forçar um só).
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => reject(new Error("Falha ao gravar"));
      recorder.onstop = () => {
        setIsRecording(false);
        setElapsedMs(0);
        resolve(new Blob(chunksRef.current, { type: mimeType ?? "video/webm" }));
      };

      recorder.start();
      setIsRecording(true);

      const startedAt = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startedAt;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_CLIP_MS) {
          recorder.stop();
        } else if (recorder.state === "recording") {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  return { videoRef, status, isRecording, elapsedMs, start, stop, record, stopRecording };
}
