/**
 * INVESTORS — AMUMA Collection investor section.
 *
 * Layout mirrors the AMUMA investor page reference: header band, what we're
 * building, unit typologies, capital snapshot, timeline, circle model and a
 * closing "Founding Circle" band with a Request Investor Deck form.
 *
 * Rendered inside the BAIA one-pager, using BAIA's own tokens so it reads as
 * part of the site rather than a pasted-in page.
 */

import { useState } from "react";
import { motion } from "motion/react";
import {
  BedDouble,
  Home,
  MapPin,
  Compass,
  Ruler,
  Users,
  Maximize,
  Sprout,
  TrendingUp,
  KeyRound,
  Landmark,
  ArrowRight,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionStamp, TideDivider } from "./Editorial";
import geminiImg from "@/assets/amuma-gemini-suite.jpg";
import villaImg from "@/assets/amuma-villa.jpg";

/** Indicative FX used for the PHP figures shown alongside USD quotes. */
const PHP_PER_USD = 58.4;
const php = (usd: number) =>
  `₱${Math.round((usd * PHP_PER_USD) / 1000) * 1000}`.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );

const BUILDING_STATS = [
  { icon: BedDouble, value: "4", label: "Suites" },
  { icon: Home, value: "2", label: "Villas" },
  { icon: MapPin, value: "San Vicente", label: "Palawan, Philippines" },
  { icon: Compass, value: "Balabac", label: "In development" },
];

const UNITS = [
  {
    name: "Gemini Suite",
    code: "TS62",
    image: geminiImg,
    footprint: "6.5 × 11 m",
    interior: "62 sqm interior · 120 sqm footprint",
    guests: "2 guests · bedroom, lounge, bathroom",
    usd: 17850,
    qty: "2 units planned",
  },
  {
    name: "Villa",
    code: "ALT24",
    image: villaImg,
    footprint: "3.3 × 8.5 m",
    interior: "24 sqm interior",
    guests: "2 guests · bedroom, bathroom",
    usd: 12460,
    qty: "2 units planned",
  },
];

const TIMELINE = [
  {
    year: "2026",
    title: "Planning & Founding Circle",
    points: ["Circle launch", "Permits and site works", "Unit procurement"],
  },
  {
    year: "2027",
    title: "Construction",
    points: ["Site development", "Suites and villas installed", "Landscaping"],
  },
  {
    year: "2028",
    title: "AMUMA San Vicente opens",
    points: ["First guests welcomed", "Rental income begins", "Pebbles activated"],
  },
  {
    year: "2029",
    title: "Balabac groundbreaking",
    points: ["Second destination", "New Circle offering", "Regional expansion"],
  },
];

const CIRCLE_BENEFITS = [
  { icon: TrendingUp, title: "Shared Growth", copy: "60% of rental profits distributed to Circle Members." },
  { icon: KeyRound, title: "Lifestyle Access", copy: "Annual Pebbles for stays and experiences across AMUMA." },
  { icon: Sprout, title: "Aligned Values", copy: "Low-impact builds that nurture the land and the community." },
  { icon: Landmark, title: "Long-term Value", copy: "Land secured, TIEZA-registered, 60% Filipino-owned structure." },
];

export default function Investors() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

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
            <span className="eyebrow text-gold-300 block">Investors</span>
            <SectionStamp label="AMUMA Collection" />
            <h2 className="display-heading text-4xl md:text-6xl lg:text-7xl text-luxury-100">
              From proven places to visionary expansion
            </h2>
          </div>
          <div className="lg:col-span-5 space-y-6">
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-loose">
              We built BAIA and Marina Terrace. AMUMA takes everything we learned and
              builds a constellation of barefoot boutique resorts across the Philippines —
              beginning on Long Beach, San Vicente.
            </p>
            <a
              href="#investor-deck"
              className="inline-flex items-center gap-3 border border-gold-500 text-gold-300 px-7 py-3 text-[11px] tracking-[0.25em] uppercase font-sans font-medium hover:bg-gold-500 hover:text-white transition-all duration-500"
            >
              Request Investor Deck <ArrowRight size={14} />
            </a>
          </div>
        </motion.div>

        <TideDivider />

        {/* 2. WHAT WE'RE BUILDING */}
        <motion.div {...fade} className="space-y-10">
          <div className="space-y-4 max-w-3xl">
            <span className="eyebrow text-gold-300 block">What we're building</span>
            <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">AMUMA San Vicente</h3>
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-loose">
              Land is secured in San Vicente and Balabac. Private courtyards, plunge pools and
              open living spaces built from wood, stone and earth tones — operated with the same
              team behind BAIA Beachfront Boutique Lodge and Marina Terrace.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-luxury-800/40">
            {BUILDING_STATS.map((s) => (
              <div key={s.label} className="bg-luxury-950 p-6 md:p-8 space-y-3">
                <s.icon size={20} className="text-gold-400" strokeWidth={1.2} />
                <div className="font-serif text-2xl md:text-3xl text-luxury-100 font-light">{s.value}</div>
                <div className="text-[10px] tracking-[0.25em] uppercase text-luxury-400 font-sans">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 3. UNIT TYPOLOGIES */}
        <motion.div {...fade} className="space-y-10">
          <div className="space-y-4 max-w-2xl">
            <span className="eyebrow text-gold-300 block">Unit typologies</span>
            <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">Two forms of shelter</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
            {UNITS.map((u) => (
              <article key={u.name} className="group space-y-6">
                <div className="overflow-hidden">
                  <img
                    src={u.image}
                    alt={`${u.name} architectural rendering`}
                    loading="lazy"
                    width={1280}
                    height={864}
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
                    <li className="flex items-center gap-3"><Ruler size={14} className="text-gold-400" /> {u.footprint}</li>
                    <li className="flex items-center gap-3"><Maximize size={14} className="text-gold-400" /> {u.interior}</li>
                    <li className="flex items-center gap-3"><Users size={14} className="text-gold-400" /> {u.guests}</li>
                  </ul>
                  <div className="pt-2">
                    <div className="font-serif text-2xl text-gold-300 font-light">{php(u.usd)}</div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-luxury-400 font-sans mt-1">
                      ≈ ${u.usd.toLocaleString()} USD each · {u.qty}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </motion.div>

        {/* 4. CAPITAL SNAPSHOT */}
        <motion.div {...fade} className="glass-panel p-8 md:p-12 space-y-8">
          <div className="space-y-3">
            <span className="eyebrow text-gold-300 block">Capital snapshot</span>
            <h3 className="display-heading text-2xl md:text-4xl text-luxury-100">Indicative unit costs</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { k: "Gemini Suite", v: php(17850), s: "≈ $17,850 USD each" },
              { k: "Villa", v: php(12460), s: "≈ $12,460 USD each" },
              { k: "Shipping & install", v: "Quoted separately", s: "Per shipment, on request" },
            ].map((row) => (
              <div key={row.k} className="space-y-2">
                <div className="text-[10px] tracking-[0.25em] uppercase text-luxury-400 font-sans">{row.k}</div>
                <div className="font-serif text-xl md:text-2xl text-luxury-100 font-light">{row.v}</div>
                <div className="text-[11px] text-luxury-400 font-sans font-light">{row.s}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-luxury-400 font-sans font-light leading-relaxed">
            All unit costs are EXW Guangzhou, China, excluding freight, duties and site works.
            Peso figures are indicative, converted at ₱{PHP_PER_USD.toFixed(2)} / USD.
          </p>
        </motion.div>

        {/* 5. PROJECT TIMELINE */}
        <motion.div {...fade} className="space-y-12">
          <div className="space-y-4 max-w-2xl">
            <span className="eyebrow text-gold-300 block">Project timeline</span>
            <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">2026 — 2029</h3>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-6">
            <div className="hidden md:block absolute left-0 right-0 top-[7px] h-px bg-gradient-to-r from-gold-500/50 via-gold-500/20 to-transparent" />
            {TIMELINE.map((t) => (
              <div key={t.year} className="relative space-y-4">
                <span className="block w-3.5 h-3.5 rounded-full border border-gold-500 bg-luxury-950" />
                <div className="font-serif text-3xl text-gold-300 font-light">{t.year}</div>
                <div className="text-sm text-luxury-100 font-sans font-medium">{t.title}</div>
                <ul className="space-y-1.5">
                  {t.points.map((p) => (
                    <li key={p} className="text-xs text-luxury-400 font-sans font-light flex gap-2">
                      <span className="text-gold-500/70">—</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 6. CIRCLE MODEL */}
        <motion.div {...fade} className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="eyebrow text-gold-300 block">The Circle model</span>
            <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">60 / 40</h3>
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-loose">
              Circle Units are membership shares that entitle holders to rental profit
              distributions. Sixty percent of rental profits are distributed to Circle Members,
              forty percent is retained by AMUMA as operator. Pebbles — the internal lifestyle
              credit — are issued annually for stays and experiences.
            </p>
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32 shrink-0">
                <span className="absolute left-0 top-0 w-24 h-24 rounded-full border border-gold-500/70 bg-gold-500/10" />
                <span className="absolute right-0 bottom-0 w-20 h-20 rounded-full border border-luxury-600/60 bg-luxury-800/10" />
              </div>
              <div className="space-y-2 text-xs font-sans">
                <div className="text-gold-300 tracking-[0.2em] uppercase">60% Circle Members</div>
                <div className="text-luxury-400 tracking-[0.2em] uppercase">40% AMUMA operator</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-px bg-luxury-800/40">
            {CIRCLE_BENEFITS.map((b) => (
              <div key={b.title} className="bg-luxury-950 p-7 space-y-3">
                <b.icon size={20} className="text-gold-400" strokeWidth={1.2} />
                <div className="text-sm text-luxury-100 font-sans font-medium">{b.title}</div>
                <p className="text-xs text-luxury-400 font-sans font-light leading-relaxed">{b.copy}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <TideDivider />

        {/* 7. CLOSING BAND — FOUNDING CIRCLE */}
        <motion.div {...fade} id="investor-deck" className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-6 space-y-5">
            <span className="eyebrow text-gold-300 block">Founding Circle</span>
            <h3 className="display-heading text-3xl md:text-5xl text-luxury-100">
              Be part of something rare and enduring
            </h3>
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-loose">
              Founding Circle members receive early access, a name on the founding plaque and an
              invitation to the founders' dinner at BAIA. Limited memberships available.
            </p>
            <p className="text-[11px] text-luxury-400 font-sans font-light leading-relaxed">
              This section is informational only and is not an offer to sell securities. Securities
              are not offered or sold in the United States or to U.S. persons. Projections are
              forward-looking and subject to construction, market and regulatory risk.
            </p>
          </div>

          <form onSubmit={submit} className="lg:col-span-6 glass-panel p-8 md:p-10 space-y-5">
            <div className="text-[10px] tracking-[0.25em] uppercase text-luxury-400 font-sans">
              Request the investor deck
            </div>
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
                {state === "sending" ? "Sending…" : "Request Investor Deck"} <ArrowRight size={14} />
              </button>
            )}
          </form>
        </motion.div>
      </div>
    </section>
  );
}
