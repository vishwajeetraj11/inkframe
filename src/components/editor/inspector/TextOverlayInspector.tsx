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
import { RegionalMapFocusInspector } from "./preset-inspectors/RegionalMapFocusInspector";
import { VoxTimelineInspector } from "./preset-inspectors/VoxTimelineInspector";
import { WorldMapFocusInspector } from "./preset-inspectors/WorldMapFocusInspector";
import {
  buildChartCardText,
  buildCreatedaleyOpenerText,
  buildEditorialStatRingText,
  buildRegionalMapFocusText,
  buildVoxTimelineText,
  buildWorldMapFocusText,
  getEditableChartCardData,
  getEditableCreatedaleyOpenerData,
  getEditableEditorialStatRingData,
  getEditableRegionalMapFocusData,
  getEditableVoxTimelineData,
  getEditableWorldMapFocusData,
  getOptionalWorldMapCountryName,
  getSelectedWorldMapCountryName,
  getWorldMapCountryOptions,
  parseNumber,
} from "./utils";

const INSPECTOR_INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-neutral-950/70 px-3 py-2.5 text-sm text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/12";
const INSPECTOR_COLOR_INPUT_CLASS =
  "h-11 w-full rounded-xl border border-white/10 bg-neutral-950/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/12";

/**
 * Factory for creating preset-specific update handlers
 * Reduces boilerplate for handlers that follow the same pattern:
 * - Check if data exists
 * - Apply updater function to data
 * - Build text from updated data
 * - Call onUpdateText with new text
 */
const createPresetUpdateHandler =
  <TData,>(
    data: TData | null,
    builder: (data: TData) => string,
    onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void,
    overlayId: string,
  ) =>
  (updater: (current: TData) => TData) => {
    if (!data) {
      return;
    }
    onUpdateText(overlayId, {
      text: builder(updater(data)),
    });
  };

interface TextOverlayInspectorProps {
  disabled?: boolean;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  overlay: TextOverlay;
}

interface InspectorRendererProps {
  overlay: TextOverlay;
  disabled?: boolean;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  chartCardData: ReturnType<typeof getEditableChartCardData> | null;
  editorialStatRingData: ReturnType<typeof getEditableEditorialStatRingData> | null;
  worldMapFocusData: ReturnType<typeof getEditableWorldMapFocusData> | null;
  regionalMapFocusData: ReturnType<typeof getEditableRegionalMapFocusData> | null;
  createdaleyOpenerData: ReturnType<typeof getEditableCreatedaleyOpenerData> | null;
  voxTimelineData: ReturnType<typeof getEditableVoxTimelineData> | null;
  updateChartCard: (updater: (current: ReturnType<typeof getEditableChartCardData>) => ReturnType<typeof getEditableChartCardData>) => void;
  updateCreatedaleyOpener: (updater: (current: ReturnType<typeof getEditableCreatedaleyOpenerData>) => ReturnType<typeof getEditableCreatedaleyOpenerData>) => void;
  updateEditorialStatRing: (updater: (current: ReturnType<typeof getEditableEditorialStatRingData>) => ReturnType<typeof getEditableEditorialStatRingData>) => void;
  updateWorldMapFocus: (updater: (current: ReturnType<typeof getEditableWorldMapFocusData>) => ReturnType<typeof getEditableWorldMapFocusData>) => void;
  updateRegionalMapFocus: (updater: (current: ReturnType<typeof getEditableRegionalMapFocusData>) => ReturnType<typeof getEditableRegionalMapFocusData>) => void;
  updateVoxTimeline: (updater: (current: ReturnType<typeof getEditableVoxTimelineData>) => ReturnType<typeof getEditableVoxTimelineData>) => void;
  selectedCountryName?: string;
  countryOptions: string[];
  selectedRegionalPrimaryCountryName?: string;
  selectedRegionalSecondaryCountryName: string;
  regionalCountryOptions: string[];
}

const renderPresetInspector = (props: {
  createdaleyOpenerData: ReturnType<typeof getEditableCreatedaleyOpenerData> | null;
  editorialStatRingData: ReturnType<typeof getEditableEditorialStatRingData> | null;
  worldMapFocusData: ReturnType<typeof getEditableWorldMapFocusData> | null;
  regionalMapFocusData: ReturnType<typeof getEditableRegionalMapFocusData> | null;
  voxTimelineData: ReturnType<typeof getEditableVoxTimelineData> | null;
  chartCardData: ReturnType<typeof getEditableChartCardData> | null;
  overlay: TextOverlay;
  disabled?: boolean;
  onUpdateText: (overlayId: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  updateCreatedaleyOpener: (updater: (current: ReturnType<typeof getEditableCreatedaleyOpenerData>) => ReturnType<typeof getEditableCreatedaleyOpenerData>) => void;
  updateEditorialStatRing: (updater: (current: ReturnType<typeof getEditableEditorialStatRingData>) => ReturnType<typeof getEditableEditorialStatRingData>) => void;
  updateWorldMapFocus: (updater: (current: ReturnType<typeof getEditableWorldMapFocusData>) => ReturnType<typeof getEditableWorldMapFocusData>) => void;
  updateRegionalMapFocus: (updater: (current: ReturnType<typeof getEditableRegionalMapFocusData>) => ReturnType<typeof getEditableRegionalMapFocusData>) => void;
  updateVoxTimeline: (updater: (current: ReturnType<typeof getEditableVoxTimelineData>) => ReturnType<typeof getEditableVoxTimelineData>) => void;
  updateChartCard: (updater: (current: ReturnType<typeof getEditableChartCardData>) => ReturnType<typeof getEditableChartCardData>) => void;
  selectedCountryName?: string;
  countryOptions: string[];
  selectedRegionalPrimaryCountryName?: string;
  selectedRegionalSecondaryCountryName: string;
  regionalCountryOptions: string[];
}) => {
  const {
    createdaleyOpenerData,
    editorialStatRingData,
    worldMapFocusData,
    regionalMapFocusData,
    voxTimelineData,
    chartCardData,
    overlay,
    disabled,
    onUpdateText,
    updateCreatedaleyOpener,
    updateEditorialStatRing,
    updateWorldMapFocus,
    updateRegionalMapFocus,
    updateVoxTimeline,
    updateChartCard,
    selectedCountryName,
    countryOptions,
    selectedRegionalPrimaryCountryName,
    selectedRegionalSecondaryCountryName,
    regionalCountryOptions,
  } = props;

  // Check in priority order - first match wins
  if (createdaleyOpenerData) {
    return (
      <CreatedaleyOpenerInspector
        data={createdaleyOpenerData}
        disabled={disabled}
        overlay={overlay}
        onUpdateOverlay={(patch) => onUpdateText(overlay.id, patch)}
        onUpdateText={updateCreatedaleyOpener}
      />
    );
  }

  if (editorialStatRingData) {
    return (
      <EditorialStatRingInspector
        data={editorialStatRingData}
        disabled={disabled}
        onUpdateText={updateEditorialStatRing}
      />
    );
  }

  if (worldMapFocusData && selectedCountryName) {
    return (
      <WorldMapFocusInspector
        countryOptions={countryOptions}
        data={worldMapFocusData}
        disabled={disabled}
        selectedCountryName={selectedCountryName}
        onUpdateText={updateWorldMapFocus}
      />
    );
  }

  if (regionalMapFocusData && selectedRegionalPrimaryCountryName) {
    return (
      <RegionalMapFocusInspector
        countryOptions={regionalCountryOptions}
        data={regionalMapFocusData}
        disabled={disabled}
        overlay={overlay}
        primaryCountryName={selectedRegionalPrimaryCountryName}
        secondaryCountryName={selectedRegionalSecondaryCountryName}
        onUpdateText={updateRegionalMapFocus}
      />
    );
  }

  if (voxTimelineData) {
    return (
      <VoxTimelineInspector
        data={voxTimelineData}
        disabled={disabled}
        overlay={overlay}
        onUpdateText={updateVoxTimeline}
      />
    );
  }

  if (chartCardData) {
    return (
      <ChartCardInspector
        data={chartCardData}
        disabled={disabled}
        overlay={overlay}
        onUpdateOverlay={(patch) => onUpdateText(overlay.id, patch)}
        onUpdateText={updateChartCard}
      />
    );
  }

  // Fallback: simple text editor
  return (
    <LabeledControl className="block space-y-1 text-xs text-neutral-200" label="Text">
      <textarea
        disabled={disabled}
        value={overlay.text}
        onChange={(event) => {
          onUpdateText(overlay.id, {
            text: event.currentTarget.value,
          });
        }}
        className={`${INSPECTOR_INPUT_CLASS} min-h-16`}
      />
    </LabeledControl>
  );
};

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
  const regionalMapFocusData =
    overlay.stylePreset === "regional-map-focus"
      ? getEditableRegionalMapFocusData(overlay.text)
      : null;
  const createdaleyOpenerData =
    overlay.stylePreset === "createdaley-opener"
      ? getEditableCreatedaleyOpenerData(overlay.text)
      : null;
  const voxTimelineData =
    isVoxTimelineStylePreset(overlay.stylePreset)
      ? getEditableVoxTimelineData(overlay.text)
      : null;

  const updateChartCard = createPresetUpdateHandler(
    chartCardData,
    buildChartCardText,
    onUpdateText,
    overlay.id,
  );

  const updateCreatedaleyOpener = createPresetUpdateHandler(
    createdaleyOpenerData,
    buildCreatedaleyOpenerText,
    onUpdateText,
    overlay.id,
  );

  const updateEditorialStatRing = createPresetUpdateHandler(
    editorialStatRingData,
    buildEditorialStatRingText,
    onUpdateText,
    overlay.id,
  );

  const updateWorldMapFocus = createPresetUpdateHandler(
    worldMapFocusData,
    buildWorldMapFocusText,
    onUpdateText,
    overlay.id,
  );

  const updateRegionalMapFocus = createPresetUpdateHandler(
    regionalMapFocusData,
    buildRegionalMapFocusText,
    onUpdateText,
    overlay.id,
  );

  const updateVoxTimeline = createPresetUpdateHandler(
    voxTimelineData,
    buildVoxTimelineText,
    onUpdateText,
    overlay.id,
  );

  const selectedCountryName = worldMapFocusData
    ? getSelectedWorldMapCountryName(worldMapFocusData.country)
    : undefined;
  const countryOptions = selectedCountryName
    ? getWorldMapCountryOptions(selectedCountryName)
    : [];
  const selectedRegionalPrimaryCountryName = regionalMapFocusData
    ? getSelectedWorldMapCountryName(regionalMapFocusData.primaryCountry)
    : undefined;
  const selectedRegionalSecondaryCountryName = regionalMapFocusData
    ? getOptionalWorldMapCountryName(regionalMapFocusData.secondaryCountry)
    : "";
  const regionalCountryOptions = selectedRegionalPrimaryCountryName
    ? getWorldMapCountryOptions(
        selectedRegionalPrimaryCountryName,
        selectedRegionalSecondaryCountryName,
      )
    : [];

  return (
    <InspectorCard title="Text Overlay">
      {renderPresetInspector({
        createdaleyOpenerData,
        editorialStatRingData,
        worldMapFocusData,
        regionalMapFocusData,
        voxTimelineData,
        chartCardData,
        overlay,
        disabled,
        onUpdateText,
        updateCreatedaleyOpener,
        updateEditorialStatRing,
        updateWorldMapFocus,
        updateRegionalMapFocus,
        updateVoxTimeline,
        updateChartCard,
        selectedCountryName,
        countryOptions,
        selectedRegionalPrimaryCountryName,
        selectedRegionalSecondaryCountryName,
        regionalCountryOptions,
      })}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-3">
          <div>
            <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              Placement
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              Position the overlay on the canvas and tune scale.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-neutral-200">
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
                className={INSPECTOR_INPUT_CLASS}
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
                className={INSPECTOR_INPUT_CLASS}
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
                className={INSPECTOR_INPUT_CLASS}
              />
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
                className={INSPECTOR_COLOR_INPUT_CLASS}
              />
            </LabeledControl>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              Typography
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              Control the family, weight, style, and active preset.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-neutral-200">
            <LabeledControl label="Font Family">
              <select
                disabled={disabled}
                value={overlay.fontFamily}
                onChange={(event) => {
                  onUpdateText(overlay.id, {
                    fontFamily: event.currentTarget.value as TextOverlay["fontFamily"],
                  });
                }}
                className={INSPECTOR_INPUT_CLASS}
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
                className={INSPECTOR_INPUT_CLASS}
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
                className={INSPECTOR_INPUT_CLASS}
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
                className={INSPECTOR_INPUT_CLASS}
              >
                {TEXT_OVERLAY_STYLE_PRESETS.map((stylePreset) => (
                  <option key={stylePreset} value={stylePreset}>
                    {TEXT_OVERLAY_STYLE_PRESET_LABELS[stylePreset]}
                  </option>
                ))}
              </select>
            </LabeledControl>
          </div>
        </section>
      </div>
    </InspectorCard>
  );
};
