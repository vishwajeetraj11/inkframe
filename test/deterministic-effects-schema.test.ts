import {describe, expect, it} from "vitest";
import {persistedProjectSchema, exportProjectSchema} from "@/lib/editor/schema";
import {createInitialProjectSession} from "@/lib/editor/defaults";
const videoProject = () => {
  const project=createInitialProjectSession();
  project.versions.reel_9_16.clips=[{id:"video",assetId:"asset",kind:"video",startFrame:0,endFrame:60,trimStartFrame:0,trimEndFrame:60,volume:1}];
  return project;
};
describe("effect persistence and export schema", () => {
  it("rejects malformed time-map ordering, extra timing fields and unsafe source timestamps", () => {
    const project=videoProject(); const clip=project.versions.reel_9_16.clips[0];
    for(const timeMapping of [
      {kind:"speed",points:[{frame:30,speed:1,interpolation:"linear"},{frame:0,speed:1,interpolation:"linear"}]},
      {kind:"normal",speed:2},
      {kind:"hold",sourceTimeUs:Number.MAX_VALUE},
    ]) expect(persistedProjectSchema.safeParse({...project,versions:{...project.versions,reel_9_16:{...project.versions.reel_9_16,clips:[{...clip,timeMapping}]}}}).success).toBe(false);
  });
  it("rejects dangling duck refs and invalid caption lanes before migration", () => {
    const project=videoProject();
    expect(persistedProjectSchema.safeParse({...project,versions:{...project.versions,reel_9_16:{...project.versions.reel_9_16,duckingRules:[{id:"duck",target:{kind:"video",id:"video"},triggers:[{kind:"audio",id:"missing"}],attenuationDb:-12,attackFrames:3,releaseFrames:3}]}}}).success).toBe(false);
    expect(persistedProjectSchema.safeParse({...project,versions:{...project.versions,reel_9_16:{...project.versions.reel_9_16,captionCues:[{id:"cue",trackId:"missing",text:"Hello",startFrame:0,endFrame:30}]}}}).success).toBe(false);
  });
  it("uses verified asset duration even when clip claims a larger bound", () => {
    const project=videoProject();
    project.versions.reel_9_16.clips[0].sourceDurationUs=4e6;
    project.versions.reel_9_16.clips[0].timeMapping={kind:"speed",points:[{frame:0,speed:2,interpolation:"linear"}]};
    const payload={...project,assets:[{assetId:"asset",kind:"video",mimeType:"video/mp4",name:"Video",size:10,mediaMetadata:{durationUs:2e6}}]};
    expect(exportProjectSchema.safeParse(payload).success).toBe(false);
    payload.assets[0].mediaMetadata.durationUs=4e6;
    expect(exportProjectSchema.safeParse(payload).success).toBe(true);
  });
  it("accepts caption-only export without media assets", () => {
    const project=createInitialProjectSession();
    project.versions.reel_9_16.tracks!.push({id:"captions",kind:"caption",name:"Captions",order:3});
    project.versions.reel_9_16.captionCues=[{id:"cue",trackId:"captions",text:"Hello",startFrame:0,endFrame:30}];
    expect(exportProjectSchema.safeParse({...project,assets:[]}).success).toBe(true);
  });
  it("persists bounded video color grades and rejects unsafe values", () => {
    const project=videoProject(); const clip=project.versions.reel_9_16.clips[0];
    const grade={preset:"cinematic" as const,brightness:0.94,contrast:1.18,saturation:0.88,sepia:0.06,grayscale:0,hueRotate:-3};
    const withGrade={...project,versions:{...project.versions,reel_9_16:{...project.versions.reel_9_16,clips:[{...clip,videoFilter:grade}]}}};
    expect(persistedProjectSchema.safeParse(withGrade).success).toBe(true);
    expect(persistedProjectSchema.safeParse({...withGrade,versions:{...withGrade.versions,reel_9_16:{...withGrade.versions.reel_9_16,clips:[{...clip,videoFilter:{...grade,contrast:9}}]}}}).success).toBe(false);
  });
});
