/**
 * INVESTORS — AMUMA Collection investor section.
 *
 * Every string, image, price, budget figure, project, timeline entry and
 * benefit is admin-editable and persisted with the rest of the site state.
 */

import { useState } from "react";
import { motion } from "motion/react";
import {
  Ruler,
  Users,
  Maximize,
  ArrowRight,
  Check,
  MapPin,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "../context/SiteContext";
import { SectionStamp, TideDivider } from "./Editorial";
import geminiImg from "@/assets/amuma-gemini-suite.jpg";
import villaImg from "@/assets/amuma-villa.jpg";
import InvestorCalculator from "./investors/InvestorCalculator";
import InvestorTimeline from "./investors/InvestorTimeline";
import InvestorMedia from "./investors/InvestorMedia";

const FALLBACK_UNIT_IMAGES = [geminiImg, villaImg];

const peso = (amount: number) =>
  `₱${Math.round(amount).toLocaleString("en-US")}`;

export default function Investors() {
  const { investors: inv } = useSite();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [lightbox, setLightbox] = useState<{ url: string; caption: string } | null>(null);

  if (!inv.enabled) return null;

  const usdToPhp = (usd: number) => peso(usd * (inv.phpPerUsd || 1));

  const thumbs = (images?: { id: string; url: string; caption: string }[], cols = "grid-cols-3") =>
    images && images.length > 0 ? (
      <div className={`grid ${cols} gap-2`}>
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightbox({ url: img.url, caption: img.caption })}
            className="group/thumb text-left"
          >
            <img
              src={img.url}
              alt={img.caption || "Project image"}
              loading="lazy"
              className="w-full h-20 md:h-24 object-cover transition-opacity duration-500 opacity-80 group-hover/thumb:opacity-100"
            />
            {img.caption && (
              <span className="mt-1 block text-[9px] tracking-[0.18em] uppercase text-luxury-400 font-sans truncate">
                {img.caption}
              </span>
            )}
          </button>
        ))}
      </div>
    ) : null;

  const totalAllocated = inv.budgetItems.reduce((s, b) => s + (b.allocatedPhp || 0), 0);
  const totalInjected = inv.budgetItems.reduce((s, b) => s + (b.injectedPhp || 0), 0);
  const totalPct = totalAllocated > 0 ? Math.min(100, (totalInjected / totalAllocated) * 100) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setState("error");
      return;
    }
    setState("sending");
    const { error } = await supabase.from("booking_inquiries").insert({
      guest_name: name.trim(),
      guest_email: email.trim(),
      guests_count: 1,
      total_nights: 0,
      total_price: 0,
      room_tier_name: "Investor — AMUMA Founding Circle",
      special_requests: `INVESTOR DECK REQUEST\n${message.trim()}`,
      status: "pending",
    });
    if (error) {
      setState("error");
      return;
    }
    setState("done");
    setName("");
    setEmail("");
    setMessage("");
  };

  const fade = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  };

  return (
    <section
      id="investors"
      className="relative py-28 md:py-40 bg-luxury-950 border-t border-luxury-800/40 text-left overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ocean-900/[0.08] via-transparent to-sand-200/[0.05]" />
      <span aria-hidden className="ghost-numeral -top-10 left-4">
        06
      </span>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 space-y-24 md:space-y-32">
        {/* 1. HEADER BAND */}
        <motion.div {...fade} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7 space-y-5">
            <span className="eyebrow text-gold-300 block">{inv.eyebrow}</span>
            <SectionStamp label="AMUMA Collection" />
            <h2 className="display-heading text-4xl md:text-6xl lg:text-7xl text-luxury-100">{inv.title}</h2>
          </div>
          <div className="lg:col-span-5 space-y-6">
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-loose whitespace-pre-line">
              {inv.intro}
            </p>
            <a
              href="#investor-deck"
              className="inline-flex items-center gap-3 border border-gold-500 text-gold-300 px-7 py-3 text-[11px] tracking-[0.25em] uppercase font-sans font-medium hover:bg-gold-500 hover:text-white transition-all duration-500"
            >
              {inv.ctaLabel} <ArrowRight size={14} />
            </a>
          </div>
        </motion.div>

        <TideDivider />

        {/* 2. PROJECTS / WHAT WE'RE BUILDING */}
        <motion.div {...fade} className="space-y-12">
          <div className="space-y-4 max-w-3xl">
            <span className="eyebrow text-gold-300 block">{inv.projectsEyebrow}</span>
            <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{inv.projectsTitle}</h3>
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-loose whitespace-pre-line">
              {inv.projectsBody}
            </p>
          </div>

          {inv.stats.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-luxury-800/40">
              {inv.stats.map((s) => (
                <div key={s.id} className="bg-luxury-950 p-6 md:p-8 space-y-3">
                  <div className="font-serif text-2xl md:text-3xl text-luxury-100 font-light">{s.value}</div>
                  <div className="text-[10px] tracking-[0.25em] uppercase text-luxury-400 font-sans">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {inv.projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {inv.projects.map((p) => (
                <article key={p.id} className="group space-y-5">
                  {p.imageUrl && (
                    <div className="overflow-hidden">
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-56 md:h-72 object-cover transition-transform duration-[1400ms] ease-(--ease-editorial) group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="space-y-3">
                    <h4 className="font-serif text-2xl text-luxury-100 font-light uppercase tracking-[0.06em]">{p.name}</h4>
                    <div className="editorial-rule" />
                    <div className="flex items-center gap-2 text-[10px] tracking-[0.22em] uppercase text-luxury-400 font-sans">
                      <MapPin size={12} className="text-gold-400" /> {p.location}
                    </div>
                    <div className="text-[11px] tracking-[0.18em] uppercase text-gold-300 font-sans">{p.status}</div>
                    <p className="text-xs md:text-sm text-luxury-300 font-sans font-light leading-relaxed whitespace-pre-line">
                      {p.description}
                    </p>
                    {thumbs(p.gallery)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </motion.div>

        {/* 2b. removed: interactive destination map */}

        {/* 3. UNIT TYPOLOGIES */}
        {inv.units.length > 0 && (
          <motion.div {...fade} className="space-y-10">
            <div className="space-y-4 max-w-2xl">
              <span className="eyebrow text-gold-300 block">{inv.unitsEyebrow}</span>
              <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{inv.unitsTitle}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
              {inv.units.map((u, i) => (
                <article key={u.id} className="group space-y-6">
                  <div className="overflow-hidden">
                    <img
                      src={u.imageUrl || FALLBACK_UNIT_IMAGES[i % FALLBACK_UNIT_IMAGES.length]}
                      alt={`${u.name} rendering`}
                      loading="lazy"
                      className="w-full h-64 md:h-80 object-cover transition-transform duration-[1400ms] ease-(--ease-editorial) group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <h4 className="font-serif text-2xl md:text-3xl text-luxury-100 font-light uppercase tracking-[0.06em]">
                        {u.name}
                      </h4>
                      <span className="text-[10px] tracking-[0.25em] uppercase text-luxury-400 font-sans">{u.code}</span>
                    </div>
                    <div className="editorial-rule" />
                    <ul className="space-y-2 text-xs md:text-sm text-luxury-300 font-sans font-light">
                      {u.footprint && <li className="flex items-center gap-3"><Ruler size={14} className="text-gold-400" /> {u.footprint}</li>}
                      {u.interior && <li className="flex items-center gap-3"><Maximize size={14} className="text-gold-400" /> {u.interior}</li>}
                      {u.guests && <li className="flex items-center gap-3"><Users size={14} className="text-gold-400" /> {u.guests}</li>}
                    </ul>
                    <div className="pt-2">
                      <div className="font-serif text-2xl text-gold-300 font-light">{usdToPhp(u.priceUsd)}</div>
                      <div className="text-[10px] tracking-[0.2em] uppercase text-luxury-400 font-sans mt-1">
                        ≈ ${Number(u.priceUsd || 0).toLocaleString()} USD each{u.quantityNote ? ` · ${u.quantityNote}` : ""}
                      </div>
                    </div>
                    {thumbs(u.gallery)}
                  </div>
                </article>
              ))}
            </div>
          </motion.div>
        )}

        {/* 3b. PLANS & RENDERINGS GALLERY */}
        {(inv.gallery ?? []).length > 0 && (
          <motion.div {...fade} className="space-y-10">
            <div className="space-y-4 max-w-2xl">
              <span className="eyebrow text-gold-300 block">{inv.galleryEyebrow}</span>
              <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{inv.galleryTitle}</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(inv.gallery ?? []).map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightbox({ url: img.url, caption: img.caption })}
                  className="group text-left"
                >
                  <div className="overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.caption || "Plan"}
                      loading="lazy"
                      className="w-full h-40 md:h-52 object-cover transition-transform duration-[1400ms] ease-(--ease-editorial) group-hover:scale-105"
                    />
                  </div>
                  {img.caption && (
                    <span className="mt-2 block text-[10px] tracking-[0.2em] uppercase text-luxury-400 font-sans">
                      {img.caption}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* 4. BUDGET INJECTED */}
        {inv.budgetItems.length > 0 && (
          <motion.div {...fade} className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-7 space-y-4">
                <span className="eyebrow text-gold-300 block">{inv.budgetEyebrow}</span>
                <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{inv.budgetTitle}</h3>
              </div>
              <div className="lg:col-span-5 space-y-2">
                <div className="font-serif text-3xl text-gold-300 font-light">{peso(totalInjected)}</div>
                <div className="text-[10px] tracking-[0.22em] uppercase text-luxury-400 font-sans">
                  injected of {peso(totalAllocated)} allocated · {totalPct.toFixed(0)}%
                </div>
                <div className="h-px w-full bg-luxury-800">
                  <div className="h-px bg-gold-500" style={{ width: `${totalPct}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {inv.budgetItems.map((b) => {
                const pct = b.allocatedPhp > 0 ? Math.min(100, (b.injectedPhp / b.allocatedPhp) * 100) : 0;
                return (
                  <div key={b.id} className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm text-luxury-100 font-sans font-light">{b.label}</span>
                      <span className="text-xs text-luxury-400 font-sans">
                        <span className="text-gold-300">{peso(b.injectedPhp)}</span> / {peso(b.allocatedPhp)}
                      </span>
                    </div>
                    <div className="h-[3px] w-full bg-luxury-800/70">
                      <div className="h-[3px] bg-gold-500/80" style={{ width: `${pct}%` }} />
                    </div>
                    {b.note && (
                      <div className="text-[10px] tracking-[0.2em] uppercase text-luxury-500 font-sans">{b.note}</div>
                    )}
                  </div>
                );
              })}
            </div>
            {inv.budgetNote && (
              <p className="text-[11px] text-luxury-400 font-sans font-light">{inv.budgetNote}</p>
            )}
          </motion.div>
        )}

        {/* 5. CAPITAL SNAPSHOT */}
        {inv.capitalRows.length > 0 && (
          <motion.div {...fade} className="glass-panel p-8 md:p-12 space-y-8">
            <div className="space-y-3">
              <span className="eyebrow text-gold-300 block">{inv.capitalEyebrow}</span>
              <h3 className="display-heading text-2xl md:text-4xl text-luxury-100">{inv.capitalTitle}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {inv.capitalRows.map((row, i) => {
                const unit = inv.units[i];
                const value = row.value || (unit ? usdToPhp(unit.priceUsd) : "—");
                return (
                  <div key={row.id} className="space-y-2">
                    <div className="text-[10px] tracking-[0.25em] uppercase text-luxury-400 font-sans">{row.label}</div>
                    <div className="font-serif text-xl md:text-2xl text-luxury-100 font-light">{value}</div>
                    <div className="text-[11px] text-luxury-400 font-sans font-light">{row.note}</div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-luxury-400 font-sans font-light leading-relaxed">
              {inv.capitalFootnote} Converted at ₱{Number(inv.phpPerUsd).toFixed(2)} / USD.
            </p>
          </motion.div>
        )}

        {/* 5b. INTERACTIVE CALCULATOR */}
        {inv.tiers.length > 0 && (
          <InvestorCalculator
            eyebrow={inv.calculatorEyebrow}
            title={inv.calculatorTitle}
            note={inv.calculatorNote}
            perUnitPhp={inv.calculatorPerUnitPhp}
            tiers={inv.tiers}
            ctaLabel={inv.ctaLabel}
          />
        )}

        {/* 6. PROJECT TIMELINE (interactive) */}
        {inv.timeline.length > 0 && (
          <InvestorTimeline
            eyebrow={inv.timelineEyebrow}
            title={inv.timelineTitle}
            detailLabel={inv.timelineDetailLabel}
            items={inv.timeline}
          />
        )}

        {/* 7. CIRCLE MODEL */}
        <motion.div {...fade} className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="eyebrow text-gold-300 block">{inv.circleEyebrow}</span>
            <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{inv.circleTitle}</h3>
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-loose whitespace-pre-line">
              {inv.circleBody}
            </p>
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32 shrink-0">
                <span className="absolute left-0 top-0 w-24 h-24 rounded-full border border-gold-500/70 bg-gold-500/10" />
                <span className="absolute right-0 bottom-0 w-20 h-20 rounded-full border border-luxury-600/60 bg-luxury-800/10" />
              </div>
              <div className="space-y-2 text-xs font-sans">
                <div className="text-gold-300 tracking-[0.2em] uppercase">{inv.circlePrimaryLabel}</div>
                <div className="text-luxury-400 tracking-[0.2em] uppercase">{inv.circleSecondaryLabel}</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-px bg-luxury-800/40">
            {inv.benefits.map((b) => (
              <div key={b.id} className="bg-luxury-950 p-7 space-y-3">
                <div className="text-sm text-luxury-100 font-sans font-medium">{b.title}</div>
                <p className="text-xs text-luxury-400 font-sans font-light leading-relaxed">{b.copy}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <TideDivider />

        {/* 7b. PROGRESS MEDIA WALL (images + video) */}
        {inv.media.length > 0 && (
          <InvestorMedia
            eyebrow={inv.mediaEyebrow}
            title={inv.mediaTitle}
            items={inv.media}
            onOpen={(url, caption) => setLightbox({ url, caption })}
          />
        )}

        <TideDivider />

        {/* 8. CLOSING BAND — FOUNDING CIRCLE */}
        <motion.div {...fade} id="investor-deck" className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-6 space-y-5">
            <span className="eyebrow text-gold-300 block">{inv.closingEyebrow}</span>
            <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">{inv.closingTitle}</h3>
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-loose whitespace-pre-line">
              {inv.closingBody}
            </p>
            <p className="text-[11px] text-luxury-400 font-sans font-light leading-relaxed whitespace-pre-line">
              {inv.disclaimer}
            </p>
          </div>

          <form onSubmit={submit} className="lg:col-span-6 glass-panel p-8 md:p-10 space-y-5">
            <div className="text-[10px] tracking-[0.25em] uppercase text-luxury-400 font-sans">{inv.formTitle}</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-transparent border-b border-luxury-700/60 focus:border-gold-500 outline-none py-3 text-sm text-luxury-100 font-sans font-light placeholder:text-luxury-500 transition-colors"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              className="w-full bg-transparent border-b border-luxury-700/60 focus:border-gold-500 outline-none py-3 text-sm text-luxury-100 font-sans font-light placeholder:text-luxury-500 transition-colors"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Country, interest level, or questions (optional)"
              rows={3}
              className="w-full bg-transparent border-b border-luxury-700/60 focus:border-gold-500 outline-none py-3 text-sm text-luxury-100 font-sans font-light placeholder:text-luxury-500 resize-none transition-colors"
            />
            {state === "error" && (
              <p className="text-[11px] text-gold-300 font-sans">
                Please enter your name and a valid email address, then try again.
              </p>
            )}
            {state === "done" ? (
              <p className="flex items-center gap-2 text-[11px] tracking-[0.15em] uppercase text-gold-300 font-sans">
                <Check size={14} /> Received — we'll be in touch shortly.
              </p>
            ) : (
              <button
                type="submit"
                disabled={state === "sending"}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 border border-gold-500 text-gold-300 px-8 py-3 text-[11px] tracking-[0.25em] uppercase font-sans font-medium hover:bg-gold-500 hover:text-white transition-all duration-500 disabled:opacity-50"
              >
                {state === "sending" ? "Sending…" : inv.ctaLabel} <ArrowRight size={14} />
              </button>
            )}
          </form>
        </motion.div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[120] bg-luxury-950/95 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close image"
            className="absolute top-6 right-6 text-luxury-300 hover:text-gold-300 transition-colors"
          >
            <X size={24} />
          </button>
          <figure className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.caption || "Investor image"}
              className="w-full max-h-[80vh] object-contain"
            />
            {lightbox.caption && (
              <figcaption className="mt-4 text-center text-[11px] tracking-[0.2em] uppercase text-luxury-300 font-sans">
                {lightbox.caption}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </section>
  );
}
