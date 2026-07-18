/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, Compass, Timer } from "lucide-react";
import { motion } from "motion/react";
import { useSite } from "../context/SiteContext";

interface ActivitiesProps {
  onBookClick: () => void;
}

export default function Activities({ onBookClick }: ActivitiesProps) {
  const { activities } = useSite();
  return (
    <section id="experiences" className="py-28 md:py-36 bg-luxury-900 border-t border-b border-luxury-800/60 text-left relative overflow-hidden">
      <div className="wash-sand absolute inset-0 pointer-events-none opacity-70" />
      <span aria-hidden className="ghost-numeral right-4 top-6 md:right-10 md:top-10">03</span>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 z-10">
        {/* Split Header — title left, intro dropped right */}
        <div id="activities-title" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 mb-16 md:mb-20 items-end">
          <div className="lg:col-span-7 space-y-5">
            <span className="eyebrow">CURATED ADVENTURES</span>
            <span className="editorial-rule" />
            <h2 className="display-heading text-4xl md:text-5xl lg:text-6xl">
              Curated Experiences<br />&amp; Local Traditions
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pb-3">
            <p className="text-sm md:text-base text-luxury-400 leading-relaxed font-sans font-light">
              At BAIA, we believe true luxury lies in deep connection. Let our expert local guides orchestrate unforgettable days customized to your desired flow—from riding world-class swells to floating through silent lagoons.
            </p>
          </div>
        </div>

        {/* Experience Cards Grid — center card drops for editorial asymmetry */}
        <div id="activities-grid" className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {activities.map((act, index) => (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={`hover-lift bg-luxury-950 border border-luxury-800 group overflow-hidden flex flex-col justify-between hover:border-gold-500/50 rounded-sm ${
                index === 1 ? "md:mt-16" : ""
              }`}
            >
              <div>
                <div className="aspect-[16/10] overflow-hidden bg-luxury-900 relative">
                  <img
                    src={act.imageUrl}
                    alt={act.title}
                    className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
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

        {/* Glass concierge callout with lifted CTA */}
        <motion.div
          id="custom-concierge-callout"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel mt-20 md:mt-24 p-8 lg:p-14 flex flex-col md:flex-row justify-between items-center gap-8 rounded-sm relative"
        >
          <div className="text-left space-y-3 max-w-xl">
            <span className="eyebrow">PRIVATE CONCIERGE</span>
            <h3 className="text-2xl md:text-3xl font-serif text-luxury-100 uppercase tracking-wider font-light">
              Dreaming of a bespoke itinerary?
            </h3>
            <p className="text-xs md:text-sm text-luxury-300 leading-relaxed font-sans font-light">
              From island sunset proposals on private sandbars to deep-sea fishing charters and bespoke health detox programs, our specialist concierge team is here to tailor-make every moment of your stay.
            </p>
          </div>
          <button
            onClick={onBookClick}
            className="hover-lift w-full md:w-auto bg-gold-500 hover:bg-gold-400 text-white px-8 py-4 text-[11px] tracking-widest font-sans font-bold uppercase flex items-center justify-center space-x-2 cursor-pointer rounded-sm"
          >
            <span>Consult our Concierge</span>
            <Sparkles size={12} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
