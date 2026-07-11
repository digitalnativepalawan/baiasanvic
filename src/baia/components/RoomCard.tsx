import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play, X, Maximize2 } from "lucide-react";
import { createPortal } from "react-dom";
import { RoomTier } from "../types";

export interface RoomCardProps {
  room: RoomTier;
  onBook: (room: RoomTier) => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onBook }) => {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Fallback to array if images field is missing or empty
  const mediaList = room.images && room.images.length > 0 
    ? room.images 
    : [room.imageUrl];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMediaIndex((prev) => (prev + 1) % mediaList.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMediaIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
  };

  const isVideo = (url: string) => {
    if (!url) return false;
    return url.startsWith("data:video/") || 
           url.endsWith(".mp4") || 
           url.endsWith(".webm") || 
           url.endsWith(".mov") || 
           url.endsWith(".ogg") ||
           url.includes("video");
  };

  const currentMediaUrl = mediaList[activeMediaIndex] || room.imageUrl;

  const stepNext = () => setActiveMediaIndex((p) => (p + 1) % mediaList.length);
  const stepPrev = () => setActiveMediaIndex((p) => (p - 1 + mediaList.length) % mediaList.length);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowRight") stepNext();
      else if (e.key === "ArrowLeft") stepPrev();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen, mediaList.length]);


  return (
    <div 
      id={`room-card-${room.id}`}
      className="group flex flex-col bg-luxury-950/40 border border-luxury-800/40 overflow-hidden hover:border-gold-500/30 transition-colors duration-500 rounded-sm"
    >
      {/* Media Carousel Container */}
      <div className="aspect-[16/10] overflow-hidden relative bg-luxury-950 group/carousel">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 w-full h-full cursor-zoom-in z-0"
          aria-label={`View larger images of ${room.name}`}
        >
          {isVideo(currentMediaUrl) ? (
            <video
              src={currentMediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentMediaUrl}
              alt={`${room.name} - slide ${activeMediaIndex + 1}`}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
          )}
        </button>
        <div className="absolute inset-0 bg-gradient-to-t from-luxury-950/80 via-transparent to-transparent pointer-events-none" />

        {/* Zoom hint */}
        <div className="absolute top-4 left-4 flex items-center space-x-1.5 text-[9px] tracking-widest text-gold-300 uppercase font-sans font-semibold bg-luxury-950/80 backdrop-blur-sm border border-luxury-800/50 px-2.5 py-1 rounded-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 pointer-events-none">
          <Maximize2 size={10} />
          <span>View</span>
        </div>


        {/* Carousel Controls (if more than 1 image/video exists) */}
        {mediaList.length > 1 && (
          <>
            {/* Left Arrow */}
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-luxury-950/70 border border-luxury-800 text-luxury-200 hover:text-gold-300 hover:bg-luxury-900 transition-all opacity-0 group-hover/carousel:opacity-100 z-10"
              aria-label="Previous slide"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Right Arrow */}
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-luxury-950/70 border border-luxury-800 text-luxury-200 hover:text-gold-300 hover:bg-luxury-900 transition-all opacity-0 group-hover/carousel:opacity-100 z-10"
              aria-label="Next slide"
            >
              <ChevronRight size={16} />
            </button>

            {/* Slides Count Badge */}
            <div className="absolute top-4 right-4 text-[9px] font-mono tracking-widest text-luxury-300 uppercase bg-luxury-950/80 backdrop-blur-sm px-2 py-0.5 rounded-sm border border-luxury-800/50 z-10">
              {activeMediaIndex + 1} / {mediaList.length}
            </div>

            {/* Elegant Dots indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
              {mediaList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMediaIndex(idx);
                  }}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    idx === activeMediaIndex 
                      ? "w-4 bg-gold-300" 
                      : "w-1 bg-luxury-400/50 hover:bg-luxury-300"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Info Overlays */}
        <div className="absolute bottom-4 left-6 right-6 flex justify-between items-end pointer-events-none z-10">
          <span className="text-[10px] text-luxury-300 tracking-widest font-sans uppercase bg-luxury-950/80 backdrop-blur-sm px-3 py-1 rounded-sm border border-luxury-800/50">
            {room.size}
          </span>
          <span className="text-[10px] text-gold-300 font-semibold tracking-widest font-sans uppercase bg-luxury-950/80 backdrop-blur-sm px-3 py-1 rounded-sm border border-luxury-800/50">
            {room.capacity}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-start gap-4">
            <h4 className="text-xl md:text-2xl font-serif text-luxury-100 uppercase tracking-wide">
              {room.name}
            </h4>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-luxury-400 font-sans block uppercase tracking-wider">Rates</span>
              <span className="text-base md:text-lg font-serif text-gold-300 font-bold">On request</span>
            </div>
          </div>
          <p className="text-xs md:text-sm text-luxury-300 leading-relaxed font-sans font-light">
            {room.description}
          </p>
        </div>

        {/* Amenities List */}
        <div className="border-t border-luxury-900/60 pt-6">
          <p className="text-[9px] tracking-widest text-gold-300 font-semibold uppercase mb-3">VILLA AMENITIES</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {room.amenities.slice(0, 8).map((amenity, i) => (
              <div key={i} className="flex items-center space-x-2 text-xs text-luxury-400">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500/60 shrink-0" />
                <span className="truncate text-luxury-300 font-light">{amenity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Book Button */}
        <div className="pt-4">
          <button
            onClick={() => onBook(room)}
            className="w-full text-center py-3 border border-luxury-700 hover:border-gold-300 hover:bg-gold-500/[0.02] text-gold-300 text-[10px] tracking-widest font-sans uppercase font-medium transition-all cursor-pointer"
          >
            Book This Villa
          </button>
        </div>
      </div>

      {lightboxOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-luxury-950/95 backdrop-blur-md p-4 sm:p-8 animate-fade-in">
          <div className="absolute inset-0 cursor-zoom-out" onClick={() => setLightboxOpen(false)} />

          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-luxury-300 hover:text-gold-300 transition-colors p-2 bg-luxury-950/70 hover:bg-luxury-900 rounded-full z-30 border border-luxury-800/50 cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
            <div className="relative w-full flex items-center justify-center">
              {mediaList.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); stepPrev(); }}
                  className="absolute left-2 md:-left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-luxury-950/70 hover:bg-luxury-900 border border-luxury-800/50 text-luxury-200 hover:text-gold-300 transition-all z-20 cursor-pointer"
                  aria-label="Previous"
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              {isVideo(currentMediaUrl) ? (
                <video src={currentMediaUrl} autoPlay muted loop playsInline className="max-h-[80vh] max-w-full object-contain" />
              ) : (
                <img
                  src={currentMediaUrl}
                  alt={`${room.name} - image ${activeMediaIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[80vh] max-w-full object-contain select-none"
                />
              )}

              {mediaList.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); stepNext(); }}
                  className="absolute right-2 md:-right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-luxury-950/70 hover:bg-luxury-900 border border-luxury-800/50 text-luxury-200 hover:text-gold-300 transition-all z-20 cursor-pointer"
                  aria-label="Next"
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            <div className="mt-6 flex flex-col items-center space-y-4">
              <div className="text-center">
                <span className="text-[10px] tracking-[0.3em] text-gold-300 uppercase font-sans font-semibold block mb-2">
                  {room.size} · {room.capacity}
                </span>
                <h3 className="text-lg md:text-2xl font-serif text-luxury-100 uppercase tracking-wide">
                  {room.name}
                </h3>
              </div>

              {mediaList.length > 1 && (
                <div className="flex items-center space-x-2">
                  {mediaList.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setActiveMediaIndex(idx); }}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === activeMediaIndex ? "w-6 bg-gold-300" : "w-1.5 bg-luxury-500/50 hover:bg-luxury-300"
                      }`}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              <span className="text-[10px] tracking-widest text-luxury-500 font-sans uppercase">
                {activeMediaIndex + 1} of {mediaList.length}
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );

};

export default RoomCard;
