import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

export interface FeatureIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  label: string;
}

/**
 * Icon-only actions used by the feature inspectors.
 * Keeping the accessible name in the component prevents silent icon buttons.
 */
export const FeatureIconButton = ({
  className = "",
  icon: Icon,
  label,
  type = "button",
  ...buttonProps
}: FeatureIconButtonProps) => {
  return (
    <button
      {...buttonProps}
      aria-label={label}
      className={`inline-grid min-h-10 min-w-10 place-items-center border border-[#f2ede3]/18 text-[#f2ede3]/65 outline-none transition-colors hover:border-[#ff4f1f] hover:bg-[#ff4f1f] hover:text-[#0f0d0a] focus-visible:ring-2 focus-visible:ring-[#ff4f1f] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      type={type}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
    </button>
  );
};
