/**
 * InvestorMap — lightweight, dependency-free interactive map of the AMUMA
 * destinations. Clickable nodes (admin-editable `mapNodes`) show a detail
 * panel. Pure inline SVG + Tailwind — no Leaflet/Mapbox, no paid tiles.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { MapPin } from "lucide-react";
import type { InvestorMapNode } from "../../context/SiteContext";

const STATUS_COLOR: Record<InvestorMapNode["status"], string> = {
  Planned: "#b5b09e",
  Construction: "#d9c27e",
  Open: "#9bbf6d",
};

// Stylised Philippines silhouette (viewBox 0 0 100 100). Decorative only.
const PH_OUTLINE =
  "M22,18 C30,12 38,16 40,22 C44,18 50,20 50,26 C58,22 66,26 66,34 C74,34 80,40 78,48 " +
  "C84,52 86,60 80,64 C82,72 74,78 68,74 C70,82 60,86 54,80 C50,88 40,86 38,78 " +
  "C30,80 22,74 24,66 C16,62 14,52 20,48 C12,42 14,32 22,32 C14,28 16,20 22,18 Z";

interface Props {
  eyebrow?: string;
  title?: string;
  nodes: InvestorMapNode[];
}

export default function InvestorMap({ eyebrow, title, nodes }: Props) {
  const [activeId, setActiveId] = useState<string | null>(nodes[0]?.id ?? null);
  const active = nodes.find((n) => n.id === activeId) ?? null;

  if (!nodes.length) return null;

  const fade = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  };

  return (
    <motion.div {...fade} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
      <div className="lg:col-span-7 space-y-5">
        {eyebrow && <span className="eyebrow text-gold-300 block">{eyebrow}</span>}
        {title && <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{title}</h3>}
        <div className="relative w-full max-w-xl mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-auto" role="img" aria-label="Map of AMUMA destinations">
            <path d={PH_OUTLINE} fill="#e5e2d9" fillOpacity={0.18} stroke="#b5b09e" strokeWidth={0.6} />
            {nodes.map((n) => {
              const sel = n.id === activeId;
              const color = STATUS_COLOR[n.status];
              return (
                <g key={n.id} className="cursor-pointer" onClick={() => setActiveId(n.id)}>
                  {sel && (
                    <circle cx={n.x} cy={n.y} r={5.5} fill={color} fillOpacity={0.22}>
                      <animate attributeName="r" values="4;6.5;4" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={sel ? 2.6 : 2}
                    fill={color}
                    stroke="#f9f8f6"
                    strokeWidth={0.5}
                  />
                  <text
                    x={n.x}
                    y={n.y - 4}
                    textAnchor="middle"
                    fontSize={3}
                    fill="#2d2d2d"
                    fontFamily="serif"
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-4 justify-center">
          {nodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setActiveId(n.id)}
              className={`inline-flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase font-sans transition-colors ${
                n.id === activeId ? "text-gold-300" : "text-luxury-400 hover:text-gold-300"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[n.status] }} />
              {n.name}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="glass-panel p-8 space-y-4 min-h-[180px]">
          {active ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="font-serif text-2xl text-luxury-100 font-light">{active.name}</h4>
                <span
                  className="text-[10px] tracking-[0.22em] uppercase font-sans"
                  style={{ color: STATUS_COLOR[active.status] }}
                >
                  {active.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-luxury-400 font-sans">
                <MapPin size={12} className="text-gold-400" /> Opening {active.openingYear}
              </div>
              <p className="text-sm text-luxury-300 font-sans font-light leading-relaxed">{active.detail}</p>
            </>
          ) : (
            <p className="text-sm text-luxury-400 font-sans font-light">Select a destination to see details.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
