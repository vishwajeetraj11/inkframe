import { z } from "zod";
import type { WebMcpTool } from "@/lib/webmcp/types";
import {
  TEMPLATE_DEFINITIONS,
  getTemplateDefinition,
} from "@/lib/editor/templates";
import { TEXT_MOTION_TEMPLATE_DEFINITIONS } from "@/lib/text-motion/templates";

const MAX_OUTPUT_LENGTH = 1500;
const MAX_TEMPLATE_RESULTS = 20;

export const INKFRAME_ROUTES = [
  {
    id: "home",
    path: "/",
    label: "Home",
    description: "Inkframe product home and workspace picker.",
  },
  {
    id: "editor",
    path: "/editor",
    label: "Media Editor",
    description: "Timeline editor for clips, audio, and structured overlays.",
  },
  {
    id: "templates",
    path: "/templates",
    label: "Template Library",
    description: "Browse editorial motion templates.",
  },
  {
    id: "text-motion",
    path: "/text-motion",
    label: "AI Text Motion",
    description: "Create beat-synced kinetic typography.",
  },
  {
    id: "remote-renderer",
    path: "/remote-renderer",
    label: "Remote Renderer",
    description: "Renderer entry point used by the export environment.",
  },
] as const;

type InkframeRouteId = (typeof INKFRAME_ROUTES)[number]["id"];
type InkframeRoutePath = (typeof INKFRAME_ROUTES)[number]["path"];

const routeById = new Map(INKFRAME_ROUTES.map((route) => [route.id, route]));
const routeSchema = z.enum(
  INKFRAME_ROUTES.map((route) => route.id) as [InkframeRouteId, ...InkframeRouteId[]],
);
const editorTemplateIds = TEMPLATE_DEFINITIONS.map((template) => template.id);
const editorTemplateIdSchema = z.enum(
  editorTemplateIds as [string, ...string[]],
);
const templateKindSchema = z.enum(["all", "editor", "text-motion"]);

export interface InkframeWebMcpToolContext {
  /** Navigate only to one of the known, same-origin workspace paths. */
  navigate: (path: InkframeRoutePath | `/editor?template=${string}`) => void | Promise<void>;
}

const toJson = (value: unknown, maxLength = MAX_OUTPUT_LENGTH): string => {
  const serialized = JSON.stringify(value);
  return serialized.length <= maxLength
    ? serialized
    : JSON.stringify({ ok: false, error: "Response exceeded the response limit." });
};

const tool = <T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  execute: (input: z.infer<T>, signal: AbortSignal) => string | Promise<string>,
  readOnly = true,
): WebMcpTool => ({
  name,
  title: name
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" "),
  description,
  inputSchema: z.toJSONSchema(schema),
  annotations: { readOnlyHint: readOnly, untrustedContentHint: false },
  execute: async (input, options) => {
    if (options.signal.aborted) {
      throw options.signal.reason ?? new DOMException("Tool call aborted", "AbortError");
    }
    const result = await execute(schema.parse(input), options.signal);
    if (options.signal.aborted) {
      throw options.signal.reason ?? new DOMException("Tool call aborted", "AbortError");
    }
    return result;
  },
});

const templateRecords = [
  ...TEMPLATE_DEFINITIONS.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    kind: "editor" as const,
    route: "/editor" as const,
    stylePreset: template.stylePreset,
  })),
  ...TEXT_MOTION_TEMPLATE_DEFINITIONS.map((template) => ({
    id: template.id,
    name: template.label,
    description: template.statusMessage,
    kind: "text-motion" as const,
    route: "/text-motion" as const,
    stylePreset: undefined,
  })),
];

const listTemplates = (input: {
  query?: string;
  kind?: "all" | "editor" | "text-motion";
  limit?: number;
}): string => {
  const query = input.query?.toLocaleLowerCase();
  const filtered = templateRecords.filter((template) => {
    if (input.kind && input.kind !== "all" && template.kind !== input.kind) return false;
    if (!query) return true;
    return [template.id, template.name, template.description, template.stylePreset]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(query));
  });
  const requestedLimit = input.limit ?? MAX_TEMPLATE_RESULTS;
  const limited = filtered.slice(0, Math.min(requestedLimit, MAX_TEMPLATE_RESULTS));
  const records = limited.map(({ id, name, description, kind, route, stylePreset }) => ({
    id,
    name,
    kind,
    route,
    ...(stylePreset ? { stylePreset } : {}),
    description: description.slice(0, 100),
  }));

  // Keep the response useful even if catalog copy grows. Trim records until the
  // normal WebMCP response budget is met instead of returning an unbounded list.
  for (let count = records.length; count >= 0; count -= 1) {
    const result = {
      ok: true,
      templates: records.slice(0, count),
      total: filtered.length,
      returned: count,
      omitted: Math.max(0, filtered.length - count),
    };
    const serialized = JSON.stringify(result);
    if (serialized.length <= MAX_OUTPUT_LENGTH) return serialized;
  }

  return toJson({ ok: true, templates: [], total: filtered.length, returned: 0, omitted: filtered.length });
};

export const createInkframeWebMcpTools = (
  context: InkframeWebMcpToolContext,
): WebMcpTool[] => [
  tool(
    "inkframe_get_capabilities",
    "Read Inkframe capabilities and the safe, same-origin workspace routes.",
    z.object({}).strict(),
    () => toJson({
      ok: true,
      product: "Inkframe",
      capabilities: ["media-editor", "ai-text-motion", "motion-templates", "mp4-export"],
      routes: INKFRAME_ROUTES.map(({ id, path, label, description }) => ({ id, path, label, description })),
    }),
  ),
  tool(
    "inkframe_list_templates",
    "List and filter the bounded Inkframe template catalog.",
    z.object({
      query: z.string().trim().max(80).optional(),
      kind: templateKindSchema.optional(),
      limit: z.number().int().min(1).max(MAX_TEMPLATE_RESULTS).optional(),
    }).strict(),
    listTemplates,
  ),
  tool(
    "inkframe_navigate_workspace",
    "Navigate to a known Inkframe workspace route. Explicit confirmation is required because navigation can discard unsaved work.",
    z.object({ route: routeSchema, confirmed: z.literal(true) }).strict(),
    async ({ route }) => {
      const target = routeById.get(route);
      if (!target) throw new Error("Unknown workspace route");
      await context.navigate(target.path);
      return toJson({ ok: true, route: target.id, path: target.path });
    },
    false,
  ),
  tool(
    "inkframe_open_editor_template",
    "Open a validated editor template in the Inkframe media editor. Explicit confirmation is required because navigation can discard unsaved work.",
    z.object({ templateId: editorTemplateIdSchema, confirmed: z.literal(true) }).strict(),
    async ({ templateId }) => {
      if (!getTemplateDefinition(templateId)) throw new Error("Unknown editor template");
      const path = `/editor?template=${templateId}` as const;
      await context.navigate(path);
      return toJson({ ok: true, templateId, path });
    },
    false,
  ),
];

export type { InkframeRouteId, InkframeRoutePath };
