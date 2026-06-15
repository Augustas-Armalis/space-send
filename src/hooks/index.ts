"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = () => setMatches(m.matches);
    handler();
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function useCopy(timeout = 1500): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback for insecure contexts
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          /* noop */
        }
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setCopied(false), timeout);
    },
    [timeout],
  );
  return [copied, copy];
}

/** Magnetic hover — subtle attraction toward the cursor (4–6px). */
export function useMagnetic(strength = 0.28) {
  const ref = useRef<HTMLElement | null>(null);
  const [transform, setTransform] = useState("");
  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      setTransform(`translate(${x * strength}px, ${y * strength}px)`);
    },
    [strength],
  );
  const onLeave = useCallback(() => setTransform(""), []);
  return { ref, transform, onMove, onLeave };
}

/** A debounced window-size hook for canvas sizing. */
export function useWindowSize() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export function useVibrate() {
  return useCallback((pattern: number | number[]) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* noop */
    }
  }, []);
}
