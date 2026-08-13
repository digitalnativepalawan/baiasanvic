/**
 * InvestorMedia — progress wall: admin adds images and/or videos of the build.
 * Renders a responsive grid; videos use VideoEmbed, images open the shared
 * lightbox via the optional `onOpen` callback.
 */

import { motion } from "motion/react";
import type { InvestorMediaItem } from "../../context/SiteContext";
import VideoEmbed from "./VideoEmbed";

interface Props {
  eyebrow?: string;
  title?: string;
  items: InvestorMediaItem[];
  onOpen?: (url: string, caption: string) => void;
}

export default function InvestorMedia({ eyebrow, title, items, onOpen }: Props) {
  const visible = items.filter((m) => m.url.trim() !== "");
  if (!visible.length) return null;

  const fade = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  };

  return (
    <motion.div {...fade} className="space-y-10">
      <div className="space-y-4 max-w-2xl">
        {eyebrow && <span className="eyebrow text-gold-300 block">{eyebrow}</span>}
        {title && <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{title}</h3>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((m) =>
          m.kind === "video" ? (
            <VideoEmbed key={m.id} url={m.url} poster={m.poster} caption={m.caption} />
          ) : (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen?.(m.url, m.caption)}
              className="group relative text-left overflow-hidden bg-luxury-950"
            >
              <img
                src={m.url}
                alt={m.caption}
                loading="lazy"
                className="w-full h-56 md:h-72 object-cover transition-transform duration-[1400ms] ease-(--ease-editorial) group-hover:scale-105"
              />
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-luxury-950/90 to-transparent">
                <span className="block text-[10px] tracking-[0.18em] uppercase text-luxury-200 font-sans">
                  {m.caption}
                  {m.date ? ` · ${m.date}` : ""}
                </span>
              </div>
            </button>
          ),
        )}
      </div>
    </motion.div>
  );
}
