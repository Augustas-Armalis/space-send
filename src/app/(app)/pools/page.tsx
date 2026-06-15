"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { shortId } from "@/lib/ids";
import { poolHref } from "@/lib/site";
import { fadeUp } from "@/lib/motion";

/* A Pool is a shared cloud folder. Anyone with its link can drop files in or
   pull them out — like a temporary, account-less Dropbox folder. We remember
   pools you've opened locally so you can hop back in. */

const LS_KEY = "spacesend-recent-pools";

export default function PoolsPage() {
  const router = useRouter();
  const [recent, setRecent] = useState<string[]>([]);
  const [joinId, setJoinId] = useState("");

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
    } catch {
      setRecent([]);
    }
  }, []);

  const remember = (id: string) => {
    try {
      const next = [id, ...recent.filter((x) => x !== id)].slice(0, 12);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      setRecent(next);
    } catch {
      /* ignore */
    }
  };

  const createPool = () => {
    const id = shortId();
    remember(id);
    router.push(poolHref(id));
  };

  const join = () => {
    const id = joinId.trim().replace(/.*[?&]p=/, "").replace(/[^a-z0-9]/gi, "");
    if (!id) return;
    remember(id);
    router.push(poolHref(id));
  };

  return (
    <Page>
      <PageHeader
        title="Pools"
        sub="Shared cloud folders. Anyone with the link can drop files in or grab them out — no account."
        icon={<Icon name="Waves" className="h-6 w-6 text-cyan" />}
      />

      <motion.div variants={fadeUp} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2">
        <GlassPanel glow className="flex flex-col items-start gap-3 p-6">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/[0.08] text-[#00e5c8]">
            <Icon name="Plus" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-medium text-fg">Create a pool</h2>
            <p className="mt-1 text-sm text-fg-3">Spin up a fresh shared folder and send the link to your team.</p>
          </div>
          <Button variant="primary" icon="Waves" onClick={createPool} className="mt-1">
            New pool
          </Button>
        </GlassPanel>

        <GlassPanel className="flex flex-col items-start gap-3 p-6">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#00c8ff]/20 bg-[#00c8ff]/[0.08] text-[#00c8ff]">
            <Icon name="ArrowRight" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-medium text-fg">Join a pool</h2>
            <p className="mt-1 text-sm text-fg-3">Paste a pool link or id to hop in.</p>
          </div>
          <div className="mt-1 flex w-full gap-2">
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="pool id or link"
              className="h-10 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-[#00c8ff]/40"
            />
            <Button variant="secondary" onClick={join} disabled={!joinId.trim()}>
              Enter
            </Button>
          </div>
        </GlassPanel>
      </motion.div>

      {recent.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow mb-3">Recent pools</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {recent.map((id) => (
              <button
                key={id}
                onClick={() => router.push(poolHref(id))}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-left transition-colors hover:border-white/15"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-[#00c8ff]">
                  <Icon name="Waves" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mono truncate text-sm text-fg">Pool · {id}</p>
                  <p className="text-[11px] text-fg-3">Tap to open</p>
                </div>
                <Icon name="ChevronRight" className="h-4 w-4 text-fg-3" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}
