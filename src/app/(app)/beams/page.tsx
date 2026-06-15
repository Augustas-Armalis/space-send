"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Page, PageHeader } from "@/components/shell/Page";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useTransfers } from "@/store/transfers";
import { formatBytes, formatRelative } from "@/lib/format";
import { fadeUp } from "@/lib/motion";

/* Beams are live, one-time peer-to-peer sessions hosted from the Send screen —
   the operator console lives there while the tab is open. This page is the
   ledger: how Beam works + a history of the sessions you've started. */

export default function BeamsPage() {
  const beams = useTransfers((s) => s.beams);

  return (
    <Page>
      <PageHeader
        title="Beams"
        sub="Live peer-to-peer transfers, hosted straight from your device. No upload, no cloud, no size limit."
        icon={<Icon name="Radio" className="h-6 w-6 text-cyan" />}
        actions={
          <Link href="/">
            <Button variant="primary" icon="Radio">
              Start a Beam
            </Button>
          </Link>
        }
      />

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <GlassPanel glow className="mb-6 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Step icon="Plus" title="Select & host" body="On Send, choose Beam, pick files. Your device becomes the signal tower instantly — nothing uploads." />
            <Step icon="Link2" title="Share the link" body="Send the viewer link to anyone. They open it on any device and see your files." />
            <Step icon="Zap" title="They pull, you serve" body="Bytes stream browser-to-browser, DTLS-encrypted. Many people can download at once. Close the tab to end it." />
          </div>
        </GlassPanel>
      </motion.div>

      {beams.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Past beams</p>
          <div className="space-y-2">
            {beams.slice(0, 30).map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-cyan">
                  <Icon name="Radio" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">
                    {b.files.length === 1 ? b.files[0]?.name : `${b.files.length} files`}
                  </p>
                  <p className="mono text-[11px] text-fg-3">
                    {formatBytes(b.files.reduce((a, f) => a + f.size, 0))} · {formatRelative(b.createdAt)}
                  </p>
                </div>
                <span className="mono text-[10px] uppercase tracking-wide text-fg-3">{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}

function Step({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#00c8ff]/20 bg-[#00c8ff]/[0.08] text-[#00c8ff]">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="text-[12px] leading-relaxed text-fg-3">{body}</p>
    </div>
  );
}
