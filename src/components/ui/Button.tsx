"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "destructive" | "glass";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  primary:
    "text-[#02140d] font-semibold gradient-bg cta-glow hover:brightness-110 active:brightness-95",
  secondary: "bg-white/[0.06] text-fg hover:bg-white/[0.1] border border-white/10",
  ghost: "text-fg-2 hover:text-fg hover:bg-white/[0.05]",
  outline: "border border-white/15 text-fg hover:bg-white/[0.05]",
  destructive: "bg-[#ff4d6a]/15 text-[#ff8a9c] border border-[#ff4d6a]/30 hover:bg-[#ff4d6a]/25",
  glass: "glass text-fg hover:bg-white/[0.07]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-[15px] rounded-2xl gap-2",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: string;
  iconRight?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, iconRight, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Icon name="RefreshCw" className="h-4 w-4 animate-spin" />}
      {!loading && icon && <Icon name={icon} className="h-4 w-4 shrink-0" />}
      {children}
      {!loading && iconRight && <Icon name={iconRight} className="h-4 w-4 shrink-0" />}
    </button>
  );
});
