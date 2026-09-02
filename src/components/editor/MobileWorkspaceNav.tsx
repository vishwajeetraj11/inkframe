"use client";

import { Film, MonitorPlay, SlidersHorizontal, Rows3 } from "lucide-react";

export type MobileWorkspacePanel = "media" | "canvas" | "timeline" | "inspector";

interface MobileWorkspaceNavProps {
  activePanel: MobileWorkspacePanel;
  onChange: (panel: MobileWorkspacePanel) => void;
}

const panels: Array<{
  id: MobileWorkspacePanel;
  label: string;
  icon: typeof Film;
}> = [
  { id: "media", label: "Media", icon: Film },
  { id: "canvas", label: "Canvas", icon: MonitorPlay },
  { id: "timeline", label: "Timeline", icon: Rows3 },
  { id: "inspector", label: "Inspector", icon: SlidersHorizontal },
];

export const MobileWorkspaceNav = ({
  activePanel,
  onChange,
}: MobileWorkspaceNavProps) => (
  <nav
    aria-label="Editor workspace"
    className="z-40 grid h-[calc(52px+env(safe-area-inset-bottom))] shrink-0 grid-cols-4 border-t border-white/10 bg-[#11100c] pb-[env(safe-area-inset-bottom)] xl:hidden"
  >
    {panels.map((panel) => {
      const Icon = panel.icon;
      const active = activePanel === panel.id;

      return (
        <button
          key={panel.id}
          type="button"
          aria-current={active ? "page" : undefined}
          aria-controls={`mobile-${panel.id}-panel`}
          onClick={() => onChange(panel.id)}
          className={`relative flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 border-r border-white/10 px-1 outline-none transition last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff4f1f] ${
            active
              ? "bg-[#191611] text-[#f2ede3]"
              : "text-neutral-500 active:bg-white/[0.05] active:text-neutral-100"
          }`}
        >
          <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
          <span className="app-eyebrow truncate text-[8px] font-semibold uppercase tracking-[0.1em]">
            {panel.label}
          </span>
          {active ? (
            <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 bg-[#ff4f1f]" />
          ) : null}
        </button>
      );
    })}
  </nav>
);
