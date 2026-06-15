"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";

/* Desktop (Tauri) custom titlebar — draggable region + space for traffic
   lights. Renders only inside the native shell; invisible on the web. */

export function Titlebar() {
  const [tauri, setTauri] = useState(false);
  useEffect(() => {
    setTauri(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);
  }, []);
  if (!tauri) return null;
  return (
    <div className="titlebar-drag fixed inset-x-0 top-0 z-[70] flex h-9 items-center justify-center border-b border-white/5 bg-black/40 backdrop-blur-xl">
      {/* leave 78px on the left for macOS traffic lights */}
      <Wordmark href={null} size="sm" withMark />
    </div>
  );
}
