/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSite } from "../context/SiteContext";

interface NavbarProps {
  onBookClick: () => void;
  onSectionClick: (sectionId: string) => void;
}

export default function Navbar({ onBookClick, onSectionClick }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logo, header } = useSite();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLinkClick = (id: string) => {
    setIsMobileMenuOpen(false);
    onSectionClick(id);
  };

  return (
    <nav
      id="navbar-container"
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ease-in-out ${
        isScrolled
          ? "bg-luxury-950/95 backdrop-blur-md border-b border-luxury-800 py-4 shadow-sm"
          : "bg-gradient-to-b from-black/60 via-black/20 to-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          id="navbar-logo-btn"
          onClick={() => handleLinkClick("hero")}
          className={`flex items-center hover:opacity-85 transition-all duration-300 ${
            isScrolled ? "text-luxury-100" : "text-white"
          }`}
        >
          {logo.customImage ? (
            <img 
              src={logo.customImage} 
              alt={logo.text || "BAIA"} 
              style={{ height: `${logo.imageHeightPx || 32}px` }}
              className="object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex items-center space-x-3 tracking-[0.3em] font-serif">
              <span 
                style={{ 
                  width: `${logo.letterSizePx}px`, 
                  height: `${logo.letterSizePx}px`,
                  fontSize: `${Math.max(10, Math.floor(logo.letterSizePx * 0.45))}px`
                }}
                className={`inline-flex items-center justify-center rounded-full border font-sans font-medium transition-all duration-300 ${
                  isScrolled ? "border-gold-500 text-gold-500" : "border-white/80 text-white"
                }`}
              >
                {logo.letter}
              </span>
              <span 
                style={{ fontSize: `${logo.sizePx}px` }}
                className="font-light tracking-[0.4em] uppercase"
              >
                {logo.text}
              </span>
            </div>
          )}
        </button>

        {/* Desktop Navigation Links */}
        <div id="desktop-nav" className="hidden md:flex items-center space-x-10">
          {header.links.map((link) => (
            <button
              key={link.id}
              onClick={() => handleLinkClick(link.id)}
              className={`text-[11px] tracking-[0.25em] font-sans transition-colors duration-300 cursor-pointer uppercase font-medium ${
                isScrolled ? "text-luxury-300 hover:text-gold-500" : "text-white/90 hover:text-white"
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div id="desktop-cta" className="hidden md:block">
          <button
            onClick={onBookClick}
            className={`px-6 py-2.5 text-[11px] tracking-[0.25em] font-sans transition-all duration-300 cursor-pointer uppercase font-medium border ${
              isScrolled
                ? "border-gold-500 text-gold-500 bg-gold-500/5 hover:bg-gold-500 hover:text-white"
                : "border-white/60 text-white hover:border-white hover:bg-white/10"
            }`}
          >
            {header.bookButtonText}
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          id="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`md:hidden transition-colors cursor-pointer ${
            isScrolled ? "text-luxury-100 hover:text-gold-500" : "text-white hover:text-white/80"
          }`}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-nav-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`md:hidden border-b overflow-hidden ${
              isScrolled ? "bg-luxury-950 border-luxury-800" : "bg-black/95 border-white/10"
            }`}
          >
            <div className="px-6 py-8 flex flex-col space-y-6">
              {header.links.map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link.id)}
                  className={`text-[12px] tracking-[0.2em] font-sans transition-colors uppercase text-left py-2 font-medium ${
                    isScrolled ? "text-luxury-300 hover:text-gold-500" : "text-white/80 hover:text-white"
                  }`}
                >
                  {link.label}
                </button>
              ))}
              <div className={`pt-4 border-t ${isScrolled ? "border-luxury-800" : "border-white/10"}`}>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onBookClick();
                  }}
                  className={`w-full text-center py-3 text-[12px] tracking-[0.2em] font-sans bg-transparent transition-all uppercase font-semibold border ${
                    isScrolled
                      ? "border-gold-500 text-gold-500 hover:bg-gold-500 hover:text-white"
                      : "border-white/60 text-white hover:bg-white/10"
                  }`}
                >
                  {header.bookButtonText}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
