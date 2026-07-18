/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, Compass, Timer } from "lucide-react";
import { motion } from "motion/react";
import { useSite } from "../context/SiteContext";
import { SectionStamp } from "./Editorial";

interface ActivitiesProps {
  onBookClick: () => void;
}

export default function Activities({ onBookClick }: ActivitiesProps) {
  const { activities } = useSite();
  return (
    <section
      id="experiences"
      className="py-28 md:py-40 lg:py-48 bg-luxury-900 border-t border-b border-luxury-800/60 text-left relative overflow-hidden"
    >
      {/* Muted-green structural wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-moss-800/[0.05] via-transparent to-sand-200/[0.05]" />
      <span aria-hidden className="ghost-numeral -top-10 left-4">
        03
      </span>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
        {/* Asymmetric split header — display title left, intro dropped low-right */}
        <div
          id="activities-title"
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-16 lg:mb-24 items-end"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-5"
          >
            <span className="eyebrow text-gold-300 block">CURATED ADVENTURES</span>
            <SectionStamp label="Guided by locals" />
            <h2 className="display-heading text-4xl md:text-6xl lg:text-7xl text-luxury-100">
              Curated Experiences &<br />
              Local Traditions
            </h2>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="lg:col-span-4 lg:col-start-9 text-sm md:text-base text-luxury-400 leading-loose tracking-wide font-sans font-light"
          >
            At BAIA, we believe true luxury lies in deep connection. Let our expert local guides
            orchestrate unforgettable days customized to your desired flow—from riding world-class
            swells to floating through silent lagoons.
          </motion.p>
        </div>

        {/* Experience Cards Grid — center card drops for editorial asymmetry */}
        <div id="activities-grid" className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {activities.map((act, index) => (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.9, delay: (index % 3) * 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={`bg-luxury-950 border border-luxury-800 group overflow-hidden flex flex-col justify-between hover:border-gold-500/40 hover-lift rounded-sm ${index % 3 === 1 ? "md:mt-16" : ""}`}
            >
              <div>
                <div className="aspect-[16/10] overflow-hidden bg-luxury-900 relative">
                  <img
                    src={act.imageUrl}
                    alt={act.title}
                    className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-1000 ease-(--ease-editorial)"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-luxury-950/50 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute top-4 left-4 bg-luxury-950/80 backdrop-blur-sm px-2.5 py-1 text-[9px] tracking-widest text-gold-300 uppercase rounded-sm border border-gold-500/20 font-bold">
                    {act.category}
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-3 group-hover:text-gold-300 transition-colors duration-500">
                    {act.title}
                  </h3>
                  <p className="text-xs text-luxury-300 leading-relaxed font-sans font-light">
                    {act.description}
                  </p>
                </div>
              </div>

              <div className="px-6 md:px-8 pb-6 md:pb-8">
                <div className="grid grid-cols-3 gap-2 py-3.5 border-t border-b border-luxury-800/40 text-[10px] text-luxury-400 font-sans uppercase mb-6">
                  <div className="flex flex-col space-y-1 text-left">
                    <span className="text-luxury-500 font-medium tracking-wider">DURATION</span>
                    <span className="text-luxury-100 font-semibold flex items-center gap-1">
                      <Timer size={10} className="text-gold-400" /> {act.duration}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-1 text-left border-l border-r border-luxury-800/40 px-2">
                    <span className="text-luxury-500 font-medium tracking-wider">DIFFICULTY</span>
                    <span className="text-luxury-100 font-semibold flex items-center gap-1">
                      <Compass size={10} className="text-gold-400" /> {act.difficulty}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-1 text-left pl-2">
                    <span className="text-luxury-500 font-medium tracking-wider">PRICE</span>
                    <span className="text-luxury-100 font-semibold truncate">
                      {act.price}
                    </span>
                  </div>
                </div>

                <button
                  onClick={onBookClick}
                  className="w-full text-center border border-luxury-700 hover:border-gold-300 hover:bg-gold-500/5 py-3 text-[10px] tracking-[0.2em] font-sans text-luxury-200 hover:text-gold-300 uppercase font-semibold transition-all duration-500 cursor-pointer"
                >
                  ARRANGE EXPERIENCE
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Custom concierge callout — floating glass block, offset left on desktop */}
        <motion.div
          id="custom-concierge-callout"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 lg:mt-24 lg:mr-[10%] glass-panel p-8 lg:p-12 flex flex-col md:flex-row justify-between items-center gap-8"
        >
          <div className="text-left space-y-3 max-w-xl">
            <h3 className="display-heading text-2xl md:text-3xl text-luxury-100">
              Dreaming of a bespoke itinerary?
            </h3>
            <p className="text-xs md:text-sm text-luxury-300 leading-loose font-sans font-light tracking-wide">
              From island sunset proposals on private sandbars to deep-sea fishing charters and
              bespoke health detox programs, our specialist concierge team is here to tailor-make
              every moment of your stay.
            </p>
          </div>
          <button
            onClick={onBookClick}
            className="w-full md:w-auto bg-gold-500 hover:bg-gold-600 text-white px-8 py-4 text-[11px] tracking-widest font-sans font-bold uppercase transition-all duration-500 ease-(--ease-lift) hover:-translate-y-1 hover:shadow-xl flex items-center justify-center space-x-2 cursor-pointer shrink-0"
          >
            <span>Consult our Concierge</span>
            <Sparkles size={12} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
