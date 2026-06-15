"use client";

import { useEffect, useState } from "react";
import QR from "qrcode";
import { cn } from "@/lib/cn";
import { MarkDot } from "@/components/brand/Wordmark";

/* Scannable QR with a glowing Orb at the center dot. */

export function QRCode({ value, size = 168, className }: { value: string; size?: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QR.toDataURL(value, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: size * 2,
      color: { dark: "#04040aff", light: "#ffffffff" },
    })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <div
      className={cn("relative grid place-items-center rounded-2xl bg-white p-3", className)}
      style={{ width: size + 24, height: size + 24 }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="QR code" width={size} height={size} className="rounded-md" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-md bg-black/10" />
      )}
      {/* Glowing center accent over the QR's high error-correction core */}
      <span className="absolute grid place-items-center rounded-full bg-white p-1.5">
        <MarkDot size={20} />
      </span>
    </div>
  );
}
