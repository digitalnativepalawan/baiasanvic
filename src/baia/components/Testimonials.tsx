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
    <section id="testimonials" className="py-24 bg-luxury-950 border-t border-b border-luxury-900/60 relative overflow-hidden">
      {/* Visual embellishment */}
      <div className="absolute top-1/2 left-10 -translate-y-1/2 text-luxury-900/10 pointer-events-none select-none">
        <Quote size={300} />
      </div>

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <span className="text-[10px] tracking-[0.3em] font-sans text-gold-300 font-semibold uppercase block mb-3">
          GUEST JOURNAL
        </span>
        <h2 className="text-3xl md:text-4xl font-serif text-luxury-100 tracking-wide uppercase mb-12">
          Postcards from Paradise
        </h2>

        {/* Carousel Container */}
        <div id="testimonial-carousel" className="relative min-h-[250px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Star Rating */}
              <div className="flex justify-center space-x-1">
                {[...Array(current.rating)].map((_, i) => (
                  <Star key={i} size={14} className="fill-gold-400 text-gold-400" />
                ))}
              </div>

              {/* Review Text */}
              <blockquote className="text-lg md:text-xl font-serif text-luxury-100 italic leading-relaxed max-w-2xl mx-auto">
                "{current.text}"
              </blockquote>

              {/* Guest Details */}
              <div className="pt-2">
                <cite className="not-italic text-sm font-serif font-bold text-gold-300 tracking-wider">
                  {current.guestName}
                </cite>
                <p className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase mt-1">
                  {current.location} — Stayed {current.stayDate}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div id="testimonial-controls" className="flex justify-center items-center space-x-6 mt-10">
          <button
            onClick={handlePrev}
            className="p-2 border border-luxury-800 hover:border-gold-300 rounded-full text-luxury-400 hover:text-gold-500 transition-all cursor-pointer"
            aria-label="Previous testimonial"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Dots Indicator */}
          <div className="flex space-x-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  activeIndex === i ? "bg-gold-400 w-3" : "bg-luxury-800"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="p-2 border border-luxury-800 hover:border-gold-300 rounded-full text-luxury-400 hover:text-gold-500 transition-all cursor-pointer"
            aria-label="Next testimonial"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
