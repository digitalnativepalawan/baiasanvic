/**
 * Admin gate using a simple passkey.
 * Verified both client-side (for UI unlock) and server-side (for uploads/saves).
 */

import { useState } from "react";
import { motion } from "motion/react";
import { X, ShieldCheck, LogOut } from "lucide-react";
import AdminPanel from "./AdminPanel";
import { useSite } from "../context/SiteContext";

const ADMIN_PASSKEY = "5309";

export default function AdminGate({ onClose }: { onClose: () => void }) {
  const { adminPasskey, setAdminPasskey } = useSite();
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unlocked = !!adminPasskey;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkey === ADMIN_PASSKEY) {
      setAdminPasskey(passkey);
      setError(null);
    } else {
      setError("Incorrect passkey.");
    }
  };

  const lock = () => setAdminPasskey(null);

  if (unlocked) {
    return (
      <>
        <AdminPanel isOpen={true} onClose={onClose} />
        <button
          onClick={lock}
          className="fixed bottom-6 left-6 z-[60] bg-luxury-900 border border-luxury-700 text-luxury-200 hover:text-gold-300 hover:border-gold-500 rounded-sm px-4 py-2 text-[10px] tracking-widest uppercase font-sans font-semibold flex items-center gap-2 cursor-pointer"
          title="Lock admin"
        >
          <LogOut size={12} /> Lock
        </button>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-luxury-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-luxury-900 border border-luxury-800 w-full max-w-md rounded-sm p-8 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-luxury-400 hover:text-gold-500 cursor-pointer"
          aria-label="Close admin login"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-gold-300 mb-2">
          <ShieldCheck size={18} />
          <span className="text-[10px] tracking-widest uppercase font-sans font-semibold">Admin Access</span>
        </div>
        <h2 className="text-xl font-serif uppercase tracking-wider text-luxury-100">Enter admin passkey</h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">Passkey</label>
            <input
              type="password"
              required
              autoFocus
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 focus:outline-none focus:border-gold-300 font-sans tracking-widest"
            />
          </div>
          {error && <p className="text-[11px] text-red-400 font-sans">{error}</p>}
          <button
            type="submit"
            className="w-full bg-gold-500 hover:bg-gold-600 text-white py-3 text-[11px] tracking-widest font-sans font-bold uppercase cursor-pointer"
          >
            Unlock
          </button>
        </form>
      </motion.div>
    </div>
  );
}
