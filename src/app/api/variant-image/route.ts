// app/api/variant-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import GIFEncoder from "gif-encoder-2";

// ─── Pinata config ───────────────────────────────────────────────────────────
const PINATA_JWT = process.env.PINATA_JWT!;
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
const PINATA_VARIANT_GROUP_ID = process.env.PINATA_VARIANT_GROUP_ID ?? null;

// ─── Types ───────────────────────────────────────────────────────────────────
export type PresetKey = "golden" | "shadow" | "crystal" | "inferno" | "spectral";

type RenderMode =
  | "tint"            // simple solid-colour tint (shadow, crystal, inferno, spectral)
  | "ur_gold"         // UR: cycling gold gradient + shimmer sweep + star particles
  | "legend_rainbow"; // Legend: prismatic hue-rotate + dual shimmer + twinkle stars

interface PresetConfig {
  label: string;
  renderMode: RenderMode;
  // tint mode only
  tint?: [number, number, number];
  opacityMin?: number;
  opacityMax?: number;
  blendMode?: "screen" | "multiply";
  animationType?: "shimmer" | "pulse" | "flicker" | "wave" | "glow";
  suffix: string;
}

export const VARIANT_PRESETS: Record<PresetKey, PresetConfig> = {
  golden: {
    label: "✦ Golden",
    renderMode: "ur_gold",
    suffix: "golden",
  },
  shadow: {
    label: "◈ Shadow",
    renderMode: "tint",
    tint: [60, 0, 120], opacityMin: 0.10, opacityMax: 0.55,
    blendMode: "multiply", animationType: "pulse",
    suffix: "shadow",
  },
  crystal: {
    label: "❄ Crystal",
    renderMode: "tint",
    tint: [80, 200, 255], opacityMin: 0.05, opacityMax: 0.40,
    blendMode: "screen", animationType: "wave",
    suffix: "crystal",
  },
  inferno: {
    label: "🔥 Inferno",
    renderMode: "tint",
    tint: [255, 70, 0], opacityMin: 0.08, opacityMax: 0.45,
    blendMode: "screen", animationType: "flicker",
    suffix: "inferno",
  },
  spectral: {
    label: "👁 Spectral",
    renderMode: "tint",
    tint: [140, 255, 140], opacityMin: 0.05, opacityMax: 0.40,
    blendMode: "screen", animationType: "glow",
    suffix: "spectral",
  },
};

// ─── Tint opacity curves ──────────────────────────────────────────────────────
function getFrameOpacity(
  animationType: PresetConfig["animationType"],
  opacityMin: number,
  opacityMax: number,
  frameIndex: number,
  frameCount: number
): number {
  const t = frameIndex / frameCount;
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

// ─── Colour helpers ───────────────────────────────────────────────────────────
function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function colorFromStops(
  stops: [number, number, number][],
  pos: number
): [number, number, number] {
  const n = stops.length;
  const scaled = Math.max(0, Math.min(n - 1, pos * (n - 1)));
  const lo = Math.floor(scaled);
  const hi = Math.min(lo + 1, n - 1);
  return lerpColor(stops[lo], stops[hi], scaled - lo);
}

/** Alpha-composite srcRGBA over dest pixel in-place (straight alpha) */
function blendOver(
  buf: Buffer, idx: number,
  sr: number, sg: number, sb: number, sa: number
) {
  const alpha = sa / 255;
  buf[idx]     = Math.min(255, Math.round(buf[idx]     * (1 - alpha) + sr * alpha));
  buf[idx + 1] = Math.min(255, Math.round(buf[idx + 1] * (1 - alpha) + sg * alpha));
  buf[idx + 2] = Math.min(255, Math.round(buf[idx + 2] * (1 - alpha) + sb * alpha));
  buf[idx + 3] = 255;
}

/** Screen blend src over dest pixel in-place */
function blendScreen(
  buf: Buffer, idx: number,
  sr: number, sg: number, sb: number, sa: number
) {
  const alpha = sa / 255;
  const nr = 255 - ((255 - buf[idx])     * (255 - sr) / 255);
  const ng = 255 - ((255 - buf[idx + 1]) * (255 - sg) / 255);
  const nb = 255 - ((255 - buf[idx + 2]) * (255 - sb) / 255);
  buf[idx]     = Math.min(255, Math.round(buf[idx]     * (1 - alpha) + nr * alpha));
  buf[idx + 1] = Math.min(255, Math.round(buf[idx + 1] * (1 - alpha) + ng * alpha));
  buf[idx + 2] = Math.min(255, Math.round(buf[idx + 2] * (1 - alpha) + nb * alpha));
  buf[idx + 3] = 255;
}

// ─── Deterministic star positions (fractions of image size) ──────────────────
const STAR_POSITIONS: [number, number][] = [
  [0.08, 0.12], [0.88, 0.08], [0.45, 0.22],
  [0.18, 0.45], [0.75, 0.38], [0.35, 0.68],
  [0.92, 0.55], [0.12, 0.78], [0.62, 0.85],
  [0.50, 0.50], [0.28, 0.30], [0.80, 0.72],
];

function drawStars(
  buf: Buffer, W: number, H: number,
  colors: [number, number, number][],
  baseAlpha: number,
  t: number,
  phaseSpeed: number
) {
  const starRadius = Math.max(2, Math.round(Math.min(W, H) * 0.018));
  for (let s = 0; s < STAR_POSITIONS.length; s++) {
    const [fx, fy] = STAR_POSITIONS[s];
    const cx = Math.round(fx * W);
    const cy = Math.round(fy * H);
    const phase = (t * phaseSpeed + s * 0.083) % 1;
    const starA = baseAlpha * (0.4 + 0.6 * Math.abs(Math.sin(phase * Math.PI * 2)));
    const col = colors[s % colors.length];
    for (let dy = -starRadius; dy <= starRadius; dy++) {
      for (let dx = -starRadius; dx <= starRadius; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > starRadius) continue;
        const falloff = 1 - dist / starRadius;
        const a = Math.round(starA * falloff * falloff * 255);
        blendOver(buf, (py * W + px) * 4, col[0], col[1], col[2], a);
      }
    }
  }
}

// ─── UR GOLD frame ────────────────────────────────────────────────────────────
// Matches: urGlowShift (cycling gold gradient), urShimmer (diagonal sweep),
//          ur-stars (gold dot particles), urBarPulse glow intensity
const GOLD_STOPS: [number, number, number][] = [
  [146, 64,  14],  // #92400e  dark amber
  [251, 191, 36],  // #fbbf24  bright gold
  [245, 158, 11],  // #f59e0b  mid gold
  [253, 230, 138], // #fde68a  pale gold
  [245, 158, 11],
  [251, 191, 36],
  [146, 64,  14],
];
const GOLD_STAR_COLORS: [number, number, number][] = [
  [251, 191, 36],
  [253, 230, 138],
  [255, 255, 200],
];

function buildURGoldFrame(
  base: Buffer, W: number, H: number,
  frameIndex: number, frameCount: number
): Buffer {
  const buf = Buffer.from(base);
  const t = frameIndex / frameCount;

  // urGlowShift: background-position 0%→100%→0% over loop
  const gradShift = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);

  // urShimmer sweep: diagonal band crossing left-to-right
  const sweepPos  = -0.3 + t * 1.6;
  const sweepW    = 0.18;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;

      // 1. Cycling gold gradient (screen blend, subtle)
      const diagPos = ((x / W * 0.6 + y / H * 0.4) + gradShift) % 1;
      const [gr, gg, gb] = colorFromStops(GOLD_STOPS, diagPos);
      blendScreen(buf, idx, gr, gg, gb, 85);

      // 2. Diagonal shimmer sweep (white-gold streak)
      const diag = x / W * 0.65 + y / H * 0.35;
      const dist = Math.abs(diag - sweepPos);
      if (dist < sweepW) {
        const f = 1 - dist / sweepW;
        const a = Math.round(0.55 * f * f * 255);
        blendOver(buf, idx, 253, 230, 138, a); // pale gold streak
      }
    }
  }

  // 3. Gold particle stars
  const starBaseAlpha = 0.45 + 0.35 * Math.abs(Math.sin(t * Math.PI * 2));
  drawStars(buf, W, H, GOLD_STAR_COLORS, starBaseAlpha, t, 1);

  return buf;
}

// ─── LEGEND RAINBOW frame ─────────────────────────────────────────────────────
// Matches: holographic (prismatic hue-rotate), lgdHoloSweep + lgdHoloSweep2
//          (two diagonal shimmer passes), lgdTwinkle star field, legend-nebula
const PRISM_STOPS: [number, number, number][] = [
  [255, 157, 226], // #ff9de2  pink
  [255, 214, 165], // #ffd6a5  peach
  [202, 255, 191], // #caffbf  mint
  [155, 246, 255], // #9bf6ff  cyan
  [160, 196, 255], // #a0c4ff  blue
  [189, 178, 255], // #bdb2ff  lavender
  [255, 157, 226], // back to pink (seamless)
];
const LEGEND_STAR_COLORS: [number, number, number][] = [
  [255, 157, 226], // pink
  [155, 246, 255], // cyan
  [189, 178, 255], // lavender
  [255, 255, 255], // white
  [202, 255, 191], // mint
];

function buildLegendRainbowFrame(
  base: Buffer, W: number, H: number,
  frameIndex: number, frameCount: number
): Buffer {
  const buf = Buffer.from(base);
  const t = frameIndex / frameCount;

  // Prismatic gradient shift (holographic: full loop over frameCount)
  const hueShift = t;

  // lgdHoloSweep: left→right diagonal
  const sweep1Pos = -0.2 + t * 1.4;
  // lgdHoloSweep2: right→left (opposite)
  const sweep2Pos = 1.2 - t * 1.4;
  const sweepW = 0.16;

  // Nebula pulse
  const nebulaCx = Math.round(W * 0.30);
  const nebulaCy = Math.round(H * 0.25);
  const nebulaR  = Math.round(Math.min(W, H) * 0.45);
  const nebulaA  = 0.08 + 0.05 * Math.sin(t * Math.PI * 2);

  // Second nebula (cyan, bottom-right)
  const nebula2Cx = Math.round(W * 0.75);
  const nebula2Cy = Math.round(H * 0.70);
  const nebulaA2  = 0.06 + 0.04 * Math.cos(t * Math.PI * 2);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;

      // 1. Prismatic tint (screen blend)
      const diagPos = ((x / W * 0.55 + y / H * 0.45) + hueShift) % 1;
      const [pr, pg, pb] = colorFromStops(PRISM_STOPS, diagPos);
      blendScreen(buf, idx, pr, pg, pb, 75);

      // 2. Pink nebula glow blob
      const nd = Math.sqrt((x - nebulaCx) ** 2 + (y - nebulaCy) ** 2) / nebulaR;
      if (nd < 1) {
        const nf = (1 - nd) * (1 - nd);
        blendOver(buf, idx, 255, 157, 226, Math.round(nebulaA * nf * 255));
      }

      // 3. Cyan nebula (bottom-right)
      const nd2 = Math.sqrt((x - nebula2Cx) ** 2 + (y - nebula2Cy) ** 2) / nebulaR;
      if (nd2 < 1) {
        const nf2 = (1 - nd2) * (1 - nd2);
        blendOver(buf, idx, 155, 246, 255, Math.round(nebulaA2 * nf2 * 255));
      }

      // 4. Shimmer sweep 1 (lgdHoloSweep — pink-cyan, left→right)
      const diag1 = x / W * 0.55 + y / H * 0.45;
      const dist1 = Math.abs(diag1 - sweep1Pos);
      if (dist1 < sweepW) {
        const f = 1 - dist1 / sweepW;
        const a1 = Math.round(0.45 * f * f * 255);
        const sc = colorFromStops(PRISM_STOPS, (diagPos + 0.15) % 1);
        blendOver(buf, idx, sc[0], sc[1], sc[2], a1);
      }

      // 5. Shimmer sweep 2 (lgdHoloSweep2 — blue-peach, right→left)
      const diag2 = x / W * 0.45 + y / H * 0.55;
      const dist2 = Math.abs(diag2 - sweep2Pos);
      if (dist2 < sweepW) {
        const f = 1 - dist2 / sweepW;
        const a2 = Math.round(0.35 * f * f * 255);
        const sc2 = colorFromStops(PRISM_STOPS, (diagPos + 0.45) % 1);
        blendOver(buf, idx, sc2[0], sc2[1], sc2[2], a2);
      }
    }
  }

  // 6. Twinkle star field (lgdTwinkle)
  const twinkleAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI * 2));
  drawStars(buf, W, H, LEGEND_STAR_COLORS, twinkleAlpha, t, 2);

  return buf;
}

// ─── Simple tint overlay (shadow, crystal, inferno, spectral) ────────────────
function buildTintOverlayRaw(
  W: number, H: number,
  tint: [number, number, number],
  opacity: number,
  blendMode: "screen" | "multiply"
): Buffer {
  const buf = Buffer.alloc(W * H * 4);
  const [r, g, b] = tint;
  const a = Math.round(opacity * 255);
  const pr = blendMode === "multiply" ? r : Math.round((r / 255) * a);
  const pg = blendMode === "multiply" ? g : Math.round((g / 255) * a);
  const pb = blendMode === "multiply" ? b : Math.round((b / 255) * a);
  for (let i = 0; i < W * H * 4; i += 4) {
    buf[i] = pr; buf[i + 1] = pg; buf[i + 2] = pb; buf[i + 3] = a;
  }
  return buf;
}

// ─── Main GIF builder ─────────────────────────────────────────────────────────
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

  const baseRaw = await sharp(sourceBuffer)
    .resize(outW, outH)
    .ensureAlpha()
    .raw()
    .toBuffer();

  const encoder = new GIFEncoder(outW, outH, "neuquant", true);
  encoder.setDelay(delayMs);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  for (let i = 0; i < frameCount; i++) {
    let frameRaw: Buffer;

    if (preset.renderMode === "ur_gold") {
      frameRaw = buildURGoldFrame(baseRaw, outW, outH, i, frameCount);

    } else if (preset.renderMode === "legend_rainbow") {
      frameRaw = buildLegendRainbowFrame(baseRaw, outW, outH, i, frameCount);

    } else {
      // Standard tint — use sharp composite (fast)
      const opacity = getFrameOpacity(
        preset.animationType!, preset.opacityMin!, preset.opacityMax!, i, frameCount
      );
      const overlayRaw = buildTintOverlayRaw(outW, outH, preset.tint!, opacity, preset.blendMode!);
      frameRaw = await sharp(baseRaw, { raw: { width: outW, height: outH, channels: 4 } })
        .composite([{
          input: overlayRaw,
          raw:   { width: outW, height: outH, channels: 4 },
          blend: preset.blendMode === "multiply" ? "multiply" : "screen",
        }])
        .raw()
        .toBuffer();
    }

    encoder.addFrame(frameRaw as unknown as Uint8Array);
  }

  encoder.finish();
  return Buffer.from(encoder.out.getData());
}

// ─── Pinata upload ────────────────────────────────────────────────────────────
async function uploadToPinata(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  groupId?: string | null
): Promise<string> {
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer], { type: mimeType }), filename);
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

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { sourceImageUrl, preset: presetKey, nftName, groupId } = await req.json();

    if (!sourceImageUrl || !presetKey)
      return NextResponse.json({ error: "sourceImageUrl and preset are required" }, { status: 400 });

    const preset = VARIANT_PRESETS[presetKey as PresetKey];
    if (!preset)
      return NextResponse.json({ error: `Unknown preset: ${presetKey}` }, { status: 400 });

    const imgRes = await fetch(sourceImageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch source image: ${imgRes.statusText}`);
    const rawInput = Buffer.from(await imgRes.arrayBuffer());

    const meta = await sharp(rawInput).metadata();
    const width  = meta.width  ?? 512;
    const height = meta.height ?? 512;
    const sourceBuffer = await sharp(rawInput).ensureAlpha().png().toBuffer();

    // Rich presets: 30 frames @ 50ms = 1.5s smooth loop
    // Tint presets: 20 frames @ 60ms = 1.2s
    const isRich = preset.renderMode !== "tint";
    const gifBuffer = await buildAnimatedGIF(
      sourceBuffer, width, height, preset,
      isRich ? 30 : 20,
      isRich ? 50 : 60
    );

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