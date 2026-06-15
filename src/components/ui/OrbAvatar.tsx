"use client";

import { cn } from "@/lib/cn";
import { orbIdentity } from "@/lib/avatar";
import { PulseDot, type PulseState } from "./PulseDot";

/* A Crew member's avatar wrapped in an Orb-style halo. */

export function OrbAvatar({
  seed,
  name,
  src,
  size = 40,
  presence,
  ring = true,
  className,
}: {
  seed: string;
  name?: string;
  src?: string | null;
  size?: number;
  presence?: PulseState;
  ring?: boolean;
  className?: string;
}) {
  const id = orbIdentity(seed, name);
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      {ring && (
        <div
          className="absolute inset-[-2px] rounded-full opacity-70"
          style={{ background: id.gradient, filter: "blur(4px)" }}
          aria-hidden
        />
      )}
      <div
        className="relative grid h-full w-full place-items-center overflow-hidden rounded-full"
        style={{
          background: src ? undefined : id.gradient,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name ?? seed} className="h-full w-full object-cover" />
        ) : (
          <span className="font-semibold text-[#06140f]" style={{ fontSize: size * 0.36 }}>
            {id.initials}
          </span>
        )}
      </div>
      {presence && (
        <span className="absolute -bottom-0 -right-0 rounded-full bg-[#04040a] p-[2px]">
          <PulseDot state={presence} size={Math.max(7, size * 0.18)} />
        </span>
      )}
    </div>
  );
}
