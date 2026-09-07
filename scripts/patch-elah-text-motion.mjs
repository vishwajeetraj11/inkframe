import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = join(process.cwd(), "node_modules", "@elah", "core");
const packageJsonPath = join(packageRoot, "package.json");
const resolverPath = join(packageRoot, "dist", "resolver", "resolveTimeline.js");
const typesPath = join(packageRoot, "dist", "types", "index.d.ts");
const exportPath = join(packageRoot, "dist", "export", "exportVideo.js");
const textLayerPath = join(packageRoot, "dist", "renderer", "gpu", "layers", "TextLayer.js");
const exportWorkerPath = join(packageRoot, "dist", "export", "ExportWorker.js");
const patchMarker = "INKFRAME_TEXT_MOTION_PATCH_V1";
const audioFadeMarker = "INKFRAME_AUDIO_FADE_PATCH_V1";
const textContrastMarker = "INKFRAME_TEXT_CONTRAST_PATCH_V1";

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

if (!resolverSource.includes(textContrastMarker)) {
  const textBranchStart = resolverSource.indexOf("            else if (clip.type === 'text') {");
  const textBranchEnd = resolverSource.indexOf(
    "            else if (clip.type === 'image' && clip.src) {",
    textBranchStart,
  );
  if (textBranchStart < 0 || textBranchEnd < 0) {
    throw new Error("Unable to locate Elah's active text branch for contrast patching.");
  }
  const textBranch = resolverSource.slice(textBranchStart, textBranchEnd);
  const alignmentField =
    "                    ...(clip.textAlign !== undefined ? { textAlign: clip.textAlign } : {}),";
  if (!textBranch.includes(alignmentField)) {
    throw new Error("Unable to locate Elah's resolved text alignment field.");
  }
  const patchedTextBranch = textBranch.replace(
    alignmentField,
    `${alignmentField}\n                    // ${textContrastMarker}: carry Inkframe's export-safe text outline.\n                    ...(clip.strokeColor !== undefined ? { strokeColor: clip.strokeColor } : {}),\n                    ...(clip.strokeWidth !== undefined ? { strokeWidth: clip.strokeWidth } : {}),`,
  );
  resolverSource = `${resolverSource.slice(0, textBranchStart)}${patchedTextBranch}${resolverSource.slice(textBranchEnd)}`;
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

let textLayerSource = await readFile(textLayerPath, "utf8");
if (!textLayerSource.includes(textContrastMarker)) {
  const fillLoop = `        layout.lines.forEach((line, i) => {
            ctx2d.fillText(line, layout.anchorX, layout.firstLineY + i * layout.lineAdvance);
        });`;
  if (!textLayerSource.includes(fillLoop)) {
    throw new Error("Unable to locate Elah's preview text paint loop.");
  }
  textLayerSource = textLayerSource.replace(
    fillLoop,
    `        // ${textContrastMarker}: draw an optional crisp outline beneath the text fill.
        ctx2d.lineJoin = 'round';
        ctx2d.strokeStyle = item.strokeColor ?? 'transparent';
        ctx2d.lineWidth = item.strokeWidth ?? 0;
        layout.lines.forEach((line, i) => {
            if ((item.strokeWidth ?? 0) > 0)
                ctx2d.strokeText(line, layout.anchorX, layout.firstLineY + i * layout.lineAdvance);
            ctx2d.fillText(line, layout.anchorX, layout.firstLineY + i * layout.lineAdvance);
        });`,
  );
  await writeFile(textLayerPath, textLayerSource);
}

let exportWorkerSource = await readFile(exportWorkerPath, "utf8");
if (!exportWorkerSource.includes(textContrastMarker)) {
  const exportFillLoop = `    for (let i = 0; i < layout.lines.length; i++) {
        ctx.fillText(layout.lines[i], layout.anchorX, layout.firstLineY + i * layout.lineAdvance);
    }`;
  if (!exportWorkerSource.includes(exportFillLoop)) {
    throw new Error("Unable to locate Elah's export text paint loop.");
  }
  exportWorkerSource = exportWorkerSource.replace(
    exportFillLoop,
    `    // ${textContrastMarker}: match the preview's optional text outline in MP4 exports.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = clip.strokeColor ?? 'transparent';
    ctx.lineWidth = clip.strokeWidth ?? 0;
    for (let i = 0; i < layout.lines.length; i++) {
        if ((clip.strokeWidth ?? 0) > 0)
            ctx.strokeText(layout.lines[i], layout.anchorX, layout.firstLineY + i * layout.lineAdvance);
        ctx.fillText(layout.lines[i], layout.anchorX, layout.firstLineY + i * layout.lineAdvance);
    }`,
  );
  await writeFile(exportWorkerPath, exportWorkerSource);
}

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

// Apply the shared deterministic evaluator only after legacy motion/fade hooks.
await import("./patch-elah-deterministic.mjs");
await import("./patch-elah-video-filters.mjs");

// INKFRAME_COLOR_GRADING_V1. Keep this after the legacy filter installer so a
// clean install and a previously patched 0.4.1 install converge to the same code.
// The pure TS implementation is the single source of pixel math for capture,
// preview textures, and the export worker. Generated files live only in dist.
const gradingMarker = "INKFRAME_COLOR_GRADING_V1";
const gradingOrientationMarker = "INKFRAME_COLOR_GRADING_ORIENTATION_V2";
const { default: ts } = await import("typescript");
const gradingSource = await readFile(join(process.cwd(), "src/lib/editor/color-grading.ts"), "utf8");
const gradingJs = ts.transpileModule(gradingSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
}).outputText;
const gradingRuntimePath = join(packageRoot, "dist", "inkframe-color-grading.mjs");
const gradingRuntime = gradingJs + `
// ${gradingMarker}: one reusable scratch surface per renderer/worker module.
// drawImage copies decoded media; never modify provider frames or cached assets.
let scratch;
// Public, media-free diagnostic. Set __INKFRAME_GRADING_DIAGNOSTICS__ = {}
// before a redraw to inspect the last upload; leave unset for no per-frame log.
globalThis.__INKFRAME_GRADING_RUNTIME__ = 'orientation-v2-diagnostic-v1';
export function gradeMedia(source, filter) {
    const legacyFilter = legacyVideoFilterToCss(filter);
    const needsGrade = hasColorGrade(filter);
    if (legacyFilter === 'none' && !needsGrade) return source;
    const width = source.displayWidth ?? source.naturalWidth ?? source.width;
    const height = source.displayHeight ?? source.naturalHeight ?? source.height;
    if (!(width > 0 && height > 0)) throw new Error('Inkframe grade: invalid media dimensions');
    if (!scratch) scratch = new OffscreenCanvas(width, height);
    if (scratch.width !== width) scratch.width = width;
    if (scratch.height !== height) scratch.height = height;
    const ctx = scratch.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
    if (!ctx) throw new Error('Inkframe grade: Canvas2D unavailable');
    if (legacyFilter !== 'none' && !('filter' in ctx)) throw new Error('Inkframe grade: Canvas2D filters unavailable');
    ctx.filter = legacyFilter;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    ctx.filter = 'none';
    if (needsGrade) {
        const image = ctx.getImageData(0, 0, width, height);
        applyColorGradeToPixels(image.data, filter);
        ctx.putImageData(image, 0, 0);
    }
    return scratch;
}

// ${gradingOrientationMarker}: provider ImageBitmaps already contain flipY.
// Unlike ImageBitmap, their graded canvas honors UNPACK_FLIP_Y_WEBGL. Preserve
// the original bitmap upload semantics, restoring shared GL state even on error.
export function uploadGradedVideo(texture, gl, frame, filter) {
    const graded = gradeMedia(frame, filter);
    const convertedBitmap = graded !== frame &&
        typeof ImageBitmap !== 'undefined' && frame instanceof ImageBitmap;
    const diagnostics = globalThis.__INKFRAME_GRADING_DIAGNOSTICS__;
    const diagnostic = diagnostics && typeof diagnostics === 'object' ? diagnostics : null;
    if (diagnostic) Object.assign(diagnostic, {
        runtime: 'orientation-v2-diagnostic-v1',
        uploads: (diagnostic.uploads ?? 0) + 1,
        sourceType: frame.constructor?.name ?? 'unknown',
        outputType: graded.constructor?.name ?? 'unknown',
        convertedBitmap,
        previousFlip: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),
        uploadFlip: convertedBitmap ? false : gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),
        restoredFlip: null,
        succeeded: false,
    });
    if (!convertedBitmap) {
        const uploaded = texture.upload(gl, graded);
        if (diagnostic) Object.assign(diagnostic, { succeeded: uploaded, restoredFlip: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) });
        return uploaded;
    }
    const previousFlip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        const uploaded = texture.upload(gl, graded);
        if (diagnostic) diagnostic.succeeded = uploaded;
        return uploaded;
    } finally {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, previousFlip);
        if (diagnostic) diagnostic.restoredFlip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    }
}
`;

// Validate every anchor before writing this extension. Unknown layouts fail
// loudly instead of silently shipping preview-only or export-only grading.
const gradingEdits = new Map();
function replaceOne(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error(`Inkframe grading: expected one ${label} anchor`);
  return source.replace(before, after);
}
const layerPaths = ["VideoLayer", "ImageLayer"].map(name => join(packageRoot, "dist/renderer/gpu/layers", `${name}.js`));
for (const [index, path] of layerPaths.entries()) {
  let source = await readFile(path, "utf8");
  if (!source.includes(gradingMarker)) {
    source = `// ${gradingMarker}\nimport { gradeMedia } from '../../../inkframe-color-grading.mjs';\n` + source;
    if (index === 0) {
      source = replaceOne(source, "texture.upload(ctx.gl, frame)", "texture.upload(ctx.gl, gradeMedia(frame, item.videoFilter))", "video texture upload");
    } else {
      source = replaceOne(source, "if (res.image && !res.uploaded) {", "const gradeKey = JSON.stringify(item.videoFilter ?? null);\n        if (res.image && (!res.uploaded || res.gradeKey !== gradeKey)) {", "image upload guard");
      source = replaceOne(source, "gl.UNSIGNED_BYTE, res.image.source);", "gl.UNSIGNED_BYTE, gradeMedia(res.image.source, item.videoFilter));", "image texture upload");
      source = replaceOne(source, "res.uploaded = true;", "res.uploaded = true;\n            res.gradeKey = gradeKey;", "image cache invalidation");
    }
  }
  if (index === 0 && !source.includes(gradingOrientationMarker)) {
    source = replaceOne(source,
      "import { gradeMedia } from '../../../inkframe-color-grading.mjs';",
      `// ${gradingOrientationMarker}\nimport { uploadGradedVideo } from '../../../inkframe-color-grading.mjs';`,
      "video grading orientation import");
    source = replaceOne(source,
      "texture.upload(ctx.gl, gradeMedia(frame, item.videoFilter))",
      "uploadGradedVideo(texture, ctx.gl, frame, item.videoFilter)",
      "video grading orientation upload");
  }
  gradingEdits.set(path, source);
}
let gradeResolver = await readFile(resolverPath, "utf8");
if (!gradeResolver.includes(gradingMarker)) {
  gradeResolver = replaceOne(gradeResolver, "    const byDepth = (a, b) => a.zIndex - b.zIndex;", `    // ${gradingMarker}: include images and synthetic transition participants.
    const grades = new Map(Object.values(project.clips).flat().map(clip => [clip.id, clip.videoFilter]));
    for (const item of [...scene.videos, ...scene.images]) {
        const filter = grades.get(item.id);
        if (filter) item.videoFilter = filter;
    }
    const byDepth = (a, b) => a.zIndex - b.zIndex;`, "scene grade propagation");
}
gradingEdits.set(resolverPath, gradeResolver);
let gradeWorker = await readFile(exportWorkerPath, "utf8");
if (!gradeWorker.includes(gradingMarker)) {
  gradeWorker = `// ${gradingMarker}\nimport { gradeMedia } from '../inkframe-color-grading.mjs';\n` + gradeWorker;
  const oldFilterBlock = /                \/\/ INKFRAME_VIDEO_FILTER_PATCH_V1: Canvas2D[^\n]*\n[\s\S]*?                ctx\.filter = 'none';/g;
  const matches = [...gradeWorker.matchAll(oldFilterBlock)];
  if (matches.length !== 1) throw new Error('Inkframe grading: expected one legacy export filter block');
  gradeWorker = gradeWorker.replace(oldFilterBlock, `                // INKFRAME_VIDEO_FILTER_PATCH_V1 / INKFRAME_VIDEO_FILTER_RESET_PATCH_V2: replaced by shared pixels.
                drawMedia(ctx, gradeMedia(wrapped.canvas, entry.item.videoFilter), entry.item.transform, stageW, stageH);`);
  gradeWorker = replaceOne(gradeWorker, "drawMedia(ctx, bitmap, entry.item.transform, stageW, stageH);", "drawMedia(ctx, gradeMedia(bitmap, entry.item.videoFilter), entry.item.transform, stageW, stageH);", "export image draw");
  gradeWorker = replaceOne(gradeWorker, "await createImageBitmap(wrapped.canvas);", "await createImageBitmap(gradeMedia(wrapped.canvas, fromVideo.videoFilter));", "export video transition snapshot");
  gradeWorker = replaceOne(gradeWorker, "transitionSnapshots.set(tr.id, { source: bmp, owned: false });", "transitionSnapshots.set(tr.id, { source: await createImageBitmap(gradeMedia(bmp, fromImage.videoFilter)), owned: true });", "export image transition snapshot");
}
gradingEdits.set(exportWorkerPath, gradeWorker);
const sceneTypesPath = join(packageRoot, "dist/resolver/scene.d.ts");
for (const path of [typesPath, sceneTypesPath]) {
  let source = await readFile(path, "utf8");
  if (!source.includes(gradingMarker)) {
    source = replaceOne(source, "        hueRotate: number;", `        hueRotate: number;
        /** ${gradingMarker} */
        exposure?: number;
        temperature?: number;
        tint?: number;
        shadows?: number;
        highlights?: number;
        toneCurve?: 'linear' | 'filmic';`, "native grading type");
    if (path === sceneTypesPath) {
      source = replaceOne(source, "export interface ActiveImageClip extends ActiveClipBase {", "export interface ActiveImageClip extends ActiveClipBase {\n    videoFilter?: ActiveVideoClip['videoFilter'];", "active image grade type");
    }
  }
  gradingEdits.set(path, source);
}
gradingEdits.set(gradingRuntimePath, gradingRuntime);
for (const [path, source] of gradingEdits) await writeFile(path, source);
console.log(`Elah ${packageJson.version} shared per-clip pixel grading ready.`);
