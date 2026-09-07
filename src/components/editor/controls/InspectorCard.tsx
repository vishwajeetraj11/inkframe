import type { ReactNode } from "react";

interface InspectorCardProps {
  children: ReactNode;
  title: string;
}

export const InspectorCard = ({ children, title }: InspectorCardProps) => {
  return (
    <div className="space-y-3">
      <div className="border-b border-white/6 pb-2">
        <p className="app-eyebrow text-[9px] text-neutral-500">
          Active Layer
        </p>
        <h3 className="text-xs font-semibold text-neutral-100">{title}</h3>
      </div>

      {children}
    </div>
  );
};
