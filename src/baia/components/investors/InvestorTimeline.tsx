/**
 * InvestorTimeline — interactive roadmap. Milestones are clickable and open a
 * detail panel. `detail` is admin-editable per item in SiteContext.
 */

import { useState } from "react";
import { motion } from "motion/react";
import type { InvestorTimelineItem } from "../../context/SiteContext";

const PHASE_COLOR: Record<string, string> = {
  Planning: "#b5b09e",
  Construction: "#d9c27e",
  Opening: "#9bbf6d",
  Expansion: "#8fb5c4",
};

const colorFor = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes("construction")) return PHASE_COLOR.Construction;
  if (t.includes("open")) return PHASE_COLOR.Opening;
  if (t.includes("expansion") || t.includes("destinations")) return PHASE_COLOR.Expansion;
  return PHASE_COLOR.Planning;
};

interface Props {
  eyebrow?: string;
  title?: string;
  detailLabel?: string;
  items: InvestorTimelineItem[];
}

export default function InvestorTimeline({ eyebrow, title, detailLabel, items }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const active = items.find((i) => i.id === activeId) ?? null;

  if (!items.length) return null;

  const fade = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  };

  return (
    <motion.div {...fade} className="space-y-12">
      <div className="space-y-4 max-w-2xl">
        {eyebrow && <span className="eyebrow text-gold-300 block">{eyebrow}</span>}
        {title && <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{title}</h3>}
        {detailLabel && (
          <p className="text-[11px] tracking-[0.18em] uppercase text-luxury-500 font-sans">{detailLabel}</p>
        )}
      </div>

      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
        <div className="hidden md:block absolute left-0 right-0 top-[7px] h-px bg-gradient-to-r from-gold-500/50 via-gold-500/20 to-transparent" />
        {items.map((t) => {
          const sel = t.id === activeId;
          const c = colorFor(t.title);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className="relative text-left space-y-4 group"
            >
              <span
                className={`block w-3.5 h-3.5 rounded-full border transition-transform ${sel ? "scale-125" : "group-hover:scale-110"}`}
                style={{ borderColor: c, background: sel ? c : "transparent" }}
              />
              <div className="font-serif text-3xl font-light" style={{ color: c }}>
                {t.year}
              </div>
              <div className="text-sm text-luxury-100 font-sans font-medium">{t.title}</div>
            </button>
          );
        })}
      </div>

      <div className="glass-panel p-8 md:p-10 space-y-4">
        {active ? (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-serif text-2xl text-luxury-100 font-light">
                {active.year} — {active.title}
              </h4>
            </div>
            <ul className="space-y-1.5">
              {active.points.map((p, i) => (
                <li key={i} className="text-xs text-luxury-400 font-sans font-light flex gap-2">
                  <span className="text-gold-500/70">—</span> {p}
                </li>
              ))}
            </ul>
            {active.detail && (
              <p className="text-sm text-luxury-300 font-sans font-light leading-relaxed pt-2 border-t border-luxury-800/60">
                {active.detail}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-luxury-400 font-sans font-light">Select a milestone to read more.</p>
        )}
      </div>
    </motion.div>
  );
}
