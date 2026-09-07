import { describe, expect, it } from "vitest";
import { assertTrackableClip, correctTrackingPoint, createPatchTracker, trackingSampleTimes, trackingToKeyframes, type TrackingFrame } from "../src/lib/editor/object-tracking";
import type { Clip } from "../src/lib/editor/types";

const clip:Clip={id:"source",assetId:"video",kind:"video",startFrame:30,endFrame:90,trimStartFrame:15,trimEndFrame:75,volume:1};
function image(left:number,top:number,present=true):TrackingFrame {
  const pixels=new Uint8ClampedArray(64*64*4);
  if(present) for(let y=0;y<12;y++) for(let x=0;x<12;x++) {
    const i=((top+y)*64+left+x)*4;
    pixels[i]=(x*71+y*19)%230+25;pixels[i+1]=(x*11+y*47)%230+25;pixels[i+2]=(x*37+y*83)%230+25;pixels[i+3]=255;
  }
  return {width:64,height:64,pixels};
}
describe("local object tracking",()=>{
  it("tracks actual translated RGB texture and stops when it disappears",()=>{
    const tracker=createPatchTracker(image(12,14),{x:12/64,y:14/64,width:12/64,height:12/64});
    const next=tracker.next(image(17,17));
    expect(next?.x).toBe(23/64);expect(next?.y).toBe(23/64);expect(next?.confidence).toBeGreaterThan(.8);
    expect(tracker.next(image(17,17,false))).toBeNull();
  });
  it("rejects flat patches and out-of-range boxes",()=>{
    expect(()=>createPatchTracker(image(0,0,false),{x:0,y:0,width:.2,height:.2})).toThrow(/detail/);
    expect(()=>createPatchTracker(image(12,14),{x:.9,y:0,width:.2,height:.2})).toThrow(/inside/);
  });
  it("stops on two equally plausible copies rather than choosing one",()=>{
    const tracker=createPatchTracker(image(12,14),{x:12/64,y:14/64,width:12/64,height:12/64});
    const ambiguous=image(12,14),copy=image(27,14);
    for(let i=0;i<ambiguous.pixels.length;i++) ambiguous.pixels[i]=Math.max(ambiguous.pixels[i],copy.pixels[i]);
    expect(tracker.next(ambiguous)).toBeNull();
  });
  it("uses local frames with source trim and bounded endpoints",()=>{
    const samples=trackingSampleTimes(clip);
    expect(samples[0]).toEqual({frame:0,seconds:.5});
    expect(samples.at(-1)).toEqual({frame:59,seconds:74/30});
    const many=trackingSampleTimes({...clip,endFrame:1830});
    expect(many.length).toBeLessThanOrEqual(120);expect(many.at(-1)?.frame).toBe(1799);
    expect(()=>assertTrackableClip({...clip,timeMapping:{kind:"hold",sourceTimeUs:0}})).toThrow(/normal/);
    expect(()=>assertTrackableClip(clip,[{fromClipId:"source",toClipId:"other"} as never])).toThrow(/transitions/);
  });
  it("maps source contain-fit and timeline offsets, preserves other channels",()=>{
    const target:Clip={...clip,id:"target",kind:"image",startFrame:20,endFrame:100,keyframes:{opacity:[{id:"fade",frame:0,value:.5,interpolation:"hold"}]}};
    const result=trackingToKeyframes({points:[{frame:0,x:1,y:1,confidence:1}],sourceClip:clip,targetClip:target,sourceWidth:200,sourceHeight:100,stageWidth:100,stageHeight:100});
    expect(result.x?.[0]).toMatchObject({frame:10,value:1});expect(result.y?.[0].value).toBe(.75);expect(result.opacity).toEqual(target.keyframes?.opacity);
    expect(target.keyframes?.x).toBeUndefined();
  });
  it("supports rotated explicit source transforms and rejects points outside target",()=>{
    const target:Clip={...clip,id:"target",kind:"image"};
    const input={points:[{frame:0,x:1,y:.5,confidence:1}],sourceClip:{...clip,transform:{x:.5,y:.5,scale:1,rotation:Math.PI/2,anchor:{x:.5,y:.5}}},targetClip:target,sourceWidth:100,sourceHeight:100,stageWidth:100,stageHeight:100};
    expect(trackingToKeyframes(input).y?.[0].value).toBe(1);
    expect(()=>trackingToKeyframes({...input,targetClip:{...target,startFrame:40}})).toThrow(/inside both/);
  });
  it("manual correction replaces a point without changing original data",()=>{
    const points=[{frame:0,x:.2,y:.3,confidence:.5}];
    expect(correctTrackingPoint(points,{frame:0,x:.4,y:.6})).toEqual([{frame:0,x:.4,y:.6,confidence:1,manual:true}]);
    expect(points[0].x).toBe(.2);
    expect(()=>correctTrackingPoint(points,{frame:1,x:2,y:.5})).toThrow(/coordinates/);
  });
});
