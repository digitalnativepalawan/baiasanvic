import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please enter an email address.");
      setStatus("error");
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("submitting");

    // Simulate luxury API response / processing
    setTimeout(() => {
      // Store in localStorage to persist subscriber list
      try {
        const currentSubscribers = JSON.parse(localStorage.getItem("baia_subscribers") || "[]");
        if (!currentSubscribers.includes(trimmedEmail)) {
          currentSubscribers.push(trimmedEmail);
          localStorage.setItem("baia_subscribers", JSON.stringify(currentSubscribers));
        }
      } catch (err) {
        console.error("Storage error:", err);
      }

      setStatus("success");
      setEmail("");
    }, 1200);
  };

  return (
    <div id="newsletter-signup-container" className="space-y-4">
      <div className="space-y-1">
        <h4 className="font-semibold text-gold-300 tracking-[0.2em] uppercase text-[10px] font-sans">
          THE PRIVATE JOURNAL
        </h4>
        <p className="text-xs text-luxury-400 font-sans font-light leading-relaxed">
          Subscribe to receive exclusive, gentle updates from BAIA, off-grid announcements, and priority villa releases.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success-message"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-luxury-900/40 border border-emerald-500/20 p-4 rounded-sm space-y-2"
          >
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 size={14} className="shrink-0" />
              <span className="text-[10px] tracking-widest font-sans uppercase font-bold">
                Subscription Confirmed
              </span>
            </div>
            <p className="text-[11px] text-luxury-300 font-sans font-light leading-relaxed">
              You are now on our list. Expect updates as gentle as the Palawan tide.
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="text-[9px] text-gold-400 hover:text-gold-300 transition-colors uppercase font-sans tracking-widest font-bold underline underline-offset-4 cursor-pointer"
            >
              Sign up another email
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="signup-form"
            onSubmit={handleSubscribe}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2.5"
          >
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-luxury-500">
                <Mail size={13} />
              </div>
              <input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                disabled={status === "submitting"}
                className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-500/60 py-2.5 pl-9 pr-12 text-xs text-luxury-100 rounded-sm focus:outline-none transition-all placeholder:text-luxury-600 font-sans tracking-wide"
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className="absolute right-1 px-3 py-1.5 bg-luxury-950 hover:bg-gold-500 hover:text-luxury-950 text-gold-300 rounded-sm transition-all duration-300 cursor-pointer disabled:opacity-50"
                aria-label="Submit subscription"
              >
                {status === "submitting" ? (
                  <span className="block w-3.5 h-3.5 border-2 border-gold-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </div>

            <AnimatePresence>
              {status === "error" && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[10px] text-red-400 font-sans"
                >
                  {errorMessage}
                </motion.p>
              )}
            </AnimatePresence>

            <span className="text-[9px] text-luxury-600 block font-sans tracking-wider leading-normal">
              We respect your quiet. Unsubscribe in a single click at any time.
            </span>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
