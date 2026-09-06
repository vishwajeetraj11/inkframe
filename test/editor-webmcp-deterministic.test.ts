import { describe, expect, it } from "vitest";
import { createInitialEditorHistory, editorHistoryReducer } from "@/lib/editor/history";
import { createDefaultClip } from "@/lib/editor/defaults";
import { createEditorWebMcpTools } from "@/lib/editor/webmcp/tools";

const aspect = "reel_9_16" as const;
describe("deterministic WebMCP commands", () => {
  it("creates a lane, places/transforms overlapping video, and rejects collisions without false success", async () => {
    let state = createInitialEditorHistory();
    state = editorHistoryReducer(state, { type: "add-clip", aspect, clip: { ...createDefaultClip("base", "asset", "video"), startFrame: 0, endFrame: 300, trimEndFrame: 300 } });
    state = editorHistoryReducer(state, { type: "append-clip", aspect, clip: { ...createDefaultClip("pip", "asset", "video"), startFrame: 0, endFrame: 120, trimEndFrame: 120 } });
    const tools = createEditorWebMcpTools({ getState: () => state, dispatch: (action) => { state = editorHistoryReducer(state, action); }, dispatchCommand: (action) => { state = editorHistoryReducer(state, action); } });
    const run = async (name: string, args: Record<string, unknown>) => JSON.parse(await tools.find((tool) => tool.name === name)!.execute(args));
    const metadata = (operationId: string) => ({ aspect, operationId, expectedRevision: state.revision });
    const add = { ...metadata("add"), id: "pip-lane", kind: "video", name: "PiP" };
    expect(await run("editor_add_track", add)).toMatchObject({ ok: true });
    expect(await run("editor_add_track", add)).toMatchObject({ ok: true });
    expect(state.present.versions[aspect].tracks?.filter((track) => track.id === "pip-lane")).toHaveLength(1);
    const placed = await run("editor_place_clip", { ...metadata("place"), clipId: "pip", trackId: "pip-lane", startFrame: 60 });
    expect(placed).toMatchObject({ ok: true });
    const transform = { x: 0.7, y: 0.3, scale: 0.5, rotation: 0.2, anchor: { x: 0.5, y: 0.5 } };
    expect(await run("editor_set_clip_transform", { ...metadata("transform"), clipId: "pip", transform, opacity: 0.8 })).toMatchObject({ ok: true });
    const before = state.present;
    const collision = await run("editor_place_clip", { ...metadata("collision"), clipId: "pip", trackId: "inkframe-video", startFrame: 60 });
    expect(collision).toMatchObject({ ok: false, code: "LANE_COLLISION" });
    expect(state.present).toBe(before);
    const project = await run("editor_get_project", { aspect });
    expect(project.revision).toBe(state.revision);
    expect(project.versions[aspect].clips.items.find((clip: { id: string }) => clip.id === "pip")).toMatchObject({ trackId: "pip-lane", startFrame: 60, endFrame: 180, transform, opacity: 0.8 });
    const noopRevision = state.revision;
    expect(await run("editor_place_clip", { ...metadata("noop"), clipId: "pip", trackId: "pip-lane", startFrame: 60 })).toMatchObject({ ok: true });
    expect(state.revision).toBe(noopRevision);
  });
});

describe("effect WebMCP transactions", () => {
  const setupEffects = () => {
    let state = createInitialEditorHistory();
    state = editorHistoryReducer(state, {type:"add-clip",aspect,clip:createDefaultClip("video","asset","video")});
    state = editorHistoryReducer(state, {type:"add-track",aspect,track:{id:"captions",kind:"caption",name:"Captions",order:10}});
    const tools = createEditorWebMcpTools({getState:()=>state,getAssets:()=>[{assetId:"asset",kind:"video",name:"Source",mimeType:"video/mp4",size:1,mediaMetadata:{durationUs:10_000_000}}],dispatchCommand:action=>{state=editorHistoryReducer(state,action)}});
    const run = async (name:string,args:Record<string,unknown>)=>JSON.parse(await tools.find(tool=>tool.name===name)!.execute(args));
    return {run,state:()=>state,meta:(operationId:string)=>({aspect,operationId,expectedRevision:state.revision})};
  };

  it("uses actual asset duration for speed and replays freeze after deleting its source clip", async () => {
    const ctx=setupEffects();
    const speed={...ctx.meta("speed"),clipId:"video",points:[{frame:0,speed:2,interpolation:"hold"}],audioPolicy:"mute"};
    expect(await ctx.run("editor_set_clip_speed_ramp",speed)).toMatchObject({ok:true});
    expect(ctx.state().present.versions[aspect].clips[0].sourceDurationUs).toBe(10_000_000);
    const freeze={...ctx.meta("freeze"),clipId:"video",startFrame:30,endFrame:60,sourceTimeUs:1_000_000};
    expect(await ctx.run("editor_freeze_clip_range",freeze)).toMatchObject({ok:true});
    const before=ctx.state().present;
    expect(ctx.state().present.versions[aspect].clips.map(clip=>clip.id)).toEqual(["freeze-before","freeze-hold","freeze-after"]);
    expect(await ctx.run("editor_freeze_clip_range",freeze)).toMatchObject({ok:true});
    expect(ctx.state().present).toBe(before);
    const after = ctx.state().present.versions[aspect].clips.find(clip=>clip.id === "freeze-after")!;
    const sourceStart = after.timeMapping?.kind === "speed" ? after.timeMapping.sourceStartTimeUs : undefined;
    expect(sourceStart).toBeGreaterThan(0);
    expect(await ctx.run("editor_set_clip_speed_ramp",{...ctx.meta("after-speed"),clipId:"freeze-after",points:[{frame:0,speed:1,interpolation:"hold"}],audioPolicy:"mute"})).toMatchObject({ok:true});
    expect(ctx.state().present.versions[aspect].clips.find(clip=>clip.id === "freeze-after")?.timeMapping).toMatchObject({sourceStartTimeUs:sourceStart});
    expect(await ctx.run("editor_freeze_clip_range",{...freeze,sourceTimeUs:2_000_000})).toMatchObject({ok:false,code:"OPERATION_ID_CONFLICT"});
  });

  it("rejects source bounds and invalid channels without history and retains failed receipts", async () => {
    const ctx=setupEffects();
    const before=ctx.state();
    const speed={...ctx.meta("too-fast"),clipId:"video",points:[{frame:0,speed:20,interpolation:"linear"}],audioPolicy:"mute"};
    expect(await ctx.run("editor_set_clip_speed_ramp",speed)).toMatchObject({ok:false,code:"SOURCE_OUT_OF_RANGE"});
    expect(await ctx.run("editor_set_clip_speed_ramp",speed)).toMatchObject({ok:false,code:"SOURCE_OUT_OF_RANGE"});
    expect(ctx.state().present).toBe(before.present);
    expect(ctx.state().past).toBe(before.past);
    expect(await ctx.run("editor_set_clip_keyframes",{...ctx.meta("bad-keys"),clipId:"video",keyframes:{scale:[{id:"s",frame:0,value:-1,interpolation:"linear"}]}})).toMatchObject({ok:false});
    expect(ctx.state().present).toBe(before.present);
  });

  it("rolls caption replacement back when imported cues collide with another lane ID", async () => {
    const ctx=setupEffects();
    expect(await ctx.run("editor_upsert_caption_cues",{...ctx.meta("initial"),cues:[{id:"original",trackId:"captions",startFrame:0,endFrame:30,text:"Existing"}]})).toMatchObject({ok:true});
    const before=ctx.state();
    // Imported ID is operationId-1; create that ID on an unrelated entity.
    expect(await ctx.run("editor_add_track",{...ctx.meta("lane"),id:"replace-1",kind:"text",name:"Other"})).toMatchObject({ok:true});
    const withLane=ctx.state();
    const request={...ctx.meta("replace"),trackId:"captions",format:"srt",content:"1\n00:00:01,000 --> 00:00:02,000\nReplacement",mode:"replace"};
    expect(await ctx.run("editor_import_captions",request)).toMatchObject({ok:false,code:"DUPLICATE_ID"});
    expect(ctx.state().present).toBe(withLane.present);
    expect(ctx.state().past).toBe(withLane.past);
    expect(ctx.state().present.versions[aspect].captionCues).toEqual(before.present.versions[aspect].captionCues);
  });
});
