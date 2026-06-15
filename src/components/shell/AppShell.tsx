"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { NAV, MOBILE_NAV } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { Wordmark } from "@/components/brand/Wordmark";
import { OrbAvatar } from "@/components/ui/OrbAvatar";
import { useStash } from "@/store/stash";
import { Titlebar } from "./Titlebar";
import { useEffect, useRef } from "react";
import { shortId } from "@/lib/ids";

const ADJECTIVES = ["nova", "orbit", "comet", "pulsar", "echo", "drift", "lumen", "stellar", "vega", "halo", "ion", "quasar", "atlas", "zephyr"];
const NOUNS = ["signal", "vector", "probe", "beam", "pilot", "scout", "ranger", "voyager", "rover", "cipher", "phantom", "ghost", "nomad", "spark"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAnonProfile() {
  const adj = pick(ADJECTIVES);
  const noun = pick(NOUNS);
  const tag = `${adj}_${noun}_${shortId().slice(0, 4)}`.slice(0, 20);
  const name = `${adj.charAt(0).toUpperCase()}${adj.slice(1)} ${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
  return { tag, name };
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function Sidebar() {
  const pathname = usePathname();
  const { tag, name, avatar } = useStash();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-white/5 bg-black/20 px-3 py-5 backdrop-blur-2xl lg:flex">
      <div className="px-2.5 pb-6">
        <Wordmark href="/" size="md" />
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "text-fg" : "text-fg-3 hover:text-fg-2",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-white/[0.05]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {active && (
                <span
                  className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ background: "linear-gradient(180deg,#00ff88,#00c8ff)" }}
                />
              )}
              <Icon name={item.icon} className="relative h-[18px] w-[18px]" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <Link
        href="/settings"
        className="mt-2 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2.5 transition-colors hover:bg-white/[0.05]"
      >
        <OrbAvatar seed={tag ?? "anon"} name={name} src={avatar} size={34} presence="online" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-fg">{name || "Set up Stash"}</p>
          <p className="mono truncate text-[11px] text-fg-3">{tag ? `@${tag}` : "no callsign"}</p>
        </div>
      </Link>
    </aside>
  );
}

function MobileTopBar() {
  const { tag, name, avatar } = useStash();
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/5 bg-black/30 px-4 py-3 backdrop-blur-2xl lg:hidden">
      <Wordmark href="/" size="md" />
      <Link href="/settings" aria-label="Settings">
        <OrbAvatar seed={tag ?? "anon"} name={name} src={avatar} size={32} presence="online" />
      </Link>
    </header>
  );
}

function BottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-white/5 bg-black/40 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-2xl lg:hidden"
      role="navigation"
    >
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className={cn(
              "relative flex min-w-[56px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors",
              active ? "text-fg" : "text-fg-3",
            )}
          >
            {active && (
              <motion.span
                layoutId="tab-active"
                className="absolute -top-[7px] h-[3px] w-7 rounded-full"
                style={{ background: "linear-gradient(90deg,#00ff88,#00c8ff)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon name={item.icon} className="h-[20px] w-[20px]" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useStash((s) => s.hydrated);
  const onboarded = useStash((s) => s.onboarded);
  const complete = useStash((s) => s.completeOnboarding);
  const autoOnboarding = useRef(false);

  useEffect(() => {
    if (!hydrated || onboarded || autoOnboarding.current) return;
    autoOnboarding.current = true;
    const { tag, name } = generateAnonProfile();
    void complete({ tag, name, avatar: null });
  }, [hydrated, onboarded, complete]);

  return (
    <div className="min-h-dvh">
      <Titlebar />
      <Sidebar />
      <div className="lg:pl-[236px]">
        <MobileTopBar />
        <main className="min-h-dvh pb-24 lg:pb-0">{children}</main>
      </div>
      <BottomTabs />
    </div>
  );
}
