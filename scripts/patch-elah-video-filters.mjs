import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = join(process.cwd(), "node_modules", "@elah", "core");
const marker = "INKFRAME_VIDEO_FILTER_PATCH_V1";
const exportResetMarker = "INKFRAME_VIDEO_FILTER_RESET_PATCH_V2";
const paths = {
  packageJson: join(packageRoot, "package.json"),
  types: join(packageRoot, "dist", "types", "index.d.ts"),
  sceneTypes: join(packageRoot, "dist", "resolver", "scene.d.ts"),
  resolver: join(packageRoot, "dist", "resolver", "resolveTimeline.js"),
  shader: join(packageRoot, "dist", "renderer", "gpu", "shaders", "quad.frag.js"),
  videoLayer: join(packageRoot, "dist", "renderer", "gpu", "layers", "VideoLayer.js"),
  exportWorker: join(packageRoot, "dist", "export", "ExportWorker.js"),
};

const packageJson = JSON.parse(await readFile(paths.packageJson, "utf8"));
if (packageJson.version !== "0.4.1") {
  throw new Error(`Inkframe's video-filter patch targets @elah/core 0.4.1, found ${packageJson.version}.`);
}

const filterType = `    /** ${marker}: export-safe color adjustments. */
    videoFilter?: {
        brightness: number;
        contrast: number;
        saturation: number;
        sepia: number;
        grayscale: number;
        hueRotate: number;
    };`;

for (const path of [paths.types, paths.sceneTypes]) {
  let source = await readFile(path, "utf8");
  if (!source.includes(marker)) {
    const insertion = path === paths.types
      ? "    opacity?: number;"
      : "    volume: number;";
    if (!source.includes(insertion)) throw new Error(`Unable to locate video-filter type insertion in ${path}.`);
    source = source.replace(insertion, `${insertion}\n${filterType}`);
    await writeFile(path, source);
  }
}

let resolver = await readFile(paths.resolver, "utf8");
if (!resolver.includes(marker)) {
  const field = "                    ...(clip.transform ? { transform: clip.transform } : {}),\n                };\n                scene.videos.push(active);";
  if (!resolver.includes(field)) throw new Error("Unable to locate Elah's active video resolver.");
  resolver = resolver.replace(
    field,
    `                    ...(clip.transform ? { transform: clip.transform } : {}),\n                    // ${marker}: carry color adjustments into preview and export scenes.\n                    ...(clip.videoFilter ? { videoFilter: clip.videoFilter } : {}),\n                };\n                scene.videos.push(active);`,
  );
  await writeFile(paths.resolver, resolver);
}

let shader = await readFile(paths.shader, "utf8");
shader = shader.replaceAll("\r\n", "\n");
const originalShaderBody = `uniform float uOpacity;

in vec2 vTexCoord;
out vec4 fragColor;

void main() {
  vec4 texel = texture(uTexture, vTexCoord);
  fragColor = vec4(texel.rgb * uOpacity, texel.a * uOpacity);
}`;
const legacyFilteredShaderBody = `uniform float uOpacity;
// ${marker}: GPU color grade matching the Canvas2D export filter chain.
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uSepia;
uniform float uGrayscale;
uniform float uHueRotate;

in vec2 vTexCoord;
out vec4 fragColor;

vec3 hueRotate(vec3 color, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat3 matrix = mat3(
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
  );
  return matrix * color;
}

void main() {
  vec4 texel = texture(uTexture, vTexCoord);
  vec3 color = texel.rgb * uBrightness;
  color = (color - 0.5) * uContrast + 0.5;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation);
  vec3 sepiaColor = vec3(
    dot(color, vec3(0.393, 0.769, 0.189)),
    dot(color, vec3(0.349, 0.686, 0.168)),
    dot(color, vec3(0.272, 0.534, 0.131))
  );
  color = mix(color, sepiaColor, uSepia);
  luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(color, vec3(luma), uGrayscale);
  color = hueRotate(color, radians(uHueRotate));
  fragColor = vec4(clamp(color, 0.0, 1.0) * uOpacity, texel.a * uOpacity);
}`;

// The v1 WebGL shader produced white frames on some Chromium/GPU combinations.
// Keep Elah's proven pass-through preview shader; Inkframe applies its live grade
// as a CSS filter on the preview surface and retains Canvas2D grading for export.
if (shader.includes(legacyFilteredShaderBody)) {
  shader = shader.replace(legacyFilteredShaderBody, originalShaderBody);
  await writeFile(paths.shader, shader);
}

let videoLayer = await readFile(paths.videoLayer, "utf8");
const legacyUniformBlock = `        // ${marker}: apply per-clip color grade in the WebGL preview.
        const filter = item.videoFilter ?? {};
        this._program.setUniform1f(ctx.gl, 'uBrightness', filter.brightness ?? 1);
        this._program.setUniform1f(ctx.gl, 'uContrast', filter.contrast ?? 1);
        this._program.setUniform1f(ctx.gl, 'uSaturation', filter.saturation ?? 1);
        this._program.setUniform1f(ctx.gl, 'uSepia', filter.sepia ?? 0);
        this._program.setUniform1f(ctx.gl, 'uGrayscale', filter.grayscale ?? 0);
        this._program.setUniform1f(ctx.gl, 'uHueRotate', filter.hueRotate ?? 0);
`;
if (videoLayer.includes(legacyUniformBlock)) {
  videoLayer = videoLayer.replace(legacyUniformBlock, "");
  await writeFile(paths.videoLayer, videoLayer);
}

let exportWorker = await readFile(paths.exportWorker, "utf8");
if (!exportWorker.includes(marker)) {
  const videoDraw = "            if (wrapped) {\n                drawMedia(ctx, wrapped.canvas, entry.item.transform, stageW, stageH);";
  if (!exportWorker.includes(videoDraw)) throw new Error("Unable to locate Elah's export video draw call.");
  exportWorker = exportWorker.replace(
    videoDraw,
    `            if (wrapped) {\n                // ${marker}: Canvas2D uses the same adjustment order as the preview shader.\n                const filter = entry.item.videoFilter;\n                if (filter) {\n                    ctx.filter = [\n                        \`brightness(\${filter.brightness ?? 1})\`,\n                        \`contrast(\${filter.contrast ?? 1})\`,\n                        \`saturate(\${filter.saturation ?? 1})\`,\n                        \`sepia(\${filter.sepia ?? 0})\`,\n                        \`grayscale(\${filter.grayscale ?? 0})\`,\n                        \`hue-rotate(\${filter.hueRotate ?? 0}deg)\`,\n                    ].join(' ');\n                }\n                drawMedia(ctx, wrapped.canvas, entry.item.transform, stageW, stageH);`,
  );
  await writeFile(paths.exportWorker, exportWorker);
}

if (!exportWorker.includes(exportResetMarker)) {
  const markerIndex = exportWorker.indexOf(marker);
  const filteredDraw = "                drawMedia(ctx, wrapped.canvas, entry.item.transform, stageW, stageH);";
  const filteredDrawIndex = exportWorker.indexOf(filteredDraw, markerIndex);
  if (markerIndex < 0 || filteredDrawIndex < 0) {
    throw new Error("Unable to locate Elah's filtered export draw call for reset patching.");
  }
  exportWorker = `${exportWorker.slice(0, filteredDrawIndex)}${filteredDraw}
                // ${exportResetMarker}: never leak a video grade into text or later layers.
                ctx.filter = 'none';${exportWorker.slice(filteredDrawIndex + filteredDraw.length)}`;
  await writeFile(paths.exportWorker, exportWorker);
}

console.log(`Elah ${packageJson.version} video filters ready.`);
