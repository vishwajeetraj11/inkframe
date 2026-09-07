import type { Clip, Transition } from "./types";
import type { ClipKeyframes } from "./keyframes";

export interface TrackingBox { x: number; y: number; width: number; height: number }
export interface TrackingPoint { frame: number; x: number; y: number; confidence: number; manual?: boolean }
export interface TrackingResult { points: TrackingPoint[]; status: "complete" | "lost"; message?: string; sourceWidth: number; sourceHeight: number }
export interface TrackingFrame { width: number; height: number; pixels: Uint8ClampedArray }
const unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;

export function assertTrackableClip(clip: Clip, transitions: Transition[] = []) {
  if (clip.kind !== "video") throw new Error("Select a video source to track.");
  if (clip.timeMapping && clip.timeMapping.kind !== "normal") throw new Error("Tracking requires normal playback speed; retimed or held clips are unsupported.");
  if (transitions.some(t => t.fromClipId === clip.id || t.toClipId === clip.id)) throw new Error("Remove source transitions before tracking.");
  if (["x", "y", "scale", "rotation"].some(key => clip.keyframes?.[key as keyof ClipKeyframes]?.length)) throw new Error("Tracking an animated source transform is unsupported.");
  if (![clip.startFrame, clip.endFrame, clip.trimStartFrame].every(Number.isInteger) || clip.endFrame <= clip.startFrame || clip.trimStartFrame < 0) throw new Error("Invalid source timing.");
}

/** Frame numbers are local output frames, with trim applied only when decoding. */
export function trackingSampleTimes(clip: Clip, fps = 30, maxSamples = 120) {
  assertTrackableClip(clip);
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isInteger(maxSamples) || maxSamples < 2 || maxSamples > 120) throw new Error("Invalid tracking sampling bounds.");
  const last = clip.endFrame - clip.startFrame - 1;
  const step = Math.max(1, Math.ceil(last / (maxSamples - 1)));
  const frames: number[] = [];
  for (let frame = 0; frame <= last; frame += step) frames.push(frame);
  if (frames.at(-1) !== last) frames.push(last);
  return frames.map(frame => ({ frame, seconds: (clip.trimStartFrame + frame) / fps }));
}

function validateFrame(frame: TrackingFrame) {
  if (!Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width < 1 || frame.height < 1 || frame.width > 320 || frame.height > 320 || frame.pixels.length !== frame.width * frame.height * 4) throw new Error("Tracking frames must be RGBA and no larger than 320 pixels per side.");
}

/** Bounded fixed-template SAD tracker. Stops on weak/ambiguous matches instead of extrapolating. */
export function createPatchTracker(initial: TrackingFrame, box: TrackingBox) {
  validateFrame(initial);
  if (![box.x, box.y, box.width, box.height].every(unit) || box.width <= 0 || box.height <= 0 || box.x + box.width > 1 || box.y + box.height > 1) throw new Error("Select a box inside the source video.");
  const w = Math.min(initial.width, Math.max(3, Math.round(box.width * initial.width)));
  const h = Math.min(initial.height, Math.max(3, Math.round(box.height * initial.height)));
  let left = Math.min(initial.width - w, Math.round(box.x * initial.width));
  let top = Math.min(initial.height - h, Math.round(box.y * initial.height));
  const stride = Math.max(1, Math.ceil(Math.max(w, h) / 20));
  const template: { dx: number; dy: number; values: number[] }[] = [];
  for (let dy = 0; dy < h; dy += stride) for (let dx = 0; dx < w; dx += stride) {
    const i = ((top + dy) * initial.width + left + dx) * 4;
    template.push({ dx, dy, values: [...initial.pixels.slice(i, i + 3)] });
  }
  const values = template.flatMap(p => p.values);
  const mean = values.reduce((a,b) => a+b,0) / values.length;
  const variance = values.reduce((a,b) => a+(b-mean)**2,0) / values.length;
  if (variance < 45) throw new Error("The selected patch has too little detail. Select a textured object or edge.");
  return {
    initial: { x: (left + w / 2) / initial.width, y: (top + h / 2) / initial.height },
    next(frame: TrackingFrame): { x: number; y: number; confidence: number } | null {
      validateFrame(frame);
      if (frame.width !== initial.width || frame.height !== initial.height) throw new Error("Tracking frame size changed.");
      const candidates: { x: number; y: number; error: number }[] = [];
      const radius = 20;
      for (let y = Math.max(0,top-radius); y <= Math.min(frame.height-h,top+radius); y++) for (let x = Math.max(0,left-radius); x <= Math.min(frame.width-w,left+radius); x++) {
        let error = 0;
        for (const p of template) {
          const i = ((y+p.dy)*frame.width+x+p.dx)*4;
          for (let c=0;c<3;c++) error += Math.abs(frame.pixels[i+c]-p.values[c]);
        }
        candidates.push({x,y,error:error/(template.length*3*255)});
      }
      candidates.sort((a,b)=>a.error-b.error);
      const best = candidates[0];
      const other = candidates.find(c => Math.abs(c.x-best.x)>2 || Math.abs(c.y-best.y)>2);
      const margin = other ? other.error-best.error : 1;
      const confidence = Math.min(Math.max(0,1-best.error/0.20), Math.max(0,margin/0.04));
      if (best.error > 0.18 || confidence < 0.20) return null;
      left=best.x; top=best.y;
      return {x:(left+w/2)/frame.width,y:(top+h/2)/frame.height,confidence};
    },
  };
}

export function correctTrackingPoint(points: TrackingPoint[], correction: {frame:number; x:number; y:number}): TrackingPoint[] {
  if (!Number.isInteger(correction.frame) || correction.frame < 0 || !unit(correction.x) || !unit(correction.y)) throw new Error("Correction needs a nonnegative integer frame and source coordinates from 0 to 1.");
  return [...points.filter(p=>p.frame!==correction.frame), {...correction, confidence:1, manual:true}].sort((a,b)=>a.frame-b.frame);
}

export function trackingToKeyframes(input: {points:TrackingPoint[];sourceClip:Clip;targetClip:Clip;sourceWidth:number;sourceHeight:number;stageWidth:number;stageHeight:number;transitions?:Transition[]}): ClipKeyframes {
  const {points,sourceClip:source,targetClip:target,sourceWidth:sw,sourceHeight:sh,stageWidth:dw,stageHeight:dh,transitions=[]}=input;
  assertTrackableClip(source,transitions);
  if (target.kind !== "image" || target.id === source.id) throw new Error("Attach tracking to a separate image or graphic clip.");
  if (transitions.some(t=>t.fromClipId===target.id || t.toClipId===target.id)) throw new Error("Remove target transitions before attaching tracking.");
  if (target.timeMapping && target.timeMapping.kind !== "normal") throw new Error("Retimed target clips are unsupported.");
  if (![sw,sh,dw,dh].every(n=>Number.isFinite(n)&&n>0) || !points.length || points.length>120) throw new Error("Invalid tracking dimensions or point count (maximum 120).");
  const transform=source.transform ?? {x:0.5,y:0.5,scale:Math.min(dw/sw,dh/sh),rotation:0,anchor:{x:0.5,y:0.5}};
  let previous=-1;
  const mapped=points.map(p=>{
    const frame=source.startFrame+p.frame-target.startFrame;
    if (!Number.isInteger(p.frame)||p.frame<=previous||p.frame<0||p.frame>=source.endFrame-source.startFrame||frame<0||frame>=target.endFrame-target.startFrame||!unit(p.x)||!unit(p.y)||!unit(p.confidence)) throw new Error("Tracking points must be ordered, valid, and inside both clips. Align or extend the target clip first.");
    previous=p.frame;
    const x=(p.x-transform.anchor.x)*sw*transform.scale;
    const y=(p.y-transform.anchor.y)*sh*transform.scale;
    return {frame,x:transform.x+(x*Math.cos(transform.rotation)-y*Math.sin(transform.rotation))/dw,y:transform.y+(x*Math.sin(transform.rotation)+y*Math.cos(transform.rotation))/dh};
  });
  const result:ClipKeyframes=structuredClone(target.keyframes ?? {});
  const ids=new Set(Object.entries(result).filter(([key])=>key!=="x"&&key!=="y").flatMap(([,ps])=>ps.map(p=>p.id)));
  for(const axis of ["x","y"] as const) result[axis]=mapped.map(p=>{
    let id=`tracking:${target.id}:${axis}:${p.frame}`;
    while(ids.has(id)) id+=":";
    ids.add(id);
    return {id,frame:p.frame,value:p[axis],interpolation:"linear"};
  });
  return result;
}
