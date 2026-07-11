/**
 * Admin authentication gate. Wraps AdminPanel so only signed-in admins can
 * open it. Sign-in uses Supabase Auth (email/password). Admin role is granted
 * separately in the Users table (`user_roles.role = 'admin'`).
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X, ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminPanel from "./AdminPanel";

type Status = "loading" | "signed-out" | "not-admin" | "admin";

export default function AdminGate({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("signed-out"); return; }
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    setStatus(role ? "admin" : "not-admin");
  };

  useEffect(() => {
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (status === "admin") {
    return (
      <>
        <AdminPanel isOpen={true} onClose={onClose} />
        <button
          onClick={handleSignOut}
          className="fixed bottom-6 left-6 z-[60] bg-luxury-900 border border-luxury-700 text-luxury-200 hover:text-gold-300 hover:border-gold-500 rounded-sm px-4 py-2 text-[10px] tracking-widest uppercase font-sans font-semibold flex items-center gap-2 cursor-pointer"
          title="Sign out of admin"
        >
          <LogOut size={12} /> Sign out
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
        <h2 className="text-xl font-serif uppercase tracking-wider text-luxury-100">Sign in to manage BAIA</h2>
        <p className="text-xs text-luxury-400 mt-2 leading-relaxed">
          {status === "not-admin"
            ? "You're signed in but not an admin on this project. Ask another admin to grant you the admin role, or sign in with an admin account."
            : "Only accounts marked as admin can edit rooms, activities, gallery, theme, and site content."}
        </p>

        {status !== "not-admin" && (
          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 focus:outline-none focus:border-gold-300 font-sans"
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-semibold">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-luxury-950 border border-luxury-800 rounded-sm px-4 py-3 text-sm text-luxury-100 focus:outline-none focus:border-gold-300 font-sans"
              />
            </div>
            {error && <p className="text-[11px] text-red-400 font-sans">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white py-3 text-[11px] tracking-widest font-sans font-bold uppercase cursor-pointer"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {status === "not-admin" && (
          <button
            onClick={handleSignOut}
            className="mt-6 w-full border border-luxury-700 text-luxury-200 hover:text-gold-300 hover:border-gold-500 py-3 text-[11px] tracking-widest font-sans font-bold uppercase cursor-pointer"
          >
            Sign out
          </button>
        )}

        <p className="text-[10px] text-luxury-500 mt-6 leading-relaxed">
          First-time setup: create your account in the Cloud Users panel, then run
          <code className="mx-1 text-luxury-300">INSERT INTO user_roles (user_id, role) VALUES ('&lt;your-uid&gt;', 'admin');</code>
          via the Cloud SQL editor.
        </p>
      </motion.div>
    </div>
  );
}
