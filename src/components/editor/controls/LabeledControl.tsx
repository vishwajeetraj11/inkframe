import type { ReactNode } from "react";

interface LabeledControlProps {
  children: ReactNode;
  className?: string;
  label: string;
}

export const LabeledControl = ({
  children,
  className,
  label,
}: LabeledControlProps) => {
  return (
    <label className={className ?? "space-y-3"}>
      <span className="block text-[11px] font-medium text-neutral-300">{label}</span>
      {children}
    </label>
  );
};
