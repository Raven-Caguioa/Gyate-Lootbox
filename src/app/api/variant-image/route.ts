// app/api/variant-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import GIFEncoder from "gifencoder";
import { createCanvas, loadImage } from "canvas";

// ─── Pinata config ──────────────────────────────────────────────────────────
const PINATA_JWT = process.env.PINATA_JWT!;
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
const PINATA_VARIANT_GROUP_ID = process.env.PINATA_VARIANT_GROUP_ID ?? null;

// ─── Types ───────────────────────────────────────────────────────────────────
export type PresetKey = "golden" | "shadow" | "crystal" | "inferno" | "spectral";
type BlendMode = "screen" | "multiply";

interface PresetConfig {
  label: string;
  tint: [number, number, number];
  opacityMin: number;
  opacityMax: number;
  blendMode: BlendMode;
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

// ─── Opacity curve ───────────────────────────────────────────────────────────

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

// ─── Animated GIF builder ────────────────────────────────────────────────────

async function buildAnimatedGIF(
  sourceBuffer: Buffer,
  width: number,
  height: number,
  preset: PresetConfig,
  frameCount: number,
  delayMs: number
): Promise<Buffer> {
  // Cap size to keep GIF file manageable
  const MAX_SIZE = 480;
  const scale = Math.min(1, MAX_SIZE / Math.max(width, height));
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);

  // Resize source once
  const resizedPng = await sharp(sourceBuffer)
    .resize(outW, outH)
    .ensureAlpha()
    .png()
    .toBuffer();

  const baseImage = await loadImage(resizedPng);
  const [r, g, b] = preset.tint;

  const encoder = new GIFEncoder(outW, outH);
  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext("2d");

  // Collect GIF bytes via stream BEFORE calling start/finish
  const chunks: Buffer[] = [];
  const stream = encoder.createReadStream();
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));

  const gifDone = new Promise<Buffer>((resolve, reject) => {
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

  encoder.start();
  encoder.setRepeat(0);    // 0 = loop forever
  encoder.setDelay(delayMs);
  encoder.setQuality(10);

  for (let i = 0; i < frameCount; i++) {
    const opacity = getFrameOpacity(preset, i, frameCount);

    // Draw base image
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(baseImage, 0, 0, outW, outH);

    // Overlay tint using canvas blend mode
    ctx.globalCompositeOperation = preset.blendMode === "screen" ? "screen" : "multiply";
    ctx.globalAlpha = opacity;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, outW, outH);

    // Reset composite state
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    encoder.addFrame(ctx as any);
  }

  encoder.finish();

  return gifDone;
}

// ─── Pinata upload ───────────────────────────────────────────────────────────

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

// ─── Route handler ───────────────────────────────────────────────────────────

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

    // 2. Build animated GIF — 20 frames @ 60ms = 1.2s loop
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