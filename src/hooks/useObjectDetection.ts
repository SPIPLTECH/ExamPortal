"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export type DetectionStatus = "LOADING" | "OK" | "NO_FACE" | "MULTIPLE" | "PHONE" | "IDLE";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  /** Fired (debounced) when a violation condition is confirmed. */
  onViolation: (eventType: "FACE_MISSING" | "MULTIPLE_FACES" | "PHONE_DETECTED", metadata?: Record<string, unknown>) => void;
  intervalMs?: number;
}

const PERSON_SCORE = 0.5;
const PHONE_SCORE = 0.45;
const STREAK_TO_CONFIRM = 2; // consecutive detections before reporting
const COOLDOWN_MS = 8000; // min gap between the same reported violation

/**
 * In-browser object detection (TensorFlow.js COCO-SSD) for live proctoring:
 * detects no person (face missing), more than one person, and a cell phone.
 * Mirrors the ProctorGuard AI classifications (NO_FACE / MULTIPLE_FACES /
 * PROHIBITED_OBJECT) but runs entirely client-side — no Python service needed.
 */
export function useObjectDetection({ videoRef, active, onViolation, intervalMs = 2000 }: Props) {
  const [status, setStatus] = useState<DetectionStatus>("IDLE");
  const [personCount, setPersonCount] = useState(0);
  const [ready, setReady] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null);
  const streakRef = useRef({ noFace: 0, multiple: 0, phone: 0 });
  const lastFiredRef = useRef({ FACE_MISSING: 0, MULTIPLE_FACES: 0, PHONE_DETECTED: 0 });
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    if (!active) {
      setStatus("IDLE");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fire = (type: "FACE_MISSING" | "MULTIPLE_FACES" | "PHONE_DETECTED", meta?: Record<string, unknown>) => {
      const now = Date.now();
      if (now - lastFiredRef.current[type] < COOLDOWN_MS) return;
      lastFiredRef.current[type] = now;
      onViolationRef.current(type, meta);
    };

    const loop = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const model = modelRef.current;
      if (model && video && video.readyState >= 2) {
        try {
          const preds: Array<{ class: string; score: number }> = await model.detect(video);
          const persons = preds.filter((p) => p.class === "person" && p.score >= PERSON_SCORE);
          const phones = preds.filter((p) => p.class === "cell phone" && p.score >= PHONE_SCORE);
          setPersonCount(persons.length);

          const s = streakRef.current;
          // Phone takes visual priority, then multiple people, then no face.
          if (phones.length > 0) {
            s.phone += 1;
            if (s.phone >= STREAK_TO_CONFIRM) fire("PHONE_DETECTED", { score: phones[0]!.score });
          } else s.phone = 0;

          if (persons.length > 1) {
            s.multiple += 1;
            if (s.multiple >= STREAK_TO_CONFIRM) fire("MULTIPLE_FACES", { count: persons.length });
          } else s.multiple = 0;

          if (persons.length === 0) {
            s.noFace += 1;
            if (s.noFace >= STREAK_TO_CONFIRM) fire("FACE_MISSING");
          } else s.noFace = 0;

          setStatus(
            phones.length > 0 ? "PHONE" : persons.length > 1 ? "MULTIPLE" : persons.length === 0 ? "NO_FACE" : "OK"
          );
        } catch {
          // transient; next tick retries
        }
      }
      if (!cancelled) timer = setTimeout(loop, intervalMs);
    };

    (async () => {
      setStatus("LOADING");
      try {
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();
        const cocoSsd = await import("@tensorflow-models/coco-ssd");
        if (cancelled) return;
        modelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" });
        if (cancelled) return;
        setReady(true);
        setStatus("OK");
        loop();
      } catch (err) {
        console.error("[detection] model load failed", err);
        setStatus("IDLE");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, videoRef, intervalMs]);

  return { status, personCount, ready };
}
