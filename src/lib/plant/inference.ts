/**
 * Client for the local Python inference service (ml/service/app.py).
 *
 * PyTorch inference runs in a separate process so the Node.js event loop is
 * never blocked. If the service is unavailable the caller receives a typed
 * error and the UI shows a clear message instead of pretending an image was
 * analysed.
 */

export interface ServicePrediction {
  class_name: string;
  display_name: string;
  crop: string | null;
  condition: string | null;
  is_healthy: boolean;
  is_background: boolean;
  score: number;
  rank: number;
}

export interface ServicePredictionResult {
  predictions: ServicePrediction[];
  top: ServicePrediction | null;
  confidence: number;
  confident: boolean;
  warnings: string[];
  model_metrics: Record<string, unknown> | null;
  model_info: Record<string, unknown> | null;
}

export interface ServiceHealth {
  status: string;
  model_loaded: boolean;
  model_path: string;
  num_classes?: number;
  model_info?: Record<string, unknown>;
  detail?: string;
}

export class InferenceServiceError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "InferenceServiceError";
    this.status = status;
  }
}

const DEFAULT_URL = "http://127.0.0.1:8000";

function serviceUrl(): string {
  return (process.env.PLANT_SERVICE_URL || DEFAULT_URL).replace(/\/+$/, "");
}

async function callService<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = process.env.PLANT_SERVICE_TOKEN;
  try {
    const response = await fetch(`${serviceUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-plant-token": token } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String((payload as { detail: unknown }).detail)
          : `Inference service responded with status ${response.status}`;
      throw new InferenceServiceError(detail, response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof InferenceServiceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new InferenceServiceError("The inference service timed out. Please try again.", 504);
    }
    throw new InferenceServiceError(
      `The plant inference service is not reachable at ${serviceUrl()}. Start it with: ` +
        "py -3.12 -m uvicorn ml.service.app:app --host 127.0.0.1 --port 8000",
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function predictImage(imageBase64: string, topK = 3, timeoutMs = 30000): Promise<ServicePredictionResult> {
  return callService<ServicePredictionResult>(
    "/predict",
    { method: "POST", body: JSON.stringify({ image_base64: imageBase64, top_k: topK }) },
    timeoutMs,
  );
}

export async function inferenceHealth(): Promise<ServiceHealth> {
  return callService<ServiceHealth>("/health", { method: "GET" }, 5000);
}
