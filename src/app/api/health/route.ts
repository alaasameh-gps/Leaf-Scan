import { NextResponse } from "next/server";
import { inferenceHealth } from "../../../lib/plant/inference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let plant: Record<string, unknown> = { reachable: false, modelLoaded: false };
  try {
    const health = await inferenceHealth();
    plant = {
      reachable: true,
      status: health.status,
      modelLoaded: health.model_loaded,
      numClasses: health.num_classes ?? null,
    };
  } catch (error) {
    plant = { reachable: false, modelLoaded: false, detail: (error as Error).message };
  }

  return NextResponse.json({
    success: true,
    message: "ok",
    services: {
      database: process.env.MONGODB_URI ? "configured" : "not-configured",
      plantInference: plant,
    },
  });
}
