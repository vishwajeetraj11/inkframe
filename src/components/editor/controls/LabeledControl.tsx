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
    <label className={className ?? "space-y-1"}>
      <span className="block text-neutral-400">{label}</span>
      {children}
    </label>
  );
};
