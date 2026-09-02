import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = join(process.cwd(), "node_modules", "@elah", "core");
const packageJsonPath = join(packageRoot, "package.json");
const resolverPath = join(packageRoot, "dist", "resolver", "resolveTimeline.js");
const typesPath = join(packageRoot, "dist", "types", "index.d.ts");
const exportPath = join(packageRoot, "dist", "export", "exportVideo.js");
const patchMarker = "INKFRAME_TEXT_MOTION_PATCH_V1";
const audioFadeMarker = "INKFRAME_AUDIO_FADE_PATCH_V1";

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
if (packageJson.version !== "0.4.1") {
  throw new Error(
    `Inkframe's Elah text-motion patch targets @elah/core 0.4.1, found ${packageJson.version}.`,
  );
}

let resolverSource = await readFile(resolverPath, "utf8");
if (!resolverSource.includes(patchMarker)) {
  const startMarker = "            else if (clip.type === 'text') {";
  const endMarker = "            else if (clip.type === 'image' && clip.src) {";
  const start = resolverSource.indexOf(startMarker);
  const end = resolverSource.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error("Unable to locate Elah's text resolver block; dependency layout changed.");
  }

  const replacement = `            else if (clip.type === 'text') {
                // ${patchMarker}: keep richer Inkframe motion identical in preview and export.
                let resolvedOpacity = opacity;
                let resolvedContent = clip.content ?? '';
                let resolvedTransform = clip.transform ? { ...clip.transform } : undefined;
                const anim = clip.textAnimation;
                if (anim) {
                    const d = Math.max(1, anim.durationFrames);
                    const localFrame = frame - clip.startFrame;
                    const clamp01 = (value) => Math.max(0, Math.min(1, value));
                    const easeOutCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3);
                    const inProgress = easeOutCubic(localFrame / d);
                    const outProgress = easeOutCubic((clip.durationFrames - localFrame) / d);
                    const ensureTransform = () => {
                        if (!resolvedTransform) {
                            resolvedTransform = {
                                x: 0.5,
                                y: 0.5,
                                scale: 1,
                                rotation: 0,
                                anchor: { x: 0.5, y: 0.5 },
                            };
                        }
                        return resolvedTransform;
                    };
                    const revealWords = (content, progress) => {
                        const parts = content.split(/(\\s+)/);
                        const words = parts.filter((part) => part.trim().length > 0).length;
                        const visibleWords = Math.ceil(words * clamp01(progress));
                        let seen = 0;
                        return parts.filter((part) => {
                            if (part.trim().length === 0)
                                return seen < visibleWords;
                            seen += 1;
                            return seen <= visibleWords;
                        }).join('');
                    };
                    if (anim.in === 'fade') {
                        resolvedOpacity = Math.min(resolvedOpacity, inProgress);
                    }
                    else if (anim.in === 'rise') {
                        resolvedOpacity = Math.min(resolvedOpacity, inProgress);
                        ensureTransform().y += (1 - inProgress) * 0.06;
                    }
                    else if (anim.in === 'slide-left') {
                        resolvedOpacity = Math.min(resolvedOpacity, inProgress);
                        ensureTransform().x -= (1 - inProgress) * 0.08;
                    }
                    else if (anim.in === 'punch') {
                        resolvedOpacity = Math.min(resolvedOpacity, inProgress);
                        ensureTransform().scale *= 0.76 + 0.24 * inProgress;
                    }
                    else if (anim.in === 'typewriter') {
                        const characters = Array.from(resolvedContent);
                        resolvedContent = characters.slice(0, Math.ceil(characters.length * inProgress)).join('');
                    }
                    else if (anim.in === 'word-reveal') {
                        resolvedContent = revealWords(resolvedContent, inProgress);
                    }
                    if (anim.out === 'fade') {
                        resolvedOpacity = Math.min(resolvedOpacity, outProgress);
                    }
                    else if (anim.out === 'rise') {
                        resolvedOpacity = Math.min(resolvedOpacity, outProgress);
                        ensureTransform().y -= (1 - outProgress) * 0.05;
                    }
                    else if (anim.out === 'slide-left') {
                        resolvedOpacity = Math.min(resolvedOpacity, outProgress);
                        ensureTransform().x += (1 - outProgress) * 0.08;
                    }
                    else if (anim.out === 'punch') {
                        resolvedOpacity = Math.min(resolvedOpacity, outProgress);
                        ensureTransform().scale *= 0.84 + 0.16 * outProgress;
                    }
                    else if (anim.out === 'typewriter') {
                        const characters = Array.from(resolvedContent);
                        resolvedContent = characters.slice(0, Math.ceil(characters.length * outProgress)).join('');
                    }
                    else if (anim.out === 'word-reveal') {
                        resolvedContent = revealWords(resolvedContent, outProgress);
                    }
                }
                const active = {
                    type: 'text',
                    id: clip.id,
                    trackId: clip.trackId,
                    name: clip.name,
                    content: resolvedContent,
                    sourceFrame,
                    opacity: resolvedOpacity,
                    zIndex,
                    ...(resolvedTransform ? { transform: resolvedTransform } : {}),
                    ...(clip.fontSize !== undefined ? { fontSize: clip.fontSize } : {}),
                    ...(clip.color !== undefined ? { color: clip.color } : {}),
                    ...(clip.fontFamily !== undefined ? { fontFamily: clip.fontFamily } : {}),
                    ...(clip.fontWeight !== undefined ? { fontWeight: clip.fontWeight } : {}),
                    ...(clip.textAlign !== undefined ? { textAlign: clip.textAlign } : {}),
                };
                scene.texts.push(active);
            }
`;
  resolverSource = `${resolverSource.slice(0, start)}${replacement}${resolverSource.slice(end)}`;
  await writeFile(resolverPath, resolverSource);
}

let typesSource = await readFile(typesPath, "utf8");
const originalType = "export type TextAnimationKind = 'fade';";
const patchedType =
  "export type TextAnimationKind = 'fade' | 'rise' | 'slide-left' | 'punch' | 'typewriter' | 'word-reveal';";
if (typesSource.includes(originalType)) {
  typesSource = typesSource.replace(originalType, patchedType);
} else if (!typesSource.includes(patchedType)) {
  throw new Error("Unable to patch Elah's TextAnimationKind declaration.");
}

if (!typesSource.includes("fadeInFrames?: FrameCount;")) {
  const volumeType = "    volume?: number;";
  if (!typesSource.includes(volumeType)) {
    throw new Error("Unable to locate Elah's Clip volume declaration.");
  }
  typesSource = typesSource.replace(
    volumeType,
    `${volumeType}\n    /** ${audioFadeMarker}: browser-native gain automation. */\n    fadeInFrames?: FrameCount;\n    fadeOutFrames?: FrameCount;`,
  );
}
await writeFile(typesPath, typesSource);

if (!resolverSource.includes(audioFadeMarker)) {
  const volumeDeclaration = "            const volume = baseVolume * trackGain;";
  if (!resolverSource.includes(volumeDeclaration)) {
    throw new Error("Unable to locate Elah's resolved clip volume declaration.");
  }
  resolverSource = resolverSource.replace(
    volumeDeclaration,
    `${volumeDeclaration}\n            // ${audioFadeMarker}: resolve per-frame audio gain for preview playback.\n            const localAudioFrame = frame - clip.startFrame;\n            const fadeInFrames = Math.max(0, Math.min(clip.durationFrames, clip.fadeInFrames ?? 0));\n            const fadeOutFrames = Math.max(0, Math.min(clip.durationFrames, clip.fadeOutFrames ?? 0));\n            const fadeInGain = fadeInFrames > 0 ? Math.min(1, localAudioFrame / fadeInFrames) : 1;\n            const remainingAudioFrames = clip.durationFrames - localAudioFrame;\n            const fadeOutGain = fadeOutFrames > 0 ? Math.min(1, remainingAudioFrames / fadeOutFrames) : 1;\n            const resolvedAudioVolume = volume * Math.max(0, Math.min(fadeInGain, fadeOutGain));`,
  );
}

// Keep the audio-only gain assignment stable even if the upstream video block
// contains the same `volume, zIndex` sequence.
resolverSource = resolverSource.replace(
  "                    volume: resolvedAudioVolume,\n                    zIndex,\n                    ...(clip.transform ? { transform: clip.transform } : {}),\n                };\n                scene.videos.push(active);",
  "                    volume,\n                    zIndex,\n                    ...(clip.transform ? { transform: clip.transform } : {}),\n                };\n                scene.videos.push(active);",
);
const audioBranchStart = resolverSource.indexOf("            else if (clip.type === 'audio' && clip.src) {");
const audioBranchEnd = resolverSource.indexOf("            else if (clip.type === 'text') {", audioBranchStart);
if (audioBranchStart < 0 || audioBranchEnd < 0) {
  throw new Error("Unable to locate Elah's active audio resolver block.");
}
const audioBranch = resolverSource.slice(audioBranchStart, audioBranchEnd);
const patchedAudioBranch = audioBranch.replace(
  "                    volume,\n                    zIndex,",
  "                    volume: resolvedAudioVolume,\n                    zIndex,",
);
if (!patchedAudioBranch.includes("volume: resolvedAudioVolume")) {
  throw new Error("Unable to patch Elah's active audio volume field.");
}
resolverSource = `${resolverSource.slice(0, audioBranchStart)}${patchedAudioBranch}${resolverSource.slice(audioBranchEnd)}`;
await writeFile(resolverPath, resolverSource);

let exportSource = await readFile(exportPath, "utf8");
if (!exportSource.includes(audioFadeMarker)) {
  const exportGainBlock = `            const gain = ctx.createGain();
            gain.gain.value = clip.volume ?? 1;
            node.connect(gain).connect(ctx.destination);
            node.start(clip.startFrame / fps, clip.sourceStartFrame / fps, clip.durationFrames / fps);`;
  if (!exportSource.includes(exportGainBlock)) {
    throw new Error("Unable to locate Elah's export audio gain block.");
  }
  const patchedExportGainBlock = `            const gain = ctx.createGain();
            // ${audioFadeMarker}: schedule the same fades used by preview playback.
            const clipStartSec = clip.startFrame / fps;
            const clipDurationSec = clip.durationFrames / fps;
            const clipEndSec = clipStartSec + clipDurationSec;
            const baseVolume = clip.volume ?? 1;
            const rawFadeInSec = Math.max(0, Math.min(clipDurationSec, (clip.fadeInFrames ?? 0) / fps));
            const rawFadeOutSec = Math.max(0, Math.min(clipDurationSec, (clip.fadeOutFrames ?? 0) / fps));
            const fadeScale = Math.max(1, (rawFadeInSec + rawFadeOutSec) / Math.max(clipDurationSec, 0.001));
            const fadeInSec = rawFadeInSec / fadeScale;
            const fadeOutSec = rawFadeOutSec / fadeScale;
            gain.gain.setValueAtTime(fadeInSec > 0 ? 0 : baseVolume, clipStartSec);
            if (fadeInSec > 0)
                gain.gain.linearRampToValueAtTime(baseVolume, clipStartSec + fadeInSec);
            if (fadeOutSec > 0) {
                gain.gain.setValueAtTime(baseVolume, Math.max(clipStartSec + fadeInSec, clipEndSec - fadeOutSec));
                gain.gain.linearRampToValueAtTime(0, clipEndSec);
            }
            node.connect(gain).connect(ctx.destination);
            node.start(clipStartSec, clip.sourceStartFrame / fps, clipDurationSec);`;
  exportSource = exportSource.replace(exportGainBlock, patchedExportGainBlock);
  await writeFile(exportPath, exportSource);
}

console.log(`Elah ${packageJson.version} text motion and audio fades ready.`);
