import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, MapPin, Maximize2 } from "lucide-react";
import { useSite, GalleryItem } from "../context/SiteContext";

export default function IslandPerspectives() {
  const { galleryItems } = useSite();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (activeId === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveId(null);
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Prevent background scrolling when lightbox is open
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [activeId, galleryItems]);

  const activeIndex = galleryItems.findIndex((item) => item.id === activeId);
  const activeItem = activeId !== null ? galleryItems[activeIndex] : null;

  const handleNext = () => {
    if (activeId === null || galleryItems.length === 0) return;
    const nextIndex = (activeIndex + 1) % galleryItems.length;
    setActiveId(galleryItems[nextIndex].id);
  };

  const handlePrev = () => {
    if (activeId === null || galleryItems.length === 0) return;
    const prevIndex = (activeIndex - 1 + galleryItems.length) % galleryItems.length;
    setActiveId(galleryItems[prevIndex].id);
  };

  return (
    <section id="gallery" className="py-32 bg-luxury-950 border-t border-luxury-900 text-left relative overflow-hidden">
      {/* Section wash + ghost numeral */}
      <div className="wash-ocean absolute inset-0 pointer-events-none opacity-70" />
      <span aria-hidden className="ghost-numeral left-4 top-6 md:left-10 md:top-10">04</span>

      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gold-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-luxury-800/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 z-10">
        {/* Split header — title left, intro right & dropped */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 mb-16 md:mb-20 items-end">
          <div className="lg:col-span-7 space-y-5">
            <span className="eyebrow">VISUAL JOURNAL</span>
            <span className="editorial-rule" />
            <h2 className="display-heading text-4xl md:text-5xl lg:text-6xl">
              Island<br />Perspectives
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pb-3">
            <p className="text-sm md:text-base text-luxury-400 font-sans font-light leading-relaxed">
              A curated visual story of Palawan&apos;s natural wonders and our oceanfront sanctuaries, captured by local navigators and beloved guests. Click on any frame to step inside.
            </p>
          </div>
        </div>


        {/* Cinematic Bento Grid — asymmetric heights + staggered reveal + Ken Burns drift */}
        <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 auto-rows-[110px] sm:auto-rows-[140px] md:auto-rows-[160px] lg:auto-rows-[180px] gap-3 md:gap-4 lg:gap-5">
          {galleryItems.map((item, idx) => {
            // Bento pattern — rotates through 6 distinct tile footprints for
            // rhythm across all breakpoints. Mobile stays two-up but preserves
            // tall/wide accents so the grid never feels like a static list.
            const patterns = [
              // [colSpanBase, colSpanMd, colSpanLg, rowSpanBase, rowSpanMd, rowSpanLg]
              { cls: "col-span-2 md:col-span-4 lg:col-span-7 row-span-3 md:row-span-3 lg:row-span-3" },
              { cls: "col-span-2 md:col-span-2 lg:col-span-5 row-span-2 md:row-span-3 lg:row-span-3" },
              { cls: "col-span-1 md:col-span-2 lg:col-span-4 row-span-2 md:row-span-2 lg:row-span-2" },
              { cls: "col-span-1 md:col-span-2 lg:col-span-4 row-span-2 md:row-span-2 lg:row-span-2" },
              { cls: "col-span-2 md:col-span-2 lg:col-span-4 row-span-2 md:row-span-3 lg:row-span-3" },
              { cls: "col-span-2 md:col-span-4 lg:col-span-8 row-span-3 md:row-span-2 lg:row-span-2" },
            ];
            const pattern = patterns[idx % patterns.length];
            const kb = ["ken-burns-a", "ken-burns-b", "ken-burns-c"][idx % 3];
            return (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, delay: (idx % 6) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4 }}
                onClick={() => setActiveId(item.id)}
                aria-label={`Open ${item.title}`}
                className={`${pattern.cls} group relative cursor-pointer overflow-hidden rounded-sm border border-luxury-900 bg-luxury-900 shadow-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500`}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={item.src}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className={`w-full h-full object-cover ${kb} transition-transform duration-[1200ms] ease-out group-hover:scale-[1.18]`}
                  />
                </div>

                {/* Base cinematic vignette — always visible for legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-luxury-950/85 via-luxury-950/20 to-transparent pointer-events-none" />
                {/* Strong reveal on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-luxury-950 via-luxury-950/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {/* Location pill */}
                <div className="absolute top-3 left-3 md:top-4 md:left-4 bg-luxury-950/80 backdrop-blur-sm border border-luxury-800/50 px-2 py-0.5 rounded-full flex items-center space-x-1.5 text-[9px] tracking-widest text-gold-300 uppercase font-sans font-semibold">
                  <MapPin size={9} />
                  <span className="truncate max-w-[120px]">{item.location.split(",")[0]}</span>
                </div>

                {/* Expand icon */}
                <div className="absolute top-3 right-3 md:top-4 md:right-4 bg-luxury-950/80 backdrop-blur-sm border border-luxury-800/50 p-1.5 rounded-full text-gold-300 opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
                  <Maximize2 size={12} />
                </div>

                {/* Title block — visible baseline, expands on hover */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 z-10">
                  <span className="text-[9px] tracking-[0.25em] text-gold-300 font-sans uppercase font-bold block mb-1 opacity-90">
                    {item.category}
                  </span>
                  <h3 className="text-sm md:text-base lg:text-lg font-serif text-luxury-100 uppercase tracking-wide leading-tight line-clamp-2">
                    {item.title}
                  </h3>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Scroll affordance */}
        <div className="mt-10 flex items-center justify-center gap-3 text-[10px] tracking-[0.3em] text-luxury-500 font-sans uppercase">
          <span className="h-px w-8 bg-luxury-800" />
          <span>Tap any frame to enter</span>
          <span className="h-px w-8 bg-luxury-800" />
        </div>

      </div>

      {/* Cinematic Lightbox Modal */}
      <AnimatePresence>
        {activeId !== null && activeItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-luxury-950/98 backdrop-blur-md p-4 sm:p-8 md:p-12"
          >
            {/* Close zone (click backdrop) */}
            <div className="absolute inset-0 cursor-zoom-out" onClick={() => setActiveId(null)} />

            {/* Main Lightbox Frame */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="relative max-w-5xl w-full bg-luxury-900/40 border border-luxury-800/40 shadow-2xl rounded-sm overflow-hidden z-10 flex flex-col md:grid md:grid-cols-12 max-h-[90vh]"
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveId(null)}
                className="absolute top-4 right-4 md:top-6 md:right-6 text-luxury-400 hover:text-gold-500 transition-colors p-2 bg-luxury-950/60 hover:bg-luxury-950/90 rounded-full z-30 cursor-pointer border border-luxury-800/30"
                aria-label="Close Lightbox"
              >
                <X size={18} />
              </button>

              {/* Left/Right controls (large screens overlays) */}
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-luxury-400 hover:text-gold-500 transition-colors p-2 bg-luxury-950/60 hover:bg-luxury-950/90 rounded-full z-30 cursor-pointer border border-luxury-800/30 hidden md:block"
                aria-label="Previous Image"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-luxury-400 hover:text-gold-500 transition-colors p-2 bg-luxury-950/60 hover:bg-luxury-950/90 rounded-full z-30 cursor-pointer border border-luxury-800/30 hidden md:block"
                aria-label="Next Image"
              >
                <ChevronRight size={20} />
              </button>

              {/* Image Grid Area */}
              <div className="md:col-span-8 flex items-center justify-center bg-luxury-950 relative h-[45vh] md:h-auto min-h-[300px] md:min-h-[500px]">
                <img
                  src={activeItem.src}
                  alt={activeItem.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[45vh] md:max-h-[80vh] object-contain select-none p-1 md:p-4"
                />
              </div>

              {/* Description Panel */}
              <div className="md:col-span-4 p-6 md:p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-luxury-800/50 bg-luxury-950/60 text-left select-none overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] tracking-[0.2em] text-gold-300 font-sans font-semibold uppercase block mb-2">
                      {activeItem.category} // MOMENT
                    </span>
                    <h3 className="text-xl md:text-2xl font-serif text-luxury-100 uppercase tracking-wide leading-tight">
                      {activeItem.title}
                    </h3>
                  </div>

                  <div className="flex items-start space-x-2 text-xs text-luxury-300 font-sans">
                    <MapPin size={14} className="text-gold-400 shrink-0 mt-0.5" />
                    <span className="font-medium">{activeItem.location}</span>
                  </div>

                  <p className="text-xs md:text-sm text-luxury-400 font-sans font-light leading-relaxed">
                    {activeItem.description}
                  </p>
                </div>

                {/* Mobile Navigation and counter */}
                <div className="pt-6 md:pt-0 mt-6 md:mt-0 flex items-center justify-between border-t border-luxury-800/30">
                  <span className="text-[10px] tracking-widest text-luxury-500 font-sans uppercase">
                    {activeIndex + 1} of {galleryItems.length}
                  </span>
                  
                  {/* Mobile nav buttons */}
                  <div className="flex space-x-2 md:hidden">
                    <button
                      onClick={handlePrev}
                      className="p-2 border border-luxury-800 hover:border-gold-300 rounded-full text-luxury-400 hover:text-gold-500 transition-all cursor-pointer"
                      aria-label="Previous"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={handleNext}
                      className="p-2 border border-luxury-800 hover:border-gold-300 rounded-full text-luxury-400 hover:text-gold-500 transition-all cursor-pointer"
                      aria-label="Next"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
