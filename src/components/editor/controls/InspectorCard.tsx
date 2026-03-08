import type { ReactNode } from "react";

interface InspectorCardProps {
  children: ReactNode;
  title: string;
}

export const InspectorCard = ({ children, title }: InspectorCardProps) => {
  return (
    <div className="space-y-2 rounded-lg border border-neutral-700/70 bg-neutral-800/30 p-3">
      <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
      {children}
    </div>
  );
};
