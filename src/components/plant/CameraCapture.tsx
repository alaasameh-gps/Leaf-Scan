"use client";
import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import type { Lang } from "../../lib/plant/client";

interface Props {
  lang: Lang;
  onCapture: (file: File, previewUrl: string) => void;
}

const TEXT = {
  ar: {
    start: "تشغيل الكاميرا",
    stop: "إيقاف الكاميرا",
    capture: "التقاط الصورة",
    starting: "جارٍ تشغيل الكاميرا...",
    insecure: "الكاميرا تعمل فقط على HTTPS أو localhost.",
    denied: "تم رفض الوصول إلى الكاميرا. اسمح بالوصول من إعدادات المتصفح ثم حاول مرة أخرى.",
    notFound: "لم يتم العثور على كاميرا على هذا الجهاز.",
    generic: "تعذّر تشغيل الكاميرا.",
    captureFailed: "فشل التقاط الصورة. حاول مرة أخرى.",
  },
  en: {
    start: "Start camera",
    stop: "Stop camera",
    capture: "Capture photo",
    starting: "Starting camera...",
    insecure: "The camera only works over HTTPS or on localhost.",
    denied: "Camera access was denied. Allow it in your browser settings and try again.",
    notFound: "No camera was found on this device.",
    generic: "The camera could not be started.",
    captureFailed: "Capturing the photo failed. Please try again.",
  },
} as const;

export default function CameraCapture({ lang, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = TEXT[lang];

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setStarting(false);
  };

  useEffect(() => stop, []);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t.insecure);
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") setError(t.denied);
      else if (name === "NotFoundError" || name === "OverconstrainedError") setError(t.notFound);
      else setError(t.generic);
      stop();
    } finally {
      setStarting(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError(t.captureFailed);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError(t.captureFailed);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(t.captureFailed);
          return;
        }
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file, URL.createObjectURL(blob));
        stop();
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-xl bg-gray-900 aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label={lang === "ar" ? "معاينة الكاميرا" : "Camera preview"}
          className={`h-full w-full object-contain ${active ? "" : "hidden"}`}
        />
        {!active && (
          <div className="text-center text-gray-300 p-6">
            <Camera size={40} className="mx-auto mb-3" />
            <p className="text-sm">{starting ? t.starting : t.start}</p>
            <p className="text-xs mt-2 text-gray-400">{lang === "ar" ? "متاح على HTTPS أو localhost" : "Available over HTTPS or localhost"}</p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 text-red-700 border border-red-200 p-3 text-sm">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-3">
        {!active ? (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            <Camera size={18} /> {t.start}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={capture}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700"
            >
              <Camera size={18} /> {t.capture}
            </button>
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              <CameraOff size={18} /> {t.stop}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
