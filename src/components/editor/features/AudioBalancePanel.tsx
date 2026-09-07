"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import type { VersionTimeline } from "@/lib/editor/types";
import type { EditorAction } from "@/lib/editor/reducer";
import type { AudioDuckingRule, AudioItemRef } from "@/lib/editor/audio-ducking";
import { planAudioBalance } from "@/lib/editor/audio-balance";
import { LabeledControl } from "@/components/editor/controls/LabeledControl";

type Props = { version: VersionTimeline; assetNames: Record<string, string>; onEdit: (action: EditorAction) => boolean };
type Strength = "gentle" | "balanced" | "strong";
const fieldClass = "min-h-9 w-full border border-white/20 bg-[#100e0b] px-2 py-1 text-xs text-neutral-100 outline-none disabled:opacity-40";
const buttonClass = `${fieldClass} hover:border-[#ff4f1f] disabled:cursor-not-allowed`;
const refKey = (ref: AudioItemRef) => `${ref.kind}:${ref.id}`;

function BalanceControls({ version, assetNames, onEdit }: Props) {
  const [musicKey, setMusicKey] = useState("");
  const [narrationKey, setNarrationKey] = useState("");
  const [strength, setStrength] = useState<Strength>("balanced");
  const [preview, setPreview] = useState<{ version: VersionTimeline; plan: ReturnType<typeof planAudioBalance> } | null>(null);
  const [ownedRule, setOwnedRule] = useState<AudioDuckingRule | null>(null);
  const [message, setMessage] = useState("");
  const items = [
    ...version.audioTracks.map((item) => ({ ref: { kind: "audio" as const, id: item.id }, label: `Audio: ${assetNames[item.assetId] ?? item.assetId}` })),
    ...version.clips.filter((item) => item.kind === "video").map((item) => ({ ref: { kind: "video" as const, id: item.id }, label: `Video sound: ${assetNames[item.assetId] ?? item.assetId}` })),
  ];
  const music = items.find((item) => refKey(item.ref) === musicKey);
  const narration = items.find((item) => refKey(item.ref) === narrationKey);
  const plan = preview?.version === version ? preview.plan : null;
  const currentOwnedRule = ownedRule && version.duckingRules?.find((rule) => rule.id === ownedRule.id);
  const canUndo = Boolean(currentOwnedRule && JSON.stringify(currentOwnedRule) === JSON.stringify(ownedRule));
  const clearPreview = () => { setPreview(null); setMessage(""); };
  const tryEdit = (action: EditorAction) => {
    try {
      if (onEdit(action)) return true;
      setMessage("The edit was not accepted. Refresh the preview and try again.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The audio edit failed."); }
    return false;
  };

  return <details className="border-t border-white/10 pt-3" open>
    <summary className="cursor-pointer text-xs font-semibold text-neutral-100">Balance narration and music</summary>
    <div className="mt-3 space-y-3 text-xs">
      <p className="text-[11px] leading-5 text-neutral-400">Lower music while narration occupies the timeline. This uses clip timing, not listening or speech detection.</p>
      {items.length < 2 ? <p role="status" className="border border-dashed border-white/15 p-3 text-neutral-300">Add two audio sources, then choose which is music and which is narration.</p> : <>
        <LabeledControl label="Music to lower"><select aria-label="Music to lower" className={fieldClass} value={musicKey} onChange={(event) => { setMusicKey(event.target.value); if (event.target.value === narrationKey) setNarrationKey(""); clearPreview(); }}>
          <option value="">Choose music…</option>{items.map((item) => <option key={refKey(item.ref)} value={refKey(item.ref)}>{item.label}</option>)}
        </select></LabeledControl>
        <LabeledControl label="Narration to keep clear"><select aria-label="Narration to keep clear" className={fieldClass} value={narrationKey} onChange={(event) => { setNarrationKey(event.target.value); clearPreview(); }}>
          <option value="">Choose narration…</option>{items.filter((item) => refKey(item.ref) !== musicKey).map((item) => <option key={refKey(item.ref)} value={refKey(item.ref)}>{item.label}</option>)}
        </select></LabeledControl>
        <LabeledControl label="Balance strength"><select aria-label="Balance strength" className={fieldClass} value={strength} onChange={(event) => { setStrength(event.target.value as Strength); clearPreview(); }}>
          <option value="gentle">Gentle</option><option value="balanced">Balanced</option><option value="strong">Strong</option>
        </select></LabeledControl>
        <button type="button" className={buttonClass} disabled={!music || !narration || musicKey === narrationKey || Boolean(currentOwnedRule)} onClick={() => {
          if (!music || !narration) return;
          setMessage(""); setPreview(null);
          try { setPreview({ version, plan: planAudioBalance(version, { music: music.ref, narration: [narration.ref], strength, ruleId: `balance-${nanoid(12)}` }) }); }
          catch (error) { setMessage(error instanceof Error ? error.message : "Could not preview this balance."); }
        }}>Preview volume envelope</button>
      </>}
      {preview && !plan && !currentOwnedRule ? <p role="status" className="text-neutral-400">The timeline changed. Preview again before applying.</p> : null}
      {plan ? <div className="space-y-2 border border-white/15 p-3">
        <p className="font-medium text-neutral-200">Timeline-based envelope preview</p>
        <p className="text-neutral-400">Music reduction: {plan.rule.attenuationDb} dB. No audio has changed. Apply, then play to hear the balance.</p>
        <svg viewBox="0 0 280 80" className="h-20 w-full" role="img" aria-label="Planned music volume envelope, relative to the music clip">
          <path d="M 0 4 H 280 M 0 76 H 280" stroke="#525252" fill="none" />
          <polyline fill="none" stroke="#ff805c" strokeWidth="2" points={plan.envelope.map((point) => `${point.frame / Math.max(1, plan.envelope.at(-1)?.frame ?? 1) * 280},${76 - point.value * 72}`).join(" ")} />
        </svg>
        <p className="text-[10px] text-neutral-400">Top: original music level · Bottom: silence · Left to right: music clip duration</p>
        {plan.warnings.map((warning, index) => <p key={index} className="text-[#ffb69f]">{warning}</p>)}
        <button type="button" className={buttonClass} onClick={() => {
          if (version.duckingRules?.some((rule) => rule.id === plan.rule.id)) { setMessage("This rule already exists. Preview again."); return; }
          if (tryEdit({ type: "set-ducking-rule", aspect: version.aspect, rule: plan.rule })) { setOwnedRule(plan.rule); setPreview(null); setMessage("Balance applied. Play the timeline to hear it."); }
        }}>Apply balance</button>
      </div> : null}
      {message ? <p role="status" className="text-neutral-300">{message}</p> : null}
      {ownedRule ? <>
        <button type="button" disabled={!canUndo} className={buttonClass} onClick={() => {
          if (!canUndo) return;
          if (tryEdit({ type: "remove-ducking-rule", aspect: version.aspect, ruleId: ownedRule.id })) { setOwnedRule(null); setMessage("Balance removed. Other audio edits are unchanged."); }
        }}>Undo balance</button>
        {currentOwnedRule && !canUndo ? <p role="status" className="text-neutral-400">This rule was changed elsewhere. Manage it under Audio ducking; this undo will not remove those changes.</p> : null}
      </> : null}
    </div>
  </details>;
}

export function AudioBalancePanel(props: Props) {
  return <BalanceControls key={props.version.aspect} {...props} />;
}
