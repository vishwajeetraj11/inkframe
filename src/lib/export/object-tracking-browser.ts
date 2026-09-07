import { assertTrackableClip, createPatchTracker, trackingSampleTimes, type TrackingBox, type TrackingFrame, type TrackingResult } from "../editor/object-tracking";
import type { Clip, Transition } from "../editor/types";

/** Decode locally at bounded resolution. No media is uploaded or persisted. */
export async function trackVideoObject(options: { url:string; clip:Clip; box:TrackingBox; transitions?:Transition[]; signal?:AbortSignal; onProgress?:(done:number,total:number)=>void }): Promise<TrackingResult> {
  const {url,clip,box,transitions=[],signal,onProgress}=options;
  assertTrackableClip(clip,transitions);
  const abort=()=>{if(signal?.aborted) throw new DOMException("Tracking cancelled.","AbortError");};
  abort();
  const video=document.createElement("video");
  video.crossOrigin="anonymous";
  video.preload="auto";
  video.muted=true;
  video.playsInline=true;
  const waitFor=(event:string, action:()=>void)=>new Promise<void>((resolve,reject)=>{
    const clean=()=>{clearTimeout(timer);video.removeEventListener(event,success);video.removeEventListener("error",failure);signal?.removeEventListener("abort",cancel);};
    const success=()=>{clean();resolve();};
    const failure=()=>{clean();reject(new Error("Could not decode this video for tracking. Use a browser-playable local video."));};
    const cancel=()=>{clean();reject(new DOMException("Tracking cancelled.","AbortError"));};
    const timer=setTimeout(()=>{clean();reject(new Error("Video decoding timed out."));},15000);
    video.addEventListener(event,success,{once:true});video.addEventListener("error",failure,{once:true});signal?.addEventListener("abort",cancel,{once:true});
    if(signal?.aborted) {cancel();return;}
    try {action();} catch(error) {clean();reject(error);}
  });
  try {
    await waitFor("loadeddata",()=>{video.src=url;video.load();});
    abort();
    const sourceWidth=video.videoWidth,sourceHeight=video.videoHeight;
    if(!sourceWidth||!sourceHeight) throw new Error("Video dimensions are unavailable.");
    const samples=trackingSampleTimes(clip);
    if(!Number.isFinite(video.duration)||samples.at(-1)!.seconds>=video.duration) throw new Error("The clip trim extends beyond the video duration.");
    const scale=Math.min(1,320/Math.max(sourceWidth,sourceHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(sourceWidth*scale));canvas.height=Math.max(1,Math.round(sourceHeight*scale));
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if(!context) throw new Error("Canvas pixel sampling is unavailable.");
    const result:TrackingResult={points:[],status:"complete",sourceWidth,sourceHeight};
    let tracker:ReturnType<typeof createPatchTracker>|undefined;
    for(let i=0;i<samples.length;i++) {
      abort();
      const sample=samples[i];
      if(Math.abs(video.currentTime-sample.seconds)>0.00001) await waitFor("seeked",()=>{video.currentTime=sample.seconds;});
      abort();
      context.drawImage(video,0,0,canvas.width,canvas.height);
      let frame:TrackingFrame;
      try {frame={width:canvas.width,height:canvas.height,pixels:context.getImageData(0,0,canvas.width,canvas.height).data};}
      catch {throw new Error("This video blocks pixel access. Import it as a local file before tracking.");}
      if(!tracker) {
        tracker=createPatchTracker(frame,box);
        result.points.push({frame:sample.frame,...tracker.initial,confidence:1});
      } else {
        const match=tracker.next(frame);
        if(!match) {result.status="lost";result.message=`Tracking lost confidence at clip frame ${sample.frame}. The path stops at the last reliable point; choose a clearer patch or correct the path manually.`;return result;}
        result.points.push({frame:sample.frame,...match});
      }
      onProgress?.(i+1,samples.length);
      // Give cancellation and the UI an opportunity to run between pixel searches.
      await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
    return result;
  } finally {
    video.pause();video.removeAttribute("src");video.load();
  }
}
