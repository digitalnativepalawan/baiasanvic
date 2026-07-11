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
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gold-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-luxury-800/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-2xl mb-20">
          <span className="text-[10px] tracking-[0.3em] font-sans text-gold-300 font-semibold uppercase block mb-3">
            VISUAL JOURNAL
          </span>
          <h2 className="text-4xl md:text-5xl font-serif text-luxury-100 tracking-wide uppercase leading-tight mb-6">
            Island Perspectives
          </h2>
          <p className="text-sm text-luxury-400 font-sans font-light leading-relaxed max-w-lg">
            A curated visual story of Palawan's natural wonders and our oceanfront sanctuaries, captured by local navigators and beloved guests. Click on any frame to step inside.
          </p>
        </div>

        {/* Masonry Grid */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 [column-fill:_balance] box-border w-full">
          {galleryItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: idx * 0.1, ease: "easeOut" }}
              className="break-inside-avoid mb-6 group relative cursor-pointer overflow-hidden rounded-sm border border-luxury-900 bg-luxury-900 shadow-lg"
              onClick={() => setActiveId(item.id)}
            >
              <div className="relative overflow-hidden aspect-auto">
                <img
                  src={item.src}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                
                {/* Visual Cover Layer on Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-luxury-950 via-luxury-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out flex flex-col justify-end p-6" />

                {/* Always visible minimal pill overlay */}
                <div className="absolute top-4 left-4 bg-luxury-950/80 backdrop-blur-sm border border-luxury-800/50 px-2.5 py-1 rounded-full flex items-center space-x-1.5 text-[9px] tracking-widest text-gold-300 uppercase font-sans font-semibold">
                  <MapPin size={9} />
                  <span>{item.location.split(",")[0]}</span>
                </div>

                <div className="absolute top-4 right-4 bg-luxury-950/80 backdrop-blur-sm border border-luxury-800/50 p-1.5 rounded-full text-gold-300 opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
                  <Maximize2 size={12} />
                </div>

                {/* Overlay details that appear on hover */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-10 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out">
                  <span className="text-[9px] tracking-[0.25em] text-gold-300 font-sans uppercase font-bold block mb-1">
                    {item.category} // {item.location}
                  </span>
                  <h3 className="text-lg font-serif text-luxury-100 uppercase tracking-wide">
                    {item.title}
                  </h3>
                </div>
              </div>
            </motion.div>
          ))}
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
