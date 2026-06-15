"use client";

import { useEffect, useRef } from "react";
import { useUI } from "@/store/ui";
import { toast } from "@/components/ui/Toast";

/* A few tasteful easter eggs. Konami → rainbow accent for the session.
   Typing "spacesend" → a one-time gradient particle burst. */

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
];

export function EasterEggs() {
  const fireComplete = useUI((s) => s.fireComplete);
  const konami = useRef<string[]>([]);
  const typed = useRef("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Konami
      konami.current = [...konami.current, e.key].slice(-KONAMI.length);
      if (KONAMI.every((k, i) => konami.current[i]?.toLowerCase() === k.toLowerCase())) {
        document.documentElement.style.setProperty(
          "--ss-gradient",
          "linear-gradient(135deg,#ff4d6a,#ffb020,#00ff88,#00c8ff,#9b5cff)",
        );
        toast.info("Spectrum unlocked", "Accent gradient overridden for this session.");
        konami.current = [];
      }

      // Type the name
      if (/^[a-z]$/i.test(e.key)) {
        typed.current = (typed.current + e.key.toLowerCase()).slice(-9);
        if (typed.current === "spacesend") {
          fireComplete();
          toast.success("Signal boosted", "You found it.");
          typed.current = "";
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fireComplete]);

  return null;
}
