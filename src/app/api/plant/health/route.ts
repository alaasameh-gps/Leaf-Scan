import { NextResponse } from "next/server";
import { inferenceHealth } from "../../../../lib/plant/inference";
import { llmEnabled } from "../../../../lib/plant/qa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const health = await inferenceHealth();
    return NextResponse.json({
      success: true,
      data: {
        service: "plant-inference",
        reachable: true,
        status: health.status,
        modelLoaded: health.model_loaded,
        numClasses: health.num_classes ?? null,
        modelInfo: health.model_info ?? null,
        detail: health.detail ?? null,
        optionalLlmEnabled: llmEnabled(),
        latencyMs: Date.now() - started,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: {
          service: "plant-inference",
          reachable: false,
          modelLoaded: false,
          optionalLlmEnabled: llmEnabled(),
          latencyMs: Date.now() - started,
        },
        message: (error as Error).message,
      },
      { status: 503 },
    );
  }
}
