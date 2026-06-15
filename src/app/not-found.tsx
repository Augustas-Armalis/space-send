"use client";

import Link from "next/link";
import { Orb } from "@/components/brand/Orb";
import { ContlesMark } from "@/components/brand/ContlesMark";
import { MagneticButton } from "@/components/ui/MagneticButton";

export default function NotFound() {
  return (
    <div className="relative min-h-dvh grid place-items-center bg-deep overflow-hidden">
      {/* Soft radial glow at top */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at center top, #00FF88 0%, #00C8FF 45%, transparent 75%)",
        }}
      />

      {/* Main centered column */}
      <div className="relative flex flex-col items-center gap-8 px-6 text-center">
        {/* Breathing, floating Orb */}
        <div className="anim-float">
          <Orb size={96} state="dim" intensity={0.4} />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-medium text-fg tracking-tight">
          Nothing here.
        </h1>

        {/* Sub-copy */}
        <p className="text-fg-3 max-w-sm text-balance leading-relaxed text-sm">
          This link does not match any known transmission. It may have expired,
          or been mistyped.
        </p>

        {/* CTA */}
        <Link href="/">
          <MagneticButton icon="Rocket" size="md">
            Back to Space Send
          </MagneticButton>
        </Link>
      </div>

      {/* Footer mark */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <ContlesMark align="center" />
      </div>
    </div>
  );
}
