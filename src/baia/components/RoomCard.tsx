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
    </div>
  );
};

export default RoomCard;
