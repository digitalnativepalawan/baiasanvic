/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, Calendar, Award, Compass, Timer } from "lucide-react";
import { motion } from "motion/react";
import { useSite } from "../context/SiteContext";

interface ActivitiesProps {
  onBookClick: () => void;
}

export default function Activities({ onBookClick }: ActivitiesProps) {
  const { activities } = useSite();
  return (
    <section id="experiences" className="py-24 bg-luxury-900 border-t border-b border-luxury-800/60 text-left relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section Title */}
        <div id="activities-title" className="max-w-2xl mb-16">
          <span className="text-[10px] tracking-[0.3em] font-sans text-gold-300 font-semibold uppercase block mb-3">
            CURATED ADVENTURES
          </span>
          <h2 className="text-4xl md:text-5xl font-serif text-luxury-100 tracking-wide uppercase leading-tight">
            Curated Experiences &<br />Local Traditions
          </h2>
          <p className="text-sm text-luxury-400 mt-4 leading-relaxed font-sans font-light">
            At BAIA, we believe true luxury lies in deep connection. Let our expert local guides orchestrate unforgettable days customized to your desired flow—from riding world-class swells to floating through silent lagoons.
          </p>
        </div>

        {/* Experience Cards Grid */}
        <div id="activities-grid" className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {activities.map((act, index) => (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="bg-luxury-950 border border-luxury-800 group overflow-hidden flex flex-col justify-between hover:border-gold-500/40 transition-all duration-300 rounded-sm"
            >
              <div>
                {/* Image Showcase */}
                <div className="aspect-[16/10] overflow-hidden bg-luxury-900 relative">
                  <img
                    src={act.imageUrl}
                    alt={act.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-luxury-950/80 backdrop-blur-sm px-2.5 py-1 text-[9px] tracking-widest text-gold-300 uppercase rounded-sm border border-gold-500/20 font-bold">
                    {act.category}
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-6 md:p-8">
                  <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-3 group-hover:text-gold-300 transition-colors">
                    {act.title}
                  </h3>
                  <p className="text-xs text-luxury-300 leading-relaxed font-sans font-light">
                    {act.description}
                  </p>
                </div>
              </div>

              {/* Card Footer Metadata */}
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

                {/* CTA Action */}
                <button
                  onClick={onBookClick}
                  className="w-full text-center border border-luxury-700 hover:border-gold-300 hover:bg-gold-500/5 py-3 text-[10px] tracking-[0.2em] font-sans text-luxury-200 hover:text-gold-300 uppercase font-semibold transition-all cursor-pointer"
                >
                  ARRANGE EXPERIENCE
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Custom concierge callout card below */}
        <div id="custom-concierge-callout" className="mt-16 bg-luxury-950 border border-luxury-800 p-8 lg:p-12 flex flex-col md:flex-row justify-between items-center gap-8 rounded-sm">
          <div className="text-left space-y-2 max-w-xl">
            <h3 className="text-2xl font-serif text-luxury-100 uppercase tracking-wider">
              Dreaming of a bespoke itinerary?
            </h3>
            <p className="text-xs text-luxury-300 leading-relaxed font-sans font-light">
              From island sunset proposals on private sandbars to deep-sea fishing charters and bespoke health detox programs, our specialist concierge team is here to tailor-make every moment of your stay.
            </p>
          </div>
          <button
            onClick={onBookClick}
            className="w-full md:w-auto bg-gold-500 hover:bg-gold-600 text-white px-8 py-4 text-[11px] tracking-widest font-sans font-bold uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Consult our Concierge</span>
            <Sparkles size={12} />
          </button>
        </div>
      </div>
    </section>
  );
}
