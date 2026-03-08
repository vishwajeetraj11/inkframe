import type { AspectPreset } from "../editor/types";
import {
  createDefaultTextMotionProject,
  createGridKineticTextMotionProject,
  createPhotoCardTextMotionProject,
} from "./defaults";
import type { TextMotionProject, TextMotionTemplate } from "./types";

export interface TextMotionTemplateDefinition {
  id: TextMotionTemplate;
  label: string;
  shortLabel: string;
  statusMessage: string;
  applyFirstImageToAllScenes?: boolean;
  createProject: (aspect: AspectPreset) => TextMotionProject;
}

export const TEXT_MOTION_TEMPLATE_DEFINITIONS: TextMotionTemplateDefinition[] = [
  {
    id: "default",
    label: "Default",
    shortLabel: "Default",
    statusMessage: "Loaded the default template.",
    createProject: createDefaultTextMotionProject,
  },
  {
    id: "grid-kinetic",
    label: "Grid Kinetic",
    shortLabel: "Grid",
    statusMessage: "Loaded the grid kinetic template.",
    createProject: createGridKineticTextMotionProject,
  },
  {
    id: "photo-card",
    label: "Photo Card",
    shortLabel: "Photo",
    statusMessage: "Loaded the photo card template.",
    applyFirstImageToAllScenes: true,
    createProject: createPhotoCardTextMotionProject,
  },
];

export const TEXT_MOTION_TEMPLATE_MAP = Object.fromEntries(
  TEXT_MOTION_TEMPLATE_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<TextMotionTemplate, TextMotionTemplateDefinition>;

export const getTextMotionTemplateDefinition = (
  template: TextMotionTemplate,
): TextMotionTemplateDefinition => TEXT_MOTION_TEMPLATE_MAP[template];
