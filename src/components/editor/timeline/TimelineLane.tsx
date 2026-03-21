"use client";

import { TimelineGuides } from "./TimelineGuides";

interface TimelineLaneProps {
  title: string;
  subtitle: string;
  count: string;
  totalFrames: number;
  ticks: number[];
  rows: React.ReactNode[];
}

export const TimelineLane = ({
  title,
  subtitle,
  count,
  totalFrames,
  ticks,
  rows,
}: TimelineLaneProps) => {
  return (
    <div className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)] md:items-start">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-300">
          {title}
        </p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">{count}</p>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={`${title}-${index}`}
            className="relative h-16 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/75"
          >
            <TimelineGuides ticks={ticks} totalFrames={totalFrames} />
            {row}
          </div>
        ))}
      </div>
    </div>
  );
};
