"use client";

import { Starfield } from "@/components/brand/Starfield";
import { AuroraRibbon } from "@/components/brand/AuroraRibbon";
import { CompleteFlash } from "@/components/ui/CompleteFlash";
import { Toaster } from "@/components/ui/Toast";
import { CursorTrail } from "./CursorTrail";
import { EasterEggs } from "./EasterEggs";
import { useUI } from "@/store/ui";

/* Global ambient + chrome that wraps every route (recipient pages included). */

export function Providers({ children }: { children: React.ReactNode }) {
  const auroraActive = useUI((s) => s.auroraActive);
  const auroraIntensity = useUI((s) => s.auroraIntensity);
  const completeKey = useUI((s) => s.completeKey);

  return (
    <>
      <Starfield />
      <AuroraRibbon active={auroraActive} intensity={auroraIntensity} />
      {children}
      <CompleteFlash playKey={completeKey} />
      <Toaster />
      <CursorTrail />
      <EasterEggs />
    </>
  );
}
