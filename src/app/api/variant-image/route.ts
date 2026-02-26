// app/api/variant-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
// gif-encoder-2: pure JS GIF encoder, no native deps, works on Vercel + Node 24
import GIFEncoder from "gif-encoder-2";

// ─── Pinata config ──────────────────────────────────────────────────────────
const PINATA_JWT = process.env.PINATA_JWT!;
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
const PINATA_VARIANT_GROUP_ID = process.env.PINATA_VARIANT_GROUP_ID ?? null;

// ─── Types ───────────────────────────────────────────────────────────────────
export type PresetKey = "golden" | "shadow" | "crystal" | "inferno" | "spectral";

interface PresetConfig {
  label: string;
  tint: [number, number, number];
  opacityMin: number;
  opacityMax: number;
  blendMode: "screen" | "multiply";
  animationType: "shimmer" | "pulse" | "flicker" | "wave" | "glow";
  suffix: string;
}

export const VARIANT_PRESETS: Record<PresetKey, PresetConfig> = {
  golden:   { label: "✦ Golden",    tint: [255, 200,  50], opacityMin: 0.05, opacityMax: 0.45, blendMode: "screen",   animationType: "shimmer", suffix: "golden"   },
  shadow:   { label: "◈ Shadow",    tint: [ 60,   0, 120], opacityMin: 0.10, opacityMax: 0.55, blendMode: "multiply", animationType: "pulse",   suffix: "shadow"   },
  crystal:  { label: "❄ Crystal",   tint: [ 80, 200, 255], opacityMin: 0.05, opacityMax: 0.40, blendMode: "screen",   animationType: "wave",    suffix: "crystal"  },
  inferno:  { label: "🔥 Inferno",  tint: [255,  70,   0], opacityMin: 0.08, opacityMax: 0.45, blendMode: "screen",   animationType: "flicker", suffix: "inferno"  },
  spectral: { label: "👁 Spectral", tint: [140, 255, 140], opacityMin: 0.05, opacityMax: 0.40, blendMode: "screen",   animationType: "glow",    suffix: "spectral" },
};

// ─── Opacity curve (identical logic to original) ─────────────────────────────
function getFrameOpacity(preset: PresetConfig, frameIndex: number, frameCount: number): number {
  const t = frameIndex / frameCount;
  const { opacityMin, opacityMax, animationType } = preset;
  const range = opacityMax - opacityMin;

  let factor: number;
  switch (animationType) {
    case "shimmer": factor = 0.5 - 0.5 * Math.cos(t * Math.PI * 2); break;
    case "pulse":   factor = Math.abs(Math.sin(t * Math.PI)); break;
    case "flicker": factor = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(t * Math.PI * 10 + Math.sin(t * 17) * 1.5))); break;
    case "wave":    factor = 0.5 + 0.5 * Math.cos(t * Math.PI * 2); break;
    case "glow":    factor = Math.pow(Math.abs(Math.sin(t * Math.PI * 2)), 0.4); break;
    default:        factor = 0.5;
  }

  return opacityMin + factor * range;
}

// ─── Build tint overlay buffer for a single frame ────────────────────────────
// sharp works with raw RGBA pixel buffers — we create a solid-colour RGBA
// overlay at the right opacity, then composite it over the base image.
// For "multiply" blend we pre-multiply the tint maths into the overlay pixels
// so that sharp's standard "over" composite produces the right visual result.

function buildTintOverlay(
  width: number,
  height: number,
  tint: [number, number, number],
  opacity: number,
  blendMode: "screen" | "multiply"
): Buffer {
  const pixels = width * height * 4;
  const buf = Buffer.alloc(pixels);
  const [r, g, b] = tint;

  // Pre-multiply alpha so the composite looks identical to the canvas approach
  const a = Math.round(opacity * 255);
  const pr = Math.round((r / 255) * a);
  const pg = Math.round((g / 255) * a);
  const pb = Math.round((b / 255) * a);

  // For multiply we invert: darken = base * tint, approximated by
  // filling with the tint colour at the given opacity with sharp's "multiply"
  // composite. We keep it simple — just vary alpha per frame.
  const fr = blendMode === "multiply" ? r : pr;
  const fg = blendMode === "multiply" ? g : pg;
  const fb = blendMode === "multiply" ? b : pb;
  const fa = a;

  for (let i = 0; i < pixels; i += 4) {
    buf[i]     = fr;
    buf[i + 1] = fg;
    buf[i + 2] = fb;
    buf[i + 3] = fa;
  }
  return buf;
}

// ─── Animated GIF builder using gif-encoder-2 (pure JS, no native deps) ──────
async function buildAnimatedGIF(
  sourceBuffer: Buffer,
  width: number,
  height: number,
  preset: PresetConfig,
  frameCount: number,
  delayMs: number
): Promise<Buffer> {
  const MAX_SIZE = 480;
  const scale = Math.min(1, MAX_SIZE / Math.max(width, height));
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);

  // Resize source once → raw RGBA pixels
  const baseRaw = await sharp(sourceBuffer)
    .resize(outW, outH)
    .ensureAlpha()
    .raw()
    .toBuffer();

  const sharpBlend = preset.blendMode === "multiply" ? "multiply" : "screen";

  // gif-encoder-2 expects Uint8Array of RGBA pixels per frame
  const encoder = new GIFEncoder(outW, outH, "neuquant", true);
  encoder.setDelay(delayMs);
  encoder.setRepeat(0);   // loop forever
  encoder.setQuality(10);
  encoder.start();

  for (let i = 0; i < frameCount; i++) {
    const opacity = getFrameOpacity(preset, i, frameCount);
    const overlayRaw = buildTintOverlay(outW, outH, preset.tint, opacity, preset.blendMode);

    // Composite tint over base → get raw RGBA pixels back
    const frameRaw = await sharp(baseRaw, { raw: { width: outW, height: outH, channels: 4 } })
      .composite([{
        input: overlayRaw,
        raw:   { width: outW, height: outH, channels: 4 },
        blend: sharpBlend,
      }])
      .raw()
      .toBuffer();

    encoder.addFrame(frameRaw as unknown as Uint8Array);
  }

  encoder.finish();

  const buf = encoder.out.getData();
  return Buffer.from(buf);
}

// ─── Pinata upload (unchanged from original) ─────────────────────────────────
async function uploadToPinata(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  groupId?: string | null
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("pinataMetadata", JSON.stringify({
    name: filename,
    keyvalues: { source: "gyategyate-variant-generator" },
  }));

  const pinataOptions: Record<string, unknown> = { cidVersion: 1 };
  if (groupId) pinataOptions.groupId = groupId;
  formData.append("pinataOptions", JSON.stringify(pinataOptions));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`Pinata upload failed: ${await res.text()}`);

  const json = await res.json();
  return `${PINATA_GATEWAY}/ipfs/${json.IpfsHash}`;
}

// ─── Route handler (unchanged from original) ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { sourceImageUrl, preset: presetKey, nftName, groupId } = await req.json();

    if (!sourceImageUrl || !presetKey)
      return NextResponse.json({ error: "sourceImageUrl and preset are required" }, { status: 400 });

    const preset = VARIANT_PRESETS[presetKey as PresetKey];
    if (!preset)
      return NextResponse.json({ error: `Unknown preset: ${presetKey}` }, { status: 400 });

    // 1. Fetch source image
    const imgRes = await fetch(sourceImageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch source image: ${imgRes.statusText}`);
    const rawInput = Buffer.from(await imgRes.arrayBuffer());

    const meta = await sharp(rawInput).metadata();
    const width  = meta.width  ?? 512;
    const height = meta.height ?? 512;

    const sourceBuffer = await sharp(rawInput).ensureAlpha().png().toBuffer();

    // 2. Build animated GIF — 20 frames @ 60ms = 1.2s loop (same as original)
    const gifBuffer = await buildAnimatedGIF(sourceBuffer, width, height, preset, 20, 60);

    // 3. Upload to Pinata
    const resolvedGroupId = groupId ?? PINATA_VARIANT_GROUP_ID;
    const safeName = (nftName ?? "nft").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${safeName}_${preset.suffix}_variant.gif`;
    const ipfsUrl = await uploadToPinata(gifBuffer, filename, "image/gif", resolvedGroupId);

    return NextResponse.json({ url: ipfsUrl, preset: presetKey });
  } catch (err: any) {
    console.error("[variant-image]", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}