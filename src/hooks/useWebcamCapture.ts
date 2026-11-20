"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { uploadProctoringSnapshot, type SnapshotUploadResult } from "@/lib/proctoring/service";

export type CameraStatus = "IDLE" | "REQUESTING" | "READY" | "DENIED" | "UNSUPPORTED" | "ERROR";

interface Props {
  periodicIntervalSeconds?: number;
  autoStartPeriodic?: boolean;
  onAttemptEnded?: () => void;
}

/** Webcam capture + periodic evidence upload, ported from ProctorGuard. */
export function useWebcamCapture({
  periodicIntervalSeconds = 15,
  autoStartPeriodic = false,
  onAttemptEnded,
}: Props = {}) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const periodicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUploadingRef = useRef(false);
  const isEndedRef = useRef(false);

  const requestCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("UNSUPPORTED");
      setErrorMessage("Camera is not supported in this browser.");
      return false;
    }
    setCameraStatus("REQUESTING");
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraStatus("READY");
      return true;
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraStatus("DENIED");
        setErrorMessage("Camera access was denied. Allow camera permissions to continue.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraStatus("ERROR");
        setErrorMessage("No camera found on this device.");
      } else {
        setCameraStatus("ERROR");
        setErrorMessage(`Camera error: ${(err as Error).message}`);
      }
      return false;
    }
  }, []);

  /** Re-bind the existing stream to the current <video> element (after remounts). */
  const attachStream = useCallback(() => {
    const v = videoRef.current;
    if (v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      v.play().catch(() => {});
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (periodicTimerRef.current) clearTimeout(periodicTimerRef.current);
    setCameraStatus("IDLE");
  }, []);

  const captureFrameBlob = useCallback(async (): Promise<{ blob: Blob; capturedAt: string } | null> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedAt = new Date().toISOString();
    return new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b ? { blob: b, capturedAt } : null), "image/jpeg", 0.85)
    );
  }, []);

  const captureAndUpload = useCallback(
    async (type: "PRE_EXAM_IDENTITY" | "PERIODIC_SNAPSHOT" | "INCIDENT_SNAPSHOT"): Promise<SnapshotUploadResult | null> => {
      if (isEndedRef.current || isUploadingRef.current) return null;
      const foreground = type === "PRE_EXAM_IDENTITY";
      isUploadingRef.current = true;
      if (foreground) setIsCapturing(true);
      try {
        const frame = await captureFrameBlob();
        if (!frame) throw new Error("Video frame not available");
        const result = await uploadProctoringSnapshot(type, frame.blob, undefined, frame.capturedAt);
        return result;
      } catch (err) {
        if ((err as { code?: string }).code === "ATTEMPT_ENDED") {
          isEndedRef.current = true;
          if (periodicTimerRef.current) clearTimeout(periodicTimerRef.current);
          onAttemptEnded?.();
        } else if (foreground) {
          setErrorMessage((err as Error).message);
        }
        return null;
      } finally {
        isUploadingRef.current = false;
        if (foreground) setIsCapturing(false);
      }
    },
    [captureFrameBlob, onAttemptEnded]
  );

  // Periodic evidence capture loop.
  useEffect(() => {
    if (!autoStartPeriodic || cameraStatus !== "READY" || isEndedRef.current) return;
    const intervalMs = Math.max(5, periodicIntervalSeconds) * 1000;
    let cancelled = false;
    const schedule = () => {
      if (cancelled || isEndedRef.current) return;
      periodicTimerRef.current = setTimeout(async () => {
        if (cancelled || isEndedRef.current) return;
        await captureAndUpload("PERIODIC_SNAPSHOT").catch(() => {});
        schedule();
      }, intervalMs);
    };
    schedule();
    return () => {
      cancelled = true;
      if (periodicTimerRef.current) clearTimeout(periodicTimerRef.current);
    };
  }, [autoStartPeriodic, cameraStatus, periodicIntervalSeconds, captureAndUpload]);

  useEffect(() => stopCamera, [stopCamera]);

  return { videoRef, cameraStatus, errorMessage, isCapturing, requestCamera, stopCamera, captureAndUpload, attachStream };
}
