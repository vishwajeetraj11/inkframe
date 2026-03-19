import { InspectorCard } from "@/components/editor/controls/InspectorCard";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";
import type { TextOverlay } from "@/lib/editor/types";
import {
  isChartCardStylePreset,
  isVoxTimelineStylePreset,
  TEXT_OVERLAY_FONT_FAMILIES,
  TEXT_OVERLAY_FONT_STYLES,
  TEXT_OVERLAY_STYLE_PRESET_LABELS,
  TEXT_OVERLAY_STYLE_PRESETS,
} from "@/lib/editor/types";
import { ChartCardInspector } from "./preset-inspectors/ChartCardInspector";
import { CreatedaleyOpenerInspector } from "./preset-inspectors/CreatedaleyOpenerInspector";
import { EditorialStatRingInspector } from "./preset-inspectors/EditorialStatRingInspector";
import { VoxTimelineInspector } from "./preset-inspectors/VoxTimelineInspector";
import { WorldMapFocusInspector } from "./preset-inspectors/WorldMapFocusInspector";
import {
  buildChartCardText,
  buildCreatedaleyOpenerText,
  buildEditorialStatRingText,
  buildVoxTimelineText,
  buildWorldMapFocusText,
  getEditableChartCardData,
  getEditableCreatedaleyOpenerData,
  getEditableEditorialStatRingData,
  getEditableVoxTimelineData,
  getEditableWorldMapFocusData,
  getSelectedWorldMapCountryName,
  getWorldMapCountryOptions,
  parseNumber,
} from "./utils";

interface TextOverlayInspectorProps {
  disabled?: boolean;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  overlay: TextOverlay;
}

export const TextOverlayInspector = ({
  disabled,
  onUpdateText,
  overlay,
}: TextOverlayInspectorProps) => {
  const chartCardData = isChartCardStylePreset(overlay.stylePreset)
    ? getEditableChartCardData(overlay.text)
    : null;
  const editorialStatRingData =
    overlay.stylePreset === "editorial-stat-ring"
      ? getEditableEditorialStatRingData(overlay.text)
      : null;
  const worldMapFocusData =
    overlay.stylePreset === "world-map-focus"
      ? getEditableWorldMapFocusData(overlay.text)
      : null;
  const createdaleyOpenerData =
    overlay.stylePreset === "createdaley-opener"
      ? getEditableCreatedaleyOpenerData(overlay.text)
      : null;
  const voxTimelineData =
    isVoxTimelineStylePreset(overlay.stylePreset)
      ? getEditableVoxTimelineData(overlay.text)
      : null;

  const updateChartCard = (
    updater: (
      current: ReturnType<typeof getEditableChartCardData>,
    ) => ReturnType<typeof getEditableChartCardData>,
  ) => {
    if (!chartCardData) {
      return;
    }

    onUpdateText(overlay.id, {
      text: buildChartCardText(updater(chartCardData)),
    });
  };

  const updateCreatedaleyOpener = (
    updater: (
      current: ReturnType<typeof getEditableCreatedaleyOpenerData>,
    ) => ReturnType<typeof getEditableCreatedaleyOpenerData>,
  ) => {
    if (!createdaleyOpenerData) {
      return;
    }

    onUpdateText(overlay.id, {
      text: buildCreatedaleyOpenerText(updater(createdaleyOpenerData)),
    });
  };

  const updateEditorialStatRing = (
    updater: (
      current: ReturnType<typeof getEditableEditorialStatRingData>,
    ) => ReturnType<typeof getEditableEditorialStatRingData>,
  ) => {
    if (!editorialStatRingData) {
      return;
    }

    onUpdateText(overlay.id, {
      text: buildEditorialStatRingText(updater(editorialStatRingData)),
    });
  };

  const updateWorldMapFocus = (
    updater: (
      current: ReturnType<typeof getEditableWorldMapFocusData>,
    ) => ReturnType<typeof getEditableWorldMapFocusData>,
  ) => {
    if (!worldMapFocusData) {
      return;
    }

    onUpdateText(overlay.id, {
      text: buildWorldMapFocusText(updater(worldMapFocusData)),
    });
  };

  const updateVoxTimeline = (
    updater: (
      current: ReturnType<typeof getEditableVoxTimelineData>,
    ) => ReturnType<typeof getEditableVoxTimelineData>,
  ) => {
    if (!voxTimelineData) {
      return;
    }

    onUpdateText(overlay.id, {
      text: buildVoxTimelineText(updater(voxTimelineData)),
    });
  };

  const selectedCountryName = worldMapFocusData
    ? getSelectedWorldMapCountryName(worldMapFocusData.country)
    : undefined;
  const countryOptions = selectedCountryName
    ? getWorldMapCountryOptions(selectedCountryName)
    : [];

  return (
    <InspectorCard title="Text Overlay">
      {createdaleyOpenerData ? (
        <CreatedaleyOpenerInspector
          data={createdaleyOpenerData}
          disabled={disabled}
          overlay={overlay}
          onUpdateOverlay={(patch) => onUpdateText(overlay.id, patch)}
          onUpdateText={updateCreatedaleyOpener}
        />
      ) : editorialStatRingData ? (
        <EditorialStatRingInspector
          data={editorialStatRingData}
          disabled={disabled}
          onUpdateText={updateEditorialStatRing}
        />
      ) : worldMapFocusData && selectedCountryName ? (
        <WorldMapFocusInspector
          countryOptions={countryOptions}
          data={worldMapFocusData}
          disabled={disabled}
          selectedCountryName={selectedCountryName}
          onUpdateText={updateWorldMapFocus}
        />
      ) : voxTimelineData ? (
        <VoxTimelineInspector
          data={voxTimelineData}
          disabled={disabled}
          overlay={overlay}
          onUpdateText={updateVoxTimeline}
        />
      ) : chartCardData ? (
        <ChartCardInspector
          data={chartCardData}
          disabled={disabled}
          overlay={overlay}
          onUpdateOverlay={(patch) => onUpdateText(overlay.id, patch)}
          onUpdateText={updateChartCard}
        />
      ) : (
        <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Text">
          <textarea
            disabled={disabled}
            value={overlay.text}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                text: event.currentTarget.value,
              });
            }}
            className="min-h-16 w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-200">
        <LabeledControl label="X (%)">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={overlay.x}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                x: parseNumber(event.currentTarget.value, overlay.x),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl label="Y (%)">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={overlay.y}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                y: parseNumber(event.currentTarget.value, overlay.y),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl label="Font Size">
          <input
            type="number"
            min={12}
            max={200}
            step={1}
            disabled={disabled}
            value={overlay.fontSize}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                fontSize: parseNumber(event.currentTarget.value, overlay.fontSize),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl label="Font Family">
          <select
            disabled={disabled}
            value={overlay.fontFamily}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                fontFamily: event.currentTarget.value as TextOverlay["fontFamily"],
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          >
            {TEXT_OVERLAY_FONT_FAMILIES.map((fontFamily) => (
              <option key={fontFamily} value={fontFamily}>
                {fontFamily}
              </option>
            ))}
          </select>
        </LabeledControl>

        <LabeledControl label="Font Weight">
          <input
            type="number"
            min={100}
            max={900}
            step={100}
            disabled={disabled}
            value={overlay.fontWeight}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                fontWeight: parseNumber(event.currentTarget.value, overlay.fontWeight),
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          />
        </LabeledControl>

        <LabeledControl label="Font Style">
          <select
            disabled={disabled}
            value={overlay.fontStyle}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                fontStyle: event.currentTarget.value as TextOverlay["fontStyle"],
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          >
            {TEXT_OVERLAY_FONT_STYLES.map((fontStyle) => (
              <option key={fontStyle} value={fontStyle}>
                {fontStyle}
              </option>
            ))}
          </select>
        </LabeledControl>

        <LabeledControl label="Style Preset">
          <select
            disabled={disabled}
            value={overlay.stylePreset}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                stylePreset: event.currentTarget.value as TextOverlay["stylePreset"],
              });
            }}
            className="w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1"
          >
            {TEXT_OVERLAY_STYLE_PRESETS.map((stylePreset) => (
              <option key={stylePreset} value={stylePreset}>
                {TEXT_OVERLAY_STYLE_PRESET_LABELS[stylePreset]}
              </option>
            ))}
          </select>
        </LabeledControl>

        <LabeledControl label="Color">
          <input
            type="color"
            disabled={disabled}
            value={overlay.color}
            onChange={(event) => {
              onUpdateText(overlay.id, {
                color: event.currentTarget.value,
              });
            }}
            className="h-8 w-full rounded border border-neutral-600 bg-neutral-900"
          />
        </LabeledControl>
      </div>
    </InspectorCard>
  );
};
