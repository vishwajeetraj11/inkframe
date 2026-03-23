import type { ReactNode } from "react";

interface InspectorCardProps {
  children: ReactNode;
  title: string;
}

export const InspectorCard = ({ children, title }: InspectorCardProps) => {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,32,42,0.9),rgba(16,18,26,0.82))]">
      <div className="border-b border-white/6 px-4 py-3">
        <p className="app-eyebrow text-[10px] uppercase tracking-[0.22em] text-neutral-500">
          Active Layer
        </p>
        <h3 className="mt-1 text-sm font-semibold text-neutral-100">{title}</h3>
      </div>

      <div className="space-y-4 px-4 py-4">{children}</div>
    </div>
  );
};
