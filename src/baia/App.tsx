/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Compass, ShieldCheck, Heart, ArrowRight, Plane, HelpCircle, Landmark, Star, ExternalLink, RefreshCw, Trash2, Calendar, ArrowUp, Instagram, Facebook } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Navbar from "./components/Navbar";
import BookingBar from "./components/BookingBar";
import BookingModal from "./components/BookingModal";
import Activities from "./components/Activities";
import IslandPerspectives from "./components/IslandPerspectives";
import Testimonials from "./components/Testimonials";
import AdminGate from "./components/AdminGate";
import ConciergeWidget from "./components/ConciergeWidget";
import RoomCard from "./components/RoomCard";
import Newsletter from "./components/Newsletter";
import { useSite, MediaPlayback, DEFAULT_HERO_PLAYBACK, DEFAULT_SECTION_PLAYBACK } from "./context/SiteContext";
import { Reservation, RoomTier } from "./types";

// Build a YouTube embed URL honoring admin playback flags.
function youtubeEmbedSrc(url: string | undefined, pb: MediaPlayback): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (!m) return null;
  const id = m[1];
  const p = new URLSearchParams();
  p.set("autoplay", pb.autoplay ? "1" : "0");
  // Browsers only allow autoplay when muted. Force mute when autoplaying.
  p.set("mute", pb.muted || pb.autoplay ? "1" : "0");
  p.set("controls", pb.controls ? "1" : "0");
  if (pb.loop) { p.set("loop", "1"); p.set("playlist", id); }
  p.set("modestbranding", "1");
  p.set("rel", "0");
  p.set("playsinline", "1");
  return `https://www.youtube.com/embed/${id}?${p.toString()}`;
}

// Renders a media slot with priority: youtube > video > image.
// - playback: admin-controlled sound/loop/autoplay/controls/poster.
// - lazy: only mount the heavy media (video/iframe) when scrolled into view.
function MediaFrame({
  image, videoUrl, youtubeUrl, alt, className,
  playback, lazy = false,
}: {
  image: string;
  videoUrl?: string;
  youtubeUrl?: string;
  alt: string;
  className?: string;
  playback?: MediaPlayback;
  lazy?: boolean;
}) {
  const pb: MediaPlayback = playback ?? DEFAULT_SECTION_PLAYBACK;
  const poster = pb.posterUrl || image;

  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!lazy);
  useEffect(() => {
    if (!lazy || inView) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); obs.disconnect(); }
    }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy, inView]);

  // No video source — just an image.
  if (!youtubeUrl && !videoUrl) {
    return <img src={image} alt={alt} className={className} referrerPolicy="no-referrer" loading="lazy" />;
  }

  const yt = youtubeUrl ? youtubeEmbedSrc(youtubeUrl, pb) : null;

  return (
    <div ref={rootRef} className={className} style={{ position: "relative", background: "#000", overflow: "hidden" }}>
      {(!inView || (!yt && !videoUrl)) && poster && (
        <img
          src={poster}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      )}
      {inView && yt && (
        <iframe
          src={yt}
          title={alt}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          frameBorder={0}
        />
      )}
      {inView && !yt && videoUrl && (
        <video
          key={`${videoUrl}|${pb.autoplay}|${pb.muted}|${pb.loop}|${pb.controls}`}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay={pb.autoplay && pb.muted}
          muted={pb.muted}
          loop={pb.loop}
          controls={pb.controls}
          playsInline
          poster={poster || undefined}
          preload={pb.autoplay ? "auto" : "metadata"}
        />
      )}
    </div>
  );
}


export default function App() {
  const { hero, philosophy, islandIntro, footer, logo, rooms } = useSite();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [activeReservationData, setActiveReservationData] = useState<{
    checkIn: string;
    checkOut: string;
    guests: number;
  } | undefined>(undefined);

  // local storage reservations state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Listen to scroll position to toggle Back to Top button visibility past the hero section
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > window.innerHeight - 120) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Reservations are session-only: we display any inquiry submitted this session
  // (they are also persisted server-side in Supabase as booking inquiries).
  const handleBookingClose = () => {
    setIsBookingOpen(false);
  };

  const handleInquirySubmitted = (r: Reservation) => {
    setReservations((prev) => [...prev, r]);
  };

  const handleDeleteReservation = (id: string) => {
    if (window.confirm("Remove this inquiry from this view? (It stays on file with the resort.)")) {
      setReservations((prev) => prev.filter((r) => r.id !== id));
    }
  };


  // Format date helper
  const formatHumanDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Scroll to section helper
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCheckAvailability = (data: {
    checkIn: string;
    checkOut: string;
    guests: number;
  }) => {
    setActiveReservationData(data);
    setIsBookingOpen(true);
  };

  const handleOpenStandardBooking = () => {
    setActiveReservationData(undefined);
    setIsBookingOpen(true);
  };

  return (
    <div id="baia-app-root" className="bg-luxury-950 text-luxury-100 min-h-screen relative overflow-x-hidden select-text">
      {/* Navbar header */}
      <Navbar onBookClick={handleOpenStandardBooking} onSectionClick={scrollToSection} />

      {/* 1. HERO SECTION */}
      <header
        id="hero"
        className="relative h-screen flex flex-col justify-between items-stretch text-left select-none overflow-hidden"
      >
        {/* Immersive background sunset palm photograph with dark overlay matching the image */}
        <div className="absolute inset-0 bg-luxury-950/40 z-0">
          <MediaFrame
            image={hero.backgroundImage}
            videoUrl={hero.videoUrl}
            youtubeUrl={hero.youtubeUrl}
            playback={hero.playback}
            alt="Baia Resort hero"
            className="w-full h-full object-cover object-center animate-fade-in"
          />
          {/* Custom cinematic dark overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-luxury-950 via-transparent to-black/50 pointer-events-none" />
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none" />
        </div>


        {/* Content Centering Area */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex-1 flex flex-col justify-center relative z-10 w-full pt-16">
          <div className="max-w-3xl space-y-6 mt-12">
            {/* Title */}
            <motion.h1
              id="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif text-white uppercase tracking-[0.06em] leading-[1.05] drop-shadow-sm font-light whitespace-pre-line"
            >
              {hero.title}
            </motion.h1>

            {/* Subtext Paragraph */}
            <motion.p
              id="hero-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
              className="text-sm md:text-base text-luxury-100 max-w-md leading-relaxed font-sans font-light tracking-wide pt-2 whitespace-pre-line"
            >
              {hero.subtitle}
            </motion.p>
          </div>
        </div>

        {/* Bottom decorative coordinates */}
        <div className="hidden lg:flex max-w-7xl mx-auto px-12 w-full pb-10 justify-between items-center text-[10px] tracking-widest text-white/60 font-sans z-10 relative">
          <span>LAT: 10.55° N // LNG: 119.28° E</span>
          <span className="animate-bounce">↓ SCROLL TO EXPLORE</span>
          <span>PALAWAN, PHILIPPINES</span>
        </div>
      </header>

      {/* 2. PHILOSOPHY SECTION — full-bleed cinematic quote */}
      <section
        id="philosophy"
        className="relative min-h-screen w-full flex items-center justify-center text-center overflow-hidden"
      >
        {/* Full-bleed media background */}
        <div className="absolute inset-0 bg-luxury-950">
          <MediaFrame
            image={philosophy.image}
            videoUrl={philosophy.videoUrl}
            youtubeUrl={philosophy.youtubeUrl}
            playback={philosophy.playback}
            lazy
            alt={philosophy.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Cinematic overlays for legibility */}
          <div className="absolute inset-0 bg-luxury-950/40 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-luxury-950 via-luxury-950/20 to-luxury-950/60 pointer-events-none" />
        </div>

        {/* Centered quote text */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-10 max-w-4xl px-6 lg:px-12 space-y-6"
        >
          <span className="text-[10px] tracking-[0.3em] font-sans text-gold-300 font-semibold uppercase block">
            {philosophy.eyebrow}
          </span>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif text-luxury-100 tracking-wide uppercase leading-tight font-light">
            {philosophy.title}
          </h2>
          <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-relaxed max-w-2xl mx-auto pt-2">
            {philosophy.subtitle}
          </p>
        </motion.div>
      </section>

      {/* 3. THE STAY SECTION */}
      <section
        id="stay"
        className="py-32 bg-luxury-900 border-t border-b border-luxury-800/40 text-left relative overflow-hidden"
      >
        {/* The Stay Showcase */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-3xl mb-16 space-y-4">
            <span className="text-[10px] tracking-[0.3em] font-sans text-gold-300 font-semibold uppercase block">
              ACCOMMODATIONS
            </span>
            <h3 className="text-3xl md:text-5xl font-serif text-white uppercase tracking-wider font-light">
              The Stay
            </h3>
            <p className="text-sm md:text-base text-luxury-300 font-sans font-light leading-relaxed max-w-2xl">
              Four private, single-level villas built in a tropical-minimalist style — calm, timber, and open to the breeze.
            </p>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {rooms.map((room: RoomTier) => (
              <RoomCard
                key={room.id}
                room={room}
                onBook={(r) => handleCheckAvailability({
                  checkIn: "",
                  checkOut: "",
                  guests: r.capacity.includes("3") ? 3 : r.capacity.includes("4") ? 4 : 2
                })}
              />
            ))}
          </div>

          {/* Complimentary amenities statement */}
          <div className="mt-12 p-6 bg-luxury-950/20 border border-luxury-900 rounded-sm text-center">
            <p className="text-xs text-luxury-400 font-sans font-light leading-relaxed">
              Every room at BAIA Resort includes <span className="text-gold-300 font-medium">air conditioning</span>, a <span className="text-gold-300 font-medium">flat-screen TV</span>, a <span className="text-gold-300 font-medium">private bathroom</span>, and <span className="text-gold-300 font-medium">hot water</span> for your complete convenience and absolute barefoot comfort.
            </p>
          </div>
        </div>
      </section>

      {/* 4. BOOKING AVAILABILITY BAR (EMBEDDED) */}
      <section id="booking-bar-anchor" className="relative -mt-16 z-20 px-6">
        <BookingBar onCheckAvailability={handleCheckAvailability} />
      </section>

      {/* 5. EXPERIENCES SECTION */}
      <Activities onBookClick={() => setIsConciergeOpen(true)} />

      {/* 5.5. GALLERY SECTION */}
      <IslandPerspectives />

      {/* 6. GUEST TESTIMONIALS SECTION */}
      <Testimonials />

      {/* Active Guest Reservation Lookup Board / Dashboard */}
      {reservations.length > 0 && (
        <section id="my-reservations-dashboard" className="py-20 bg-luxury-900 text-left border-t border-luxury-800">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
              <div>
                <span className="text-[10px] tracking-[0.3em] font-sans text-gold-300 font-semibold uppercase block mb-1">
                  SECURE RESORT PORTAL
                </span>
                <h2 className="text-3xl font-serif text-luxury-100 uppercase tracking-wider">
                  Your Confirmed Journeys
                </h2>
              </div>
              <button
                onClick={() => setShowMyBookings(!showMyBookings)}
                className="border border-luxury-700 hover:border-gold-300 text-gold-300 px-5 py-2 text-[10px] tracking-widest font-sans uppercase bg-transparent transition-all cursor-pointer flex items-center gap-2"
              >
                <Calendar size={12} />
                <span>{showMyBookings ? "HIDE RESERVATIONS" : `VIEW RESERVATIONS (${reservations.length})`}</span>
              </button>
            </div>

            {/* Bookings Drawer/Accordion section */}
            <AnimatePresence>
              {showMyBookings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
                    {reservations.map((res) => (
                      <motion.div
                        key={res.id}
                        whileHover={{ y: -6, scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="bg-luxury-950 border border-luxury-800 p-6 flex flex-col justify-between rounded-sm relative shadow-md hover:shadow-2xl hover:border-gold-500/30 hover:shadow-gold-500/[0.03] transition-colors duration-300"
                      >
                        {/* Cancellation Button */}
                        <button
                          onClick={() => handleDeleteReservation(res.id)}
                          className="absolute top-4 right-4 text-luxury-500 hover:text-red-400 transition-colors p-1"
                          title="Cancel Reservation"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div className="space-y-4">
                          <div className="flex justify-between items-start border-b border-luxury-800 pb-3">
                            <div>
                              <p className="text-[8px] tracking-widest text-luxury-500 uppercase">RESERVATION CODE</p>
                              <p className="text-sm font-semibold text-gold-300 font-mono mt-0.5">{res.id}</p>
                            </div>
                            <span className="bg-green-500/10 text-green-400 text-[9px] px-2.5 py-0.5 uppercase tracking-wider font-semibold rounded-full mt-1">
                              {res.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-y-3 text-xs text-luxury-300">
                            <div>
                              <p className="text-[9px] tracking-widest text-luxury-500 uppercase">SUITE</p>
                              <p className="text-luxury-100 font-medium mt-0.5">{res.roomTierName}</p>
                            </div>
                            <div>
                              <p className="text-[9px] tracking-widest text-luxury-500 uppercase">LEAD GUEST</p>
                              <p className="text-luxury-100 font-medium mt-0.5 truncate">{res.guestName}</p>
                            </div>
                            <div>
                              <p className="text-[9px] tracking-widest text-luxury-500 uppercase">DATES</p>
                              <p className="text-luxury-100 font-semibold mt-0.5">
                                {formatHumanDate(res.checkIn)} - {formatHumanDate(res.checkOut)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] tracking-widest text-luxury-500 uppercase">STAY DETAILS</p>
                              <p className="text-luxury-100 font-medium mt-0.5">
                                {res.totalNights} Nights // {res.guestsCount} Guests
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Charges Footer */}
                        <div className="pt-4 mt-6 border-t border-luxury-800 flex justify-between items-center">
                          <div>
                            <p className="text-[8px] tracking-widest text-luxury-500 uppercase">STATUS</p>
                            <p className="text-luxury-300 text-[11px] font-mono mt-0.5 uppercase">{res.status} · Awaiting confirmation</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] tracking-widest text-luxury-500 uppercase">ESTIMATE</p>
                            <p className="text-base font-serif font-bold text-gold-300">On request</p>
                          </div>
                        </div>

                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* 8. FOOTER SECTION */}
      <footer id="footer" className="bg-luxury-950 border-t border-luxury-900 py-16 lg:py-24 text-left relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-y-10 gap-x-8 lg:gap-12">
          {/* Col 1: Brand */}
          <div className="space-y-4 sm:col-span-2 lg:col-span-3">
            <div className="flex items-center space-x-3 text-luxury-100 tracking-widest font-serif">
              {logo.customImage ? (
                <img
                  src={logo.customImage}
                  alt={logo.text || "BAIA"}
                  style={{ height: `${Math.min(logo.imageHeightPx || 32, 48)}px` }}
                  className="object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-gold-300 text-xs font-sans text-gold-300 font-medium">
                    {logo.letter}
                  </span>
                  <span className="text-lg tracking-[0.3em] uppercase">{logo.text}</span>
                </>
              )}
            </div>
            <p className="text-xs text-luxury-400 leading-relaxed font-sans font-light max-w-sm">
              {footer.brandText}
            </p>
            {/* Social Media Section */}
            <div className="pt-2 space-y-2">
              <span className="text-[9px] tracking-widest text-gold-300/80 font-sans uppercase font-bold block">
                Connect With Us
              </span>
              <div className="flex items-center gap-2">
                {footer.instagramUrl && (
                  <a
                    href={footer.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full border border-luxury-800/80 text-luxury-400 hover:text-gold-300 hover:border-gold-300/40 flex items-center justify-center transition-all duration-300 bg-luxury-900/30 hover:bg-luxury-900/80"
                    title="Instagram"
                  >
                    <Instagram size={13} />
                  </a>
                )}
                {footer.facebookUrl && (
                  <a
                    href={footer.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full border border-luxury-800/80 text-luxury-400 hover:text-gold-300 hover:border-gold-300/40 flex items-center justify-center transition-all duration-300 bg-luxury-900/30 hover:bg-luxury-900/80"
                    title="Facebook"
                  >
                    <Facebook size={13} />
                  </a>
                )}
                {footer.tiktokUrl && (
                  <a
                    href={footer.tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full border border-luxury-800/80 text-luxury-400 hover:text-gold-300 hover:border-gold-300/40 flex items-center justify-center transition-all duration-300 bg-luxury-900/30 hover:bg-luxury-900/80"
                    title="TikTok"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Col 2: Navigation links */}
          <div className="space-y-3 text-xs font-sans sm:col-span-1 lg:col-span-2">
            <h4 className="font-semibold text-gold-300 tracking-widest uppercase text-[10px]">EXPLORE BAIA</h4>
            <ul className="space-y-2 text-luxury-400">
              <li>
                <button onClick={() => scrollToSection("stay")} className="hover:text-gold-500 transition-colors cursor-pointer text-left">
                  The Sanctuary Villas
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection("experiences")} className="hover:text-gold-500 transition-colors cursor-pointer text-left">
                  Curated Experiences
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection("philosophy")} className="hover:text-gold-500 transition-colors cursor-pointer text-left">
                  Our Natural Philosophy
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection("gallery")} className="hover:text-gold-500 transition-colors cursor-pointer text-left">
                  Island Perspectives Gallery
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Contact details */}
          <div className="space-y-3 text-xs font-sans sm:col-span-1 lg:col-span-2">
            <h4 className="font-semibold text-gold-300 tracking-widest uppercase text-[10px]">THE RETREAT</h4>
            <ul className="space-y-2 text-luxury-400 leading-relaxed">
              <li>{footer.location1}</li>
              <li>{footer.location2}</li>
              <li className="pt-1">
                <a href={`mailto:${footer.email}`} className="hover:text-gold-500 transition-colors font-medium">
                  {footer.email}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Certifications & Secure badges */}
          <div className="space-y-3 sm:col-span-1 lg:col-span-2">
            <h4 className="font-semibold text-gold-300 tracking-widest uppercase text-[10px] font-sans">
              {footer.trustTitle}
            </h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs text-luxury-300">
                <ShieldCheck size={16} className="text-gold-300 flex-shrink-0" />
                <span className="font-medium">{footer.trustBadge}</span>
              </div>
              <p className="text-[10px] text-luxury-500 leading-relaxed font-sans">
                {footer.trustDescription}
              </p>
            </div>
          </div>

          {/* Col 5: Discreet Minimalist Newsletter Signup */}
          <div className="sm:col-span-2 lg:col-span-3">
            <Newsletter />
          </div>
        </div>

        {/* Footer legalities */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-8 mt-12 border-t border-luxury-900/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[10px] tracking-wider text-luxury-500 font-sans uppercase">
          <span className="text-left">{footer.copyright}</span>
          <div className="flex gap-4 items-center">
            <a href="#" className="hover:text-gold-500 transition-colors">Privacy Policy</a>
            <span className="text-luxury-800">//</span>
            <a href="#" className="hover:text-gold-500 transition-colors">Terms of Stay</a>
            <span className="text-luxury-800">//</span>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-gold-500 text-luxury-500 transition-colors cursor-pointer uppercase font-sans tracking-wider"
            >
              Admin Access
            </button>
          </div>
        </div>
      </footer>

      {/* Interactive Reservation Portal Modal */}
      <AnimatePresence>
        {isBookingOpen && (
          <BookingModal
            isOpen={isBookingOpen}
            onClose={handleBookingClose}
            initialDates={activeReservationData}
            onSubmitted={handleInquirySubmitted}
          />
        )}
      </AnimatePresence>

      {/* Admin Panel Modal Overlay */}
      <AnimatePresence>
        {isAdminOpen && (
          <AdminGate onClose={() => setIsAdminOpen(false)} />
        )}
      </AnimatePresence>

      {/* Floating AI concierge chat */}
      <ConciergeWidget open={isConciergeOpen} onClose={() => setIsConciergeOpen(false)} />

      {/* Minimalist Floating Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-8 right-8 z-40 bg-luxury-900/90 hover:bg-gold-500 hover:text-luxury-950 border border-luxury-800/80 text-gold-300 p-3 shadow-2xl transition-all duration-300 rounded-full group cursor-pointer focus:outline-none focus:ring-1 focus:ring-gold-400 backdrop-blur-sm"
            aria-label="Scroll to top"
            title="Back to Top"
          >
            <ArrowUp size={16} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
