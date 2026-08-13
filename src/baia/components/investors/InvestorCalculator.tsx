/**
 * InvestorCalculator — interactive Circle participation calculator.
 * Admin-editable via `tiers` + `calculatorPerUnitPhp` in SiteContext.
 * All maths are pure and client-side; no external deps, no paid services.
 */

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import type { InvestorTier } from "../../context/SiteContext";

const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-US")}`;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* Linear interpolation across the sorted tier list for any investment amount. */
function interpolate(tiers: InvestorTier[], investment: number) {
  const sorted = [...tiers].sort((a, b) => a.investmentPhp - b.investmentPhp);
  if (sorted.length === 0) return { pebbles: 0, roiLow: 0, roiHigh: 0 };
  const min = sorted[0].investmentPhp;
  const max = sorted[sorted.length - 1].investmentPhp;
  const v = clamp(investment, min, max);

  let lo = sorted[0];
  let hi = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (v >= sorted[i].investmentPhp && v <= sorted[i + 1].investmentPhp) {
      lo = sorted[i];
      hi = sorted[i + 1];
      break;
    }
  }
  const span = hi.investmentPhp - lo.investmentPhp;
  const t = span > 0 ? (v - lo.investmentPhp) / span : 0;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    pebbles: Math.round(lerp(lo.annualPebbles, hi.annualPebbles)),
    roiLow: lerp(lo.roiLowPct, hi.roiLowPct),
    roiHigh: lerp(lo.roiHighPct, hi.roiHighPct),
  };
}

interface Props {
  eyebrow?: string;
  title?: string;
  note?: string;
  perUnitPhp: number;
  tiers: InvestorTier[];
  ctaLabel: string;
}

export default function InvestorCalculator({ eyebrow, title, note, perUnitPhp, tiers, ctaLabel }: Props) {
  const sorted = useMemo(() => [...tiers].sort((a, b) => a.investmentPhp - b.investmentPhp), [tiers]);
  const min = sorted.length ? sorted[0].investmentPhp : 0;
  const max = sorted.length ? sorted[sorted.length - 1].investmentPhp : 0;

  const [investment, setInvestment] = useState<number>(min);

  // Snap to the nearest declared tier for the "selected tier" chip.
  const nearest = useMemo(() => {
    if (!sorted.length) return null;
    return sorted.reduce((best, t) =>
      Math.abs(t.investmentPhp - investment) < Math.abs(best.investmentPhp - investment) ? t : best,
    );
  }, [sorted, investment]);

  const units = perUnitPhp > 0 ? Math.round(investment / perUnitPhp) : 0;
  const { pebbles, roiLow, roiHigh } = interpolate(tiers, investment);
  const annualLow = investment * (roiLow / 100);
  const annualHigh = investment * (roiHigh / 100);

  if (!sorted.length) return null;

  const fade = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  };

  return (
    <motion.div {...fade} className="glass-panel p-8 md:p-12 space-y-10">
      <div className="space-y-3 max-w-2xl">
        {eyebrow && <span className="eyebrow text-gold-300 block">{eyebrow}</span>}
        {title && <h3 className="display-heading text-2xl md:text-4xl text-luxury-100">{title}</h3>}
      </div>

      {/* Slider */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] tracking-[0.25em] uppercase text-luxury-400 font-sans">
            Your participation
          </span>
          <span className="font-serif text-3xl md:text-4xl text-gold-300 font-light">{peso(investment)}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={perUnitPhp > 0 ? perUnitPhp : 1000}
          value={investment}
          onChange={(e) => setInvestment(Number(e.target.value))}
          className="w-full accent-gold-500"
          aria-label="Investment amount"
        />
        <div className="flex justify-between text-[10px] tracking-[0.18em] uppercase text-luxury-500 font-sans">
          <span>{peso(min)}</span>
          <span>{peso(max)}</span>
        </div>
      </div>

      {/* Tier chips */}
      <div className="flex flex-wrap gap-2">
        {sorted.map((t) => {
          const active = nearest?.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setInvestment(t.investmentPhp)}
              className={`px-4 py-2 text-[10px] tracking-[0.2em] uppercase font-sans border transition-colors ${
                active
                  ? "border-gold-500 text-gold-300 bg-gold-500/10"
                  : "border-luxury-800 text-luxury-400 hover:border-gold-500/60 hover:text-gold-300"
              }`}
            >
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Live results */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-luxury-800/40">
        <Result label="Circle Units" value={units.toLocaleString()} />
        <Result label="Annual Pebbles" value={pebbles.toLocaleString()} />
        <Result label="Projected ROI" value={`${roiLow.toFixed(0)}–${roiHigh.toFixed(0)}%`} />
        <Result
          label="Est. annual return"
          value={`${peso(annualLow)} – ${peso(annualHigh)}`}
          small
        />
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <p className="text-[11px] text-luxury-400 font-sans font-light leading-relaxed max-w-xl">
          {note ??
            "Indicative only. Amounts are illustrative and not an offer. Return ranges reflect management projections and are not guaranteed."}
        </p>
        <a
          href="#investor-deck"
          className="inline-flex items-center gap-3 border border-gold-500 text-gold-300 px-7 py-3 text-[11px] tracking-[0.25em] uppercase font-sans font-medium hover:bg-gold-500 hover:text-white transition-all duration-500"
        >
          {ctaLabel} <ArrowRight size={14} />
        </a>
      </div>

      <p className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-luxury-500 font-sans">
        <Sparkles size={12} className="text-gold-400" /> Figures update live as you move the slider.
      </p>
    </motion.div>
  );
}

function Result({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-luxury-950 p-6 space-y-2">
      <div className="text-[10px] tracking-[0.22em] uppercase text-luxury-400 font-sans">{label}</div>
      <div className={`font-serif text-gold-300 font-light ${small ? "text-base md:text-lg" : "text-2xl md:text-3xl"}`}>
        {value}
      </div>
    </div>
  );
}
