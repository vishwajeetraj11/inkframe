import type { ReactNode } from "react";

interface InspectorCardProps {
  children: ReactNode;
  title: string;
}

export const InspectorCard = ({ children, title }: InspectorCardProps) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,24,0.9),rgba(24,22,17,0.82))]">
      <div className="border-b border-white/6 px-3 py-2">
        <p className="app-eyebrow text-[9px] uppercase tracking-[0.22em] text-neutral-500">
          Active Layer
        </p>
        <h3 className="text-xs font-semibold text-neutral-100">{title}</h3>
      </div>

      <div className="space-y-3 px-3 py-3">{children}</div>
    </div>
  );
};
