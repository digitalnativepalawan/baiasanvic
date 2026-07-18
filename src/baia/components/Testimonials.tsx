/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Quote, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSite } from "../context/SiteContext";

export default function Testimonials() {
  const { testimonials } = useSite();
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = testimonials.length ? activeIndex % testimonials.length : 0;

  const handleNext = () => {
    if (!testimonials.length) return;
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrev = () => {
    if (!testimonials.length) return;
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const current = testimonials[safeIndex];

  return (
    <section id="testimonials" className="py-28 md:py-36 bg-luxury-950 border-t border-b border-luxury-900/60 relative overflow-hidden">
      <div className="wash-moss absolute inset-0 pointer-events-none opacity-70" />
      <span aria-hidden className="ghost-numeral right-4 top-8 md:right-10 md:top-12">05</span>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center z-10">
        {/* Left rail: title + stacked controls */}
        <div className="lg:col-span-4 space-y-8">
          <div className="space-y-5">
            <span className="eyebrow">GUEST JOURNAL</span>
            <span className="editorial-rule" />
            <h2 className="display-heading text-3xl md:text-4xl lg:text-5xl">
              Postcards<br />from Paradise
            </h2>
            <p className="text-sm text-luxury-400 font-sans font-light leading-relaxed max-w-sm">
              Voices from travelers who traded the noise of the world for the sound of the sea.
            </p>
          </div>

          {testimonials.length > 1 && (
            <div className="flex flex-col space-y-5">
              <div className="flex space-x-3">
                <button
                  onClick={handlePrev}
                  className="hover-lift p-3 border border-luxury-800 hover:border-gold-300 rounded-full text-luxury-400 hover:text-gold-500 cursor-pointer bg-luxury-950/40"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNext}
                  className="hover-lift p-3 border border-luxury-800 hover:border-gold-300 rounded-full text-luxury-400 hover:text-gold-500 cursor-pointer bg-luxury-950/40"
                  aria-label="Next testimonial"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex space-x-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      safeIndex === i ? "bg-gold-400 w-8" : "bg-luxury-800 w-2 hover:bg-luxury-700"
                    }`}
                    aria-label={`Go to testimonial ${i + 1}`}
                  />
                ))}
              </div>
              <span className="text-[10px] tracking-[0.3em] text-luxury-500 font-sans uppercase">
                {String(safeIndex + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* Floating glass quote panel — pulled left into the rail on lg */}
        <div className="lg:col-span-8 relative lg:-ml-12">
          <div className="glass-panel rounded-sm p-8 md:p-14 lg:p-16 relative min-h-[320px] flex items-center">
            <Quote size={80} className="absolute -top-6 -left-4 md:-top-8 md:-left-6 text-gold-500/20" />
            {current ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-6 relative"
                >
                  <div className="flex space-x-1">
                    {[...Array(current.rating)].map((_, i) => (
                      <Star key={i} size={14} className="fill-gold-400 text-gold-400" />
                    ))}
                  </div>

                  <blockquote className="text-xl md:text-2xl lg:text-3xl font-serif text-luxury-100 italic leading-[1.4] font-light">
                    &ldquo;{current.text}&rdquo;
                  </blockquote>

                  <div className="pt-4 border-t border-luxury-800/60">
                    <cite className="not-italic text-sm font-serif font-bold text-gold-300 tracking-wider">
                      {current.guestName}
                    </cite>
                    <p className="text-[10px] tracking-[0.25em] text-luxury-400 font-sans uppercase mt-1">
                      {current.location} — Stayed {current.stayDate}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <p className="text-xs tracking-widest text-luxury-500 font-sans uppercase">No testimonials yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
