/**
 * Upload validation for plant images.
 *
 * No user-supplied bytes are ever written to disk: the validated buffer is sent
 * straight to the Python inference service, which removes any path-traversal or
 * temp-file cleanup risk entirely.
 */

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"] as const;

export function maxUploadBytes(): number {
  const mb = Number(process.env.PLANT_MAX_UPLOAD_MB ?? 8);
  return (Number.isFinite(mb) && mb > 0 ? mb : 8) * 1024 * 1024;
}

export interface ImageValidationResult {
  ok: boolean;
  reason?: string;
  status?: number;
  detectedType?: string;
}

function sniffType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return "image/bmp";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Validates size, declared MIME type and the real file signature (magic bytes). */
export function validateImageBuffer(buffer: Buffer, declaredType?: string | null): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: "The uploaded file is empty.", status: 400 };
  }
  if (buffer.length > maxUploadBytes()) {
    return {
      ok: false,
      reason: `The uploaded file is larger than the ${Math.round(maxUploadBytes() / (1024 * 1024))} MB limit.`,
      status: 413,
    };
  }
  const detected = sniffType(buffer);
  if (!detected) {
    return {
      ok: false,
      reason: "Only real JPEG, PNG, WebP or BMP images are accepted (file content could not be verified).",
      status: 415,
    };
  }
  if (declaredType && !ALLOWED_MIME_TYPES.includes(declaredType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      ok: false,
      reason: `Unsupported content type '${declaredType}'. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}.`,
      status: 415,
    };
  }
  if (declaredType && declaredType !== detected) {
    return {
      ok: false,
      reason: `Declared content type '${declaredType}' does not match the file's real content ('${detected}').`,
      status: 415,
    };
  }
  return { ok: true, detectedType: detected };
}

/** Strips any directory component so a client filename can never influence a path. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  return base.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "upload";
}

export function parseDataUrl(input: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(input);
  if (!match) return null;
  try {
    return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "anon";
}
