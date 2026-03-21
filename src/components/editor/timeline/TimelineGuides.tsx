"use client";

interface TimelineGuidesProps {
  ticks: number[];
  totalFrames: number;
}

export const TimelineGuides = ({ ticks, totalFrames }: TimelineGuidesProps) => {
  return (
    <>
      {ticks.map((frame) => {
        const leftPercent = (frame / Math.max(1, totalFrames)) * 100;

        return (
          <div
            key={frame}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-white/6"
            style={{ left: `${leftPercent}%` }}
          />
        );
      })}
    </>
  );
};
