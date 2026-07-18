/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Quote, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSite } from "../context/SiteContext";
import { SectionStamp, TideDivider } from "./Editorial";

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
    <section
      id="testimonials"
      className="py-28 md:py-40 lg:py-48 bg-luxury-950 border-t border-b border-luxury-900/60 relative overflow-hidden"
    >
      {/* Deep oceanic band wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ocean-950/[0.06] via-ocean-900/[0.03] to-transparent" />
      <span aria-hidden className="ghost-numeral -top-10 left-4">
        05
      </span>
      <TideDivider className="absolute top-10 inset-x-0" />

      {/* Visual embellishment */}
      <div className="absolute bottom-8 right-8 text-luxury-900/10 pointer-events-none select-none">
        <Quote size={300} />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0 items-center">
          {/* Left rail — header and navigation, anchored off-center */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 text-left space-y-6"
          >
            <span className="eyebrow text-gold-300 block">GUEST JOURNAL</span>
            <SectionStamp label="Guest logbook" />
            <h2 className="display-heading text-4xl md:text-5xl lg:text-6xl text-luxury-100">
              Postcards from Paradise
            </h2>

            {testimonials.length > 1 && (
              <div id="testimonial-controls" className="flex items-center space-x-6 pt-4">
                <button
                  onClick={handlePrev}
                  className="p-2 border border-luxury-800 hover:border-gold-300 rounded-full text-luxury-400 hover:text-gold-500 transition-all duration-500 ease-(--ease-lift) hover:-translate-y-0.5 cursor-pointer"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Dots Indicator */}
                <div className="flex space-x-2">
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        safeIndex === i ? "bg-gold-400 w-3" : "bg-luxury-800"
                      }`}
                      aria-label={`Go to testimonial ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  className="p-2 border border-luxury-800 hover:border-gold-300 rounded-full text-luxury-400 hover:text-gold-500 transition-all duration-500 ease-(--ease-lift) hover:-translate-y-0.5 cursor-pointer"
                  aria-label="Next testimonial"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </motion.div>

          {/* Quote panel — floating glass block layered over the left rail's edge */}
          <div
            id="testimonial-carousel"
            className="lg:col-span-8 lg:col-start-5 lg:-ml-12 relative min-h-[280px] flex items-center"
          >
            {current ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-panel w-full p-8 md:p-12 lg:p-16 text-left space-y-6"
                >
                  {/* Star Rating */}
                  <div className="flex space-x-1">
                    {[...Array(current.rating)].map((_, i) => (
                      <Star key={i} size={14} className="fill-gold-400 text-gold-400" />
                    ))}
                  </div>

                  {/* Review Text */}
                  <blockquote className="text-xl md:text-2xl lg:text-3xl font-serif text-luxury-100 italic leading-relaxed">
                    "{current.text}"
                  </blockquote>

                  {/* Guest Details */}
                  <div className="pt-2 border-t border-luxury-800/40">
                    <cite className="not-italic text-sm font-serif font-bold text-gold-300 tracking-wider block pt-4">
                      {current.guestName}
                    </cite>
                    <p className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase mt-1">
                      {current.location} — Stayed {current.stayDate}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <p className="text-xs tracking-widest text-luxury-500 font-sans uppercase">
                No testimonials yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
