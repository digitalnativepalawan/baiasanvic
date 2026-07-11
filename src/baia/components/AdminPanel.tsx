import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Lock, Eye, Check, RefreshCw, Upload, Image as ImageIcon, 
  Trash2, Plus, Edit2, Sliders, Menu, FileText, Download, Shield,
  Layers, Coffee, Home, HelpCircle, Save, Info, Palette
} from "lucide-react";
import { useSite, GalleryItem, DEFAULT_THEME } from "../context/SiteContext";
import { RoomTier, Activity } from "../types";
import { uploadSiteAsset } from "../admin.functions";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const isVideo = (url: string) => {
  if (!url) return false;
  return url.startsWith("data:video/") || 
         url.endsWith(".mp4") || 
         url.endsWith(".webm") || 
         url.endsWith(".mov") || 
         url.endsWith(".ogg") ||
         url.includes("video");
};

type AdminTab = "hero_logo" | "sections" | "header_footer" | "theme_colors" | "gallery" | "rooms_activities" | "system";

const ACCEPTED_IMAGE_TYPES = "image/webp,image/png,image/jpeg,image/svg+xml,.webp,.png,.jpg,.jpeg,.svg";
const ACCEPTED_IMAGE_GUIDANCE = "Accepted image types: WEBP, PNG, JPG/JPEG, SVG. Max 5 MB.";
const ACCEPTED_VIDEO_TYPES = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
const ACCEPTED_VIDEO_GUIDANCE = "Accepted video types: MP4, WEBM, MOV. Max 20 MB.";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const getFileContentType = (file: File) => {
  const browserType = (file.type || "").toLowerCase();
  if (browserType) return browserType;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXTENSION[ext] || "";
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("The file could not be read completely."));
    reader.readAsDataURL(file);
  });

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const {
    hero,
    logo,
    header,
    footer,
    theme,
    galleryItems,
    rooms,
    activities,
    updateHero,
    updateLogo,
    updateHeader,
    updateFooter,
    updateTheme,
    addGalleryItem,
    updateGalleryItem,
    deleteGalleryItem,
    updateRoom,
    addRoom,
    deleteRoom,
    updateActivity,
    addActivity,
    deleteActivity,
    resetToDefault,
    adminPasskey,
  } = useSite();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("hero_logo");
  const [successMsg, setSuccessMsg] = useState("");

  // Upload Progress and Feedback states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "completed" | "error">("idle");

  // Create temporary state for editing items
  const [editingGalleryId, setEditingGalleryId] = useState<string | null>(null);
  const [newGalleryItem, setNewGalleryItem] = useState<Omit<GalleryItem, "id">>({
    src: "",
    title: "",
    location: "",
    description: "",
    category: "Nature"
  });

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const roomFileRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const roomAddMediaFileRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const activityFileRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const newGalleryFileRef = useRef<HTMLInputElement>(null);
  const editGalleryFileRef = useRef<HTMLInputElement>(null);

  // Auto clear success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Handle Authentication
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkeyInput === "5309") {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Invalid passkey. Access denied.");
    }
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
  };

  // Upload file to Supabase Storage (site-assets bucket) and return the public URL
  // to the caller. Keeps the original callback signature so every call site still
  // just receives a string it can drop into an <img src>.
  const handleImageUpload = async (
    file: File,
    callback: (url: string) => void,
    opts: { allowVideo?: boolean } = {}
  ) => {
    setIsUploading(true);
    setUploadProgress(5);
    setUploadFileName(file.name);
    setUploadStatus("uploading");

    let currentVal = 5;
    const interval = setInterval(() => {
      const step = currentVal < 60 ? (Math.floor(Math.random() * 12) + 6) : (Math.floor(Math.random() * 6) + 1);
      currentVal = Math.min(95, currentVal + step);
      setUploadProgress(currentVal);
    }, 100);

    const finishError = (msg: string) => {
      clearInterval(interval);
      setUploadStatus("error");
      triggerSuccess(msg);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus("idle");
        setUploadFileName("");
      }, 3000);
    };

    try {
      if (!adminPasskey) {
        throw new Error("Admin not unlocked. Enter passkey and try again.");
      }
      const imageAllowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
      const videoAllowed = ["video/mp4", "video/webm", "video/quicktime"];
      const ct = getFileContentType(file);
      const isImage = imageAllowed.includes(ct);
      const isVideo = videoAllowed.includes(ct);
      if (!isImage && !(opts.allowVideo && isVideo)) {
        throw new Error(opts.allowVideo
          ? "Unsupported file type. Use WEBP/PNG/JPG/SVG for images or MP4/WEBM/MOV for video."
          : "Unsupported file type. Use WEBP, PNG, JPG/JPEG, or SVG.");
      }
      const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > cap) {
        throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max ${cap / 1024 / 1024} MB.`);
      }

      const base64 = await fileToBase64(file);
      if (!base64) throw new Error("The file could not be read completely. Try another export.");

      const { url } = await uploadSiteAsset({
        data: { passkey: adminPasskey, filename: file.name, contentType: ct, base64 },
      });

      clearInterval(interval);
      setUploadProgress(100);
      setUploadStatus("completed");
      callback(url);
      triggerSuccess(`"${file.name}" uploaded successfully!`);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus("idle");
        setUploadFileName("");
      }, 3000);
    } catch (err: any) {
      finishError(err?.message ? `Upload failed: ${err.message}` : `Error occurred during upload of "${file.name}".`);
    }
  };


  const handleCreateNewRoom = () => {
    addRoom({
      name: "New Sanctuary Villa",
      description: "A private barefoot luxury villa nestled in our lush gardens.",
      pricePerNight: 350,
      size: "30 m²",
      capacity: "sleeps up to 2",
      amenities: ["Air conditioning", "Private bathroom", "Hot water"],
      imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
      images: ["https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80"],
      availabilityCount: 2
    });
    triggerSuccess("Successfully created a new sanctuary villa. You can now edit its details.");
  };

  // LOGO EXPORT/DOWNLOAD UTILITIES
  // 1. Download SVG Logo (Vector Format)
  const handleDownloadSVG = () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120">
      <style>
        .circle { fill: none; stroke: #d4af37; stroke-width: 2; }
        .letter { fill: #d4af37; font-family: "Inter", sans-serif; font-size: 16px; font-weight: 600; text-anchor: middle; dominant-baseline: central; }
        .brand-text { fill: #ffffff; font-family: "Playfair Display", "Georgia", serif; font-size: 26px; font-weight: 300; letter-spacing: 0.4em; }
        .bg { fill: #0a0e12; }
      </style>
      <rect width="100%" height="100%" class="bg" rx="4" />
      <g transform="translate(60, 60)">
        <circle r="22" class="circle" />
        <text class="letter">${logo.letter || "Q"}</text>
      </g>
      <text x="110" y="70" class="brand-text">${logo.text || "BAIA"}</text>
    </svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${logo.text.toLowerCase()}_logo_vector.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerSuccess("Vector SVG Logo downloaded successfully.");
  };

  // 2. Download PNG Logo (High Resolution Raster)
  const handleDownloadPNG = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = "#0a0e12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw logo circular badge
    const badgeX = 180;
    const badgeY = 180;
    const badgeRadius = 66;

    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw icon/letter
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 54px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(logo.letter || "Q", badgeX, badgeY);

    // Draw logo text
    ctx.fillStyle = "#ffffff";
    ctx.font = "300 72px 'Georgia', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    // Add letter spacing manually for canvas
    const text = logo.text || "BAIA";
    const startX = 330;
    let currentX = startX;
    const letterSpacing = 28;

    for (let i = 0; i < text.length; i++) {
      ctx.fillText(text[i], currentX, badgeY);
      currentX += ctx.measureText(text[i]).width + letterSpacing;
    }

    // Trigger download
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${logo.text.toLowerCase()}_logo_highres.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerSuccess("High-res PNG Logo downloaded successfully.");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
          />

          {/* Panel drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="relative w-full max-w-4xl bg-luxury-950 border-l border-luxury-900 h-full flex flex-col shadow-2xl z-10 text-luxury-100"
          >
            {/* Header */}
            <div className="p-6 border-b border-luxury-900 flex justify-between items-center bg-luxury-950">
              <div className="flex items-center space-x-3">
                <span className="p-2 bg-gold-500/10 border border-gold-500/20 rounded text-gold-300">
                  <Shield size={18} />
                </span>
                <div>
                  <h2 className="text-lg font-serif tracking-wider uppercase font-bold text-luxury-100">
                    BAIA RESORT ADMIN CONTROL
                  </h2>
                  <p className="text-[10px] text-gold-400 font-sans tracking-widest uppercase">
                    Core Configurator // Passkey Verified
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isAuthenticated && (
                  <button
                    onClick={() => {
                      setIsAuthenticated(false);
                      setPasskeyInput("");
                    }}
                    className="text-[10px] tracking-widest font-sans border border-luxury-800 text-luxury-400 hover:text-white px-3 py-1.5 rounded uppercase hover:bg-luxury-900 transition-colors"
                  >
                    Lock Console
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-luxury-400 hover:text-gold-500 transition-colors bg-luxury-900 rounded-full hover:bg-luxury-800"
                  aria-label="Close panel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            {!isAuthenticated ? (
              /* LOGIN STATE */
              <div className="flex-1 flex flex-col justify-center items-center px-8 text-center bg-luxury-950">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-md w-full bg-luxury-900 border border-luxury-800 p-8 rounded-sm shadow-xl space-y-6"
                >
                  <div className="flex justify-center">
                    <div className="p-4 bg-gold-500/10 border border-gold-500/20 rounded-full text-gold-300 animate-pulse">
                      <Lock size={32} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-widest">
                      Enter Security Passkey
                    </h3>
                    <p className="text-xs text-luxury-400 font-sans font-light mt-1.5">
                      Access to database settings, logo dimensions, and site assets requires authorization.
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative text-left">
                      <label className="text-[10px] tracking-widest text-gold-300 font-sans font-semibold uppercase block mb-1.5">
                        Passkey Credentials
                      </label>
                      <input
                        type="password"
                        placeholder="••••"
                        value={passkeyInput}
                        onChange={(e) => setPasskeyInput(e.target.value)}
                        className="w-full bg-luxury-950 border border-luxury-800 focus:border-gold-300 text-center tracking-[0.5em] font-sans font-bold text-luxury-100 placeholder:text-luxury-700 placeholder:tracking-normal py-3 px-4 focus:outline-none transition-colors rounded-sm text-lg"
                        autoFocus
                      />
                    </div>

                    {authError && (
                      <p className="text-xs text-red-400 font-sans text-center font-medium">
                        {authError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-gold-500 text-luxury-950 text-xs tracking-[0.25em] font-sans font-bold py-3.5 hover:bg-gold-400 transition-all cursor-pointer rounded-sm uppercase"
                    >
                      Authenticate Console
                    </button>
                  </form>
                  <p className="text-[9px] text-luxury-500 tracking-wider font-sans font-light">
                    Tip: Passkey is 5309
                  </p>
                </motion.div>
              </div>
            ) : (
              /* AUTHORIZED CONSOLE STATE */
              <div className="flex-1 flex overflow-hidden">
                {/* Admin Tabs Sidebar */}
                <div className="w-56 border-r border-luxury-900 bg-luxury-950/80 flex flex-col justify-between py-6">
                  <div className="space-y-1 px-3">
                    <span className="text-[9px] tracking-[0.25em] text-luxury-500 font-sans font-semibold uppercase block px-3 mb-3">
                      Navigations
                    </span>

                    <button
                      onClick={() => setActiveTab("hero_logo")}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-sm font-sans text-xs tracking-wider uppercase transition-all text-left ${
                        activeTab === "hero_logo"
                          ? "bg-gold-500/10 text-gold-300 border-l-2 border-gold-300 font-medium"
                          : "text-luxury-400 hover:text-luxury-100 hover:bg-luxury-900/50"
                      }`}
                    >
                      <Sliders size={14} />
                      <span>Hero & Logo</span>
                    </button>

                    <button
                      onClick={() => setActiveTab("header_footer")}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-sm font-sans text-xs tracking-wider uppercase transition-all text-left ${
                        activeTab === "header_footer"
                          ? "bg-gold-500/10 text-gold-300 border-l-2 border-gold-300 font-medium"
                          : "text-luxury-400 hover:text-luxury-100 hover:bg-luxury-900/50"
                      }`}
                    >
                      <Layers size={14} />
                      <span>Header & Footer</span>
                    </button>

                    <button
                      onClick={() => setActiveTab("theme_colors")}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-sm font-sans text-xs tracking-wider uppercase transition-all text-left ${
                        activeTab === "theme_colors"
                          ? "bg-gold-500/10 text-gold-300 border-l-2 border-gold-300 font-medium"
                          : "text-luxury-400 hover:text-luxury-100 hover:bg-luxury-900/50"
                      }`}
                    >
                      <Palette size={14} />
                      <span>Theme & Palette</span>
                    </button>

                    <button
                      onClick={() => setActiveTab("gallery")}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-sm font-sans text-xs tracking-wider uppercase transition-all text-left ${
                        activeTab === "gallery"
                          ? "bg-gold-500/10 text-gold-300 border-l-2 border-gold-300 font-medium"
                          : "text-luxury-400 hover:text-luxury-100 hover:bg-luxury-900/50"
                      }`}
                    >
                      <ImageIcon size={14} />
                      <span>Visual Journal</span>
                    </button>

                    <button
                      onClick={() => setActiveTab("rooms_activities")}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-sm font-sans text-xs tracking-wider uppercase transition-all text-left ${
                        activeTab === "rooms_activities"
                          ? "bg-gold-500/10 text-gold-300 border-l-2 border-gold-300 font-medium"
                          : "text-luxury-400 hover:text-luxury-100 hover:bg-luxury-900/50"
                      }`}
                    >
                      <Home size={14} />
                      <span>Resort Assets</span>
                    </button>

                    <button
                      onClick={() => setActiveTab("system")}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-sm font-sans text-xs tracking-wider uppercase transition-all text-left ${
                        activeTab === "system"
                          ? "bg-gold-500/10 text-gold-300 border-l-2 border-gold-300 font-medium"
                          : "text-luxury-400 hover:text-luxury-100 hover:bg-luxury-900/50"
                      }`}
                    >
                      <RefreshCw size={14} />
                      <span>System Settings</span>
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div className="px-6 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse" />
                      <span className="text-[9px] tracking-widest text-emerald-400 font-sans uppercase font-bold">
                        Database Connected
                      </span>
                    </div>
                    <p className="text-[8px] text-luxury-500 font-mono">
                      v1.4.2 // LocalStorage
                    </p>
                  </div>
                </div>

                {/* Edit Form Area */}
                <div className="flex-1 bg-luxury-900/30 overflow-y-auto p-8 relative">
                  {/* Success Banner */}
                  <AnimatePresence>
                    {successMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-4 left-8 right-8 z-20 bg-emerald-950 border border-emerald-800 text-emerald-300 p-3 rounded-sm flex items-center space-x-2.5 text-xs font-sans"
                      >
                        <Check size={16} className="bg-emerald-800 rounded-full p-0.5 text-emerald-200" />
                        <span>{successMsg}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* -------------------- TAB: HERO & LOGO -------------------- */}
                  {activeTab === "hero_logo" && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-1">
                          Hero Section & Logo Brand
                        </h3>
                        <p className="text-xs text-luxury-400 font-sans font-light">
                          Configure the visual centerpiece, descriptive subtitles, and physical sizing of the BAIA resort signature logo.
                        </p>
                      </div>

                      {/* Hero Image Block */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4 text-left">
                        <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold flex items-center space-x-2">
                          <ImageIcon size={14} />
                          <span>Hero Background Image</span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                          <div className="md:col-span-4">
                            <div className="aspect-[16/10] bg-luxury-900 border border-luxury-800 rounded-sm overflow-hidden relative group">
                              <img
                                src={hero.backgroundImage}
                                alt="Current Hero background"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                          <div className="md:col-span-8 space-y-3">
                            <div>
                              <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                Image URL
                              </label>
                              <input
                                type="text"
                                value={hero.backgroundImage}
                                onChange={(e) => updateHero({ backgroundImage: e.target.value })}
                                className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                Or Upload Image from Device
                              </label>
                              <button
                                type="button"
                                onClick={() => heroFileRef.current?.click()}
                                className="inline-flex items-center space-x-2 bg-luxury-900 border border-luxury-800 hover:border-gold-500/50 hover:bg-luxury-850 px-4 py-2 text-xs text-luxury-200 transition-all rounded-sm cursor-pointer"
                              >
                                <Upload size={13} />
                                <span>Choose Local File</span>
                              </button>
                              <input
                                type="file" accept={ACCEPTED_IMAGE_TYPES}
                                ref={heroFileRef}

                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(file, (base64) => {
                                      updateHero({ backgroundImage: base64 });
                                      triggerSuccess("Hero background image uploaded from device.");
                                    });
                                  }
                                }}
                                className="hidden"
                              />
                              <p className="mt-2 text-[9px] tracking-wider text-luxury-500 font-sans uppercase">
                                {ACCEPTED_IMAGE_GUIDANCE}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hero Copy Content */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4 text-left">
                        <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                          Hero Title & Subtitle copy
                        </h4>

                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Hero Title (Supports Line Breaks via Enter key)
                            </label>
                            <textarea
                              rows={3}
                              value={hero.title}
                              onChange={(e) => updateHero({ title: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-2 px-3 text-xs text-luxury-100 rounded focus:outline-none font-serif leading-relaxed"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Hero Subtitle
                            </label>
                            <textarea
                              rows={2}
                              value={hero.subtitle}
                              onChange={(e) => updateHero({ subtitle: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-2 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Logo Configurations */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-6 text-left">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                            Logo Customization & Dimensions
                          </h4>
                          <span className="text-[9px] bg-gold-300/10 text-gold-300 border border-gold-300/20 px-2 py-0.5 rounded font-mono">
                            SVG Vector Capable
                          </span>
                        </div>

                        {/* Live Logo Preview Box */}
                        <div className="p-8 bg-luxury-900 border border-luxury-800 rounded flex flex-col items-center justify-center space-y-3 relative group">
                          <span className="absolute top-2.5 left-2.5 text-[8px] tracking-widest text-luxury-500 font-sans uppercase">
                            Brand Preview
                          </span>

                          <div className="flex items-center space-x-3">
                            {logo.customImage ? (
                              <img
                                src={logo.customImage}
                                alt="Custom Logo Preview"
                                style={{ height: `${logo.imageHeightPx || 32}px` }}
                                className="object-contain"
                              />
                            ) : (
                              <>
                                {/* Logo circular badge */}
                                <span 
                                  style={{ 
                                    width: `${logo.letterSizePx}px`, 
                                    height: `${logo.letterSizePx}px`,
                                    fontSize: `${Math.max(10, Math.floor(logo.letterSizePx * 0.45))}px`
                                  }}
                                  className="inline-flex items-center justify-center rounded-full border border-gold-300 font-sans text-gold-300 font-medium"
                                >
                                  {logo.letter}
                                </span>
                                
                                {/* Logo Text */}
                                <span 
                                  style={{ fontSize: `${logo.sizePx}px` }}
                                  className="font-light tracking-[0.4em] uppercase text-white font-serif"
                                >
                                  {logo.text}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Custom Logo Image Upload Component */}
                        <div className="bg-luxury-900/50 p-4 border border-luxury-800 rounded-sm space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] tracking-widest text-gold-300 font-sans uppercase font-bold block">
                              Custom Logo Image File / Graphic URL
                            </span>
                            {logo.customImage && (
                              <span className="text-[8px] bg-gold-300/10 text-gold-300 border border-gold-300/20 px-1.5 py-0.5 rounded font-mono">
                                Custom Active
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Upload Button */}
                            <div className="space-y-2">
                              <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block">
                                Upload Logo from Device
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => logoFileRef.current?.click()}
                                  className="inline-flex items-center space-x-2 bg-gold-500 hover:bg-gold-400 text-luxury-950 px-3.5 py-1.5 text-xs font-sans font-bold transition-all rounded-sm uppercase cursor-pointer"
                                >
                                  <Upload size={12} />
                                  <span>Choose Logo File</span>
                                </button>
                                <input
                                  type="file" accept={ACCEPTED_IMAGE_TYPES}
                                  ref={logoFileRef}

                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleImageUpload(file, (base64) => {
                                        updateLogo({ customImage: base64 });
                                        triggerSuccess("Custom logo graphic uploaded successfully.");
                                      });
                                    }
                                  }}
                                  className="hidden"
                                />
                                <span className="basis-full text-[8px] tracking-wider text-luxury-500 font-sans uppercase">
                                  {ACCEPTED_IMAGE_GUIDANCE}
                                </span>
                                {logo.customImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateLogo({ customImage: "" });
                                      triggerSuccess("Reverted to typography and badge based logo.");
                                    }}
                                    className="bg-luxury-800 hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/50 text-luxury-300 border border-luxury-700 text-[10px] uppercase font-sans tracking-wider px-2.5 py-1.5 rounded transition-all cursor-pointer"
                                  >
                                    Use Default Typography
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Direct URL paste */}
                            <div className="space-y-2">
                              <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block">
                                Or Paste Logo URL
                              </label>
                              <input
                                type="text"
                                placeholder="https://example.com/logo.png"
                                value={logo.customImage || ""}
                                onChange={(e) => {
                                  updateLogo({ customImage: e.target.value });
                                }}
                                className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                              />
                            </div>
                          </div>

                          {logo.customImage && (
                            <div className="pt-2 border-t border-luxury-900/50 space-y-1">
                              <div className="flex justify-between items-center text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
                                <span>Custom Logo Image Height</span>
                                <span className="text-gold-300 font-mono">{logo.imageHeightPx || 32}px</span>
                              </div>
                              <input
                                type="range"
                                min={16}
                                max={120}
                                step={1}
                                value={logo.imageHeightPx || 32}
                                onChange={(e) => updateLogo({ imageHeightPx: parseInt(e.target.value) })}
                                className="w-full accent-gold-300 bg-luxury-900 h-1.5 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          )}
                        </div>

                        {/* Sliders and text fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Logo Name Text
                            </label>
                            <input
                              type="text"
                              value={logo.text}
                              onChange={(e) => updateLogo({ text: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none uppercase"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Logo Icon Badge Letter
                            </label>
                            <input
                              type="text"
                              maxLength={2}
                              value={logo.letter}
                              onChange={(e) => updateLogo({ letter: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none uppercase text-center"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
                              <span>Logo Name Size</span>
                              <span className="text-gold-300 font-mono">{logo.sizePx}px</span>
                            </div>
                            <input
                              type="range"
                              min={12}
                              max={48}
                              step={1}
                              value={logo.sizePx}
                              onChange={(e) => updateLogo({ sizePx: parseInt(e.target.value) })}
                              className="w-full accent-gold-300 bg-luxury-900 h-1.5 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
                              <span>Icon Badge Circle Size</span>
                              <span className="text-gold-300 font-mono">{logo.letterSizePx}px</span>
                            </div>
                            <input
                              type="range"
                              min={20}
                              max={72}
                              step={1}
                              value={logo.letterSizePx}
                              onChange={(e) => updateLogo({ letterSizePx: parseInt(e.target.value) })}
                              className="w-full accent-gold-300 bg-luxury-900 h-1.5 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Export/Download Actions */}
                        <div className="pt-4 border-t border-luxury-900 space-y-3">
                          <span className="text-[10px] tracking-widest text-luxury-400 font-sans uppercase font-bold block">
                            Export Logo for Media Assets
                          </span>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={handleDownloadSVG}
                              className="inline-flex items-center space-x-2 bg-luxury-900 border border-gold-500/20 hover:border-gold-400 text-gold-300 hover:bg-gold-500/10 px-4 py-2 text-xs transition-all rounded-sm cursor-pointer"
                            >
                              <Download size={13} />
                              <span>Download Vector SVG</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadPNG}
                              className="inline-flex items-center space-x-2 bg-luxury-900 border border-luxury-800 hover:border-luxury-700 text-luxury-200 hover:bg-luxury-850 px-4 py-2 text-xs transition-all rounded-sm cursor-pointer"
                            >
                              <Download size={13} />
                              <span>Download High-Res PNG</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* -------------------- TAB: HEADER & FOOTER -------------------- */}
                  {activeTab === "header_footer" && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-1">
                          Header & Footer Configuration
                        </h3>
                        <p className="text-xs text-luxury-400 font-sans font-light">
                          Manage top and bottom utility items, button CTA text, resort email contacts, physical coordinates, and copyright statements.
                        </p>
                      </div>

                      {/* Header Settings */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4 text-left">
                        <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                          Header Config
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Booking CTA Button Text
                            </label>
                            <input
                              type="text"
                              value={header.bookButtonText}
                              onChange={(e) => updateHeader({ bookButtonText: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none uppercase"
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block">
                              Navigation Links Order
                            </label>
                            {header.links.map((link, idx) => (
                              <div key={idx} className="flex space-x-2 items-center">
                                <span className="text-[10px] font-mono text-luxury-500 w-4">#{idx+1}</span>
                                <input
                                  type="text"
                                  value={link.label}
                                  onChange={(e) => {
                                    const updated = [...header.links];
                                    updated[idx] = { ...updated[idx], label: e.target.value.toUpperCase() };
                                    updateHeader({ links: updated });
                                  }}
                                  className="bg-luxury-900 border border-luxury-800 text-xs py-1 px-2.5 rounded text-luxury-100 focus:outline-none focus:border-gold-300 flex-1"
                                />
                                <span className="text-[10px] font-mono text-luxury-600 bg-luxury-950 px-2 py-1 rounded">
                                  ID: {link.id}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Footer Brand Copy */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4 text-left">
                        <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                          Footer Brand & Description
                        </h4>

                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Resort Description Paragraph
                            </label>
                            <textarea
                              rows={3}
                              value={footer.brandText}
                              onChange={(e) => updateFooter({ brandText: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-2 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Contacts and Locations */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4 text-left">
                        <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                          Footer Address & Concierge Contacts
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Location Line 1
                            </label>
                            <input
                              type="text"
                              value={footer.location1}
                              onChange={(e) => updateFooter({ location1: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Location Line 2
                            </label>
                            <input
                              type="text"
                              value={footer.location2}
                              onChange={(e) => updateFooter({ location2: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Concierge Email Address
                            </label>
                            <input
                              type="email"
                              value={footer.email}
                              onChange={(e) => updateFooter({ email: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Trust Details */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4 text-left">
                        <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                          SSL & Trust Seals copy
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Trust Section Title
                            </label>
                            <input
                              type="text"
                              value={footer.trustTitle}
                              onChange={(e) => updateFooter({ trustTitle: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none uppercase"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Badge Headline
                            </label>
                            <input
                              type="text"
                              value={footer.trustBadge}
                              onChange={(e) => updateFooter({ trustBadge: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Security Description paragraph
                            </label>
                            <textarea
                              rows={2}
                              value={footer.trustDescription}
                              onChange={(e) => updateFooter({ trustDescription: e.target.value })}
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Legalities */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4 text-left">
                        <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                          Footer Copyright Label
                        </h4>

                        <div>
                          <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                            Copyright string
                          </label>
                          <input
                            type="text"
                            value={footer.copyright}
                            onChange={(e) => updateFooter({ copyright: e.target.value })}
                            className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Footer Social Media Links */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4 text-left">
                        <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                          Footer Social Media Links
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Instagram URL
                            </label>
                            <input
                              type="text"
                              value={footer.instagramUrl || ""}
                              onChange={(e) => updateFooter({ instagramUrl: e.target.value })}
                              placeholder="https://instagram.com/..."
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              Facebook URL
                            </label>
                            <input
                              type="text"
                              value={footer.facebookUrl || ""}
                              onChange={(e) => updateFooter({ facebookUrl: e.target.value })}
                              placeholder="https://facebook.com/..."
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                              TikTok URL
                            </label>
                            <input
                              type="text"
                              value={footer.tiktokUrl || ""}
                              onChange={(e) => updateFooter({ tiktokUrl: e.target.value })}
                              placeholder="https://tiktok.com/..."
                              className="w-full bg-luxury-900 border border-luxury-800 focus:border-gold-300 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* -------------------- TAB: GALLERY IMAGES -------------------- */}
                  {activeTab === "gallery" && (
                    <div className="space-y-8 text-left">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-1">
                            Visual Journal (Gallery)
                          </h3>
                          <p className="text-xs text-luxury-400 font-sans font-light">
                            Add, update details, or delete imagery from the masonry 'Island Perspectives' layout. Upload custom files as database values.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGalleryId("new");
                            setNewGalleryItem({
                              src: "",
                              title: "",
                              location: "",
                              description: "",
                              category: "Nature"
                            });
                          }}
                          className="inline-flex items-center space-x-1.5 bg-gold-500 hover:bg-gold-400 text-luxury-950 px-3.5 py-1.5 text-xs font-sans font-bold transition-all rounded-sm uppercase cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Add New Image</span>
                        </button>
                      </div>

                      {/* FORM: New / Edit Gallery Frame Overlay */}
                      {editingGalleryId !== null && (
                        <div className="bg-luxury-950 border-2 border-gold-500/30 p-6 rounded-sm space-y-4 relative">
                          <button
                            onClick={() => setEditingGalleryId(null)}
                            className="absolute top-4 right-4 text-luxury-400 hover:text-white"
                          >
                            <X size={16} />
                          </button>

                          <h4 className="text-xs tracking-widest text-gold-300 font-sans uppercase font-bold">
                            {editingGalleryId === "new" ? "Add New Journal Item" : "Edit Journal Item Details"}
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Current / Upload file image */}
                            <div className="space-y-3">
                              <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block">
                                Frame Image
                              </label>
                              <div className="aspect-[4/3] bg-luxury-900 border border-luxury-800 rounded-sm overflow-hidden relative flex items-center justify-center">
                                {((editingGalleryId === "new" ? newGalleryItem.src : galleryItems.find(g => g.id === editingGalleryId)?.src)) ? (
                                  <img
                                    src={editingGalleryId === "new" ? newGalleryItem.src : galleryItems.find(g => g.id === editingGalleryId)?.src}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="text-center p-4">
                                    <ImageIcon size={32} className="mx-auto text-luxury-600 mb-2" />
                                    <span className="text-[10px] text-luxury-500 font-sans uppercase">No Image Loaded</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => editingGalleryId === "new" ? newGalleryFileRef.current?.click() : editGalleryFileRef.current?.click()}
                                  className="bg-luxury-900 hover:bg-luxury-850 text-[10px] tracking-wider font-sans uppercase px-3 py-1.5 border border-luxury-800 rounded text-luxury-200 cursor-pointer w-full flex justify-center items-center space-x-1"
                                >
                                  <Upload size={10} />
                                  <span>Choose File</span>
                                </button>
                                <input
                                  type="file" accept={ACCEPTED_IMAGE_TYPES}
                                  ref={editingGalleryId === "new" ? newGalleryFileRef : editGalleryFileRef}

                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleImageUpload(file, (base64) => {
                                        if (editingGalleryId === "new") {
                                          setNewGalleryItem(prev => ({ ...prev, src: base64 }));
                                        } else {
                                          updateGalleryItem(editingGalleryId, { src: base64 });
                                        }
                                        triggerSuccess("Frame image file parsed successfully.");
                                      });
                                    }
                                  }}
                                  className="hidden"
                                />
                              </div>

                              <p className="text-[9px] tracking-wider text-luxury-500 font-sans uppercase">
                                {ACCEPTED_IMAGE_GUIDANCE}
                              </p>

                              <div>
                                <label className="text-[9px] tracking-wider text-luxury-500 font-sans uppercase block mb-1">
                                  Or Paste Image Web URL
                                </label>
                                <input
                                  type="text"
                                  placeholder="https://images.unsplash.com/..."
                                  value={editingGalleryId === "new" ? newGalleryItem.src : galleryItems.find(g => g.id === editingGalleryId)?.src || ""}
                                  onChange={(e) => {
                                    if (editingGalleryId === "new") {
                                      setNewGalleryItem(prev => ({ ...prev, src: e.target.value }));
                                    } else {
                                      updateGalleryItem(editingGalleryId, { src: e.target.value });
                                    }
                                  }}
                                  className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Details Inputs */}
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                  Image Headline Title
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Endless Pathways"
                                  value={editingGalleryId === "new" ? newGalleryItem.title : galleryItems.find(g => g.id === editingGalleryId)?.title || ""}
                                  onChange={(e) => {
                                    if (editingGalleryId === "new") {
                                      setNewGalleryItem(prev => ({ ...prev, title: e.target.value }));
                                    } else {
                                      updateGalleryItem(editingGalleryId, { title: e.target.value });
                                    }
                                  }}
                                  className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                  Resort/Island Location Tag
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. San Vicente, Palawan"
                                  value={editingGalleryId === "new" ? newGalleryItem.location : galleryItems.find(g => g.id === editingGalleryId)?.location || ""}
                                  onChange={(e) => {
                                    if (editingGalleryId === "new") {
                                      setNewGalleryItem(prev => ({ ...prev, location: e.target.value }));
                                    } else {
                                      updateGalleryItem(editingGalleryId, { location: e.target.value });
                                    }
                                  }}
                                  className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                    Category
                                  </label>
                                  <select
                                    value={editingGalleryId === "new" ? newGalleryItem.category : galleryItems.find(g => g.id === editingGalleryId)?.category || "Nature"}
                                    onChange={(e) => {
                                      if (editingGalleryId === "new") {
                                        setNewGalleryItem(prev => ({ ...prev, category: e.target.value }));
                                      } else {
                                        updateGalleryItem(editingGalleryId, { category: e.target.value });
                                      }
                                    }}
                                    className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-2 text-xs text-luxury-100 rounded focus:outline-none"
                                  >
                                    <option value="Nature">Nature</option>
                                    <option value="Resort">Resort</option>
                                    <option value="Surf">Surf</option>
                                    <option value="Sanctuary">Sanctuary</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                  Visual Description Paragraph
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="Describe the mood, color palette, or visual story..."
                                  value={editingGalleryId === "new" ? newGalleryItem.description : galleryItems.find(g => g.id === editingGalleryId)?.description || ""}
                                  onChange={(e) => {
                                    if (editingGalleryId === "new") {
                                      setNewGalleryItem(prev => ({ ...prev, description: e.target.value }));
                                    } else {
                                      updateGalleryItem(editingGalleryId, { description: e.target.value });
                                    }
                                  }}
                                  className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans"
                                />
                              </div>

                              <div className="pt-2 flex justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingGalleryId(null)}
                                  className="px-4 py-1.5 text-xs font-sans text-luxury-400 hover:text-white"
                                >
                                  Close Editor
                                </button>
                                {editingGalleryId === "new" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!newGalleryItem.src || !newGalleryItem.title) {
                                        alert("Please enter a title and select/input an image.");
                                        return;
                                      }
                                      addGalleryItem(newGalleryItem);
                                      setEditingGalleryId(null);
                                      triggerSuccess("Successfully added new visual frame to the gallery.");
                                    }}
                                    className="bg-gold-500 text-luxury-950 font-sans font-bold text-xs uppercase px-4 py-1.5 rounded-sm cursor-pointer"
                                  >
                                    Save New Frame
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Active Gallery Items Grid list */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {galleryItems.map((item) => (
                          <div key={item.id} className="bg-luxury-950 border border-luxury-900 p-4 flex space-x-4 items-center rounded-sm">
                            <div className="w-16 h-16 bg-luxury-900 rounded overflow-hidden flex-shrink-0 border border-luxury-800">
                              <img src={item.src} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-serif text-luxury-100 uppercase truncate">{item.title}</h5>
                              <p className="text-[10px] text-gold-400 font-sans tracking-wide truncate">{item.location}</p>
                              <span className="text-[9px] uppercase font-sans text-luxury-500 block">{item.category}</span>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingGalleryId(item.id)}
                                className="p-1.5 text-luxury-400 hover:text-gold-500 bg-luxury-900 rounded-full cursor-pointer"
                                title="Edit properties"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete ${item.title}?`)) {
                                    deleteGalleryItem(item.id);
                                    triggerSuccess("Successfully removed gallery item.");
                                  }
                                }}
                                className="p-1.5 text-luxury-400 hover:text-red-400 bg-luxury-900 rounded-full cursor-pointer"
                                title="Delete item"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* -------------------- TAB: ROOMS & ACTIVITIES -------------------- */}
                  {activeTab === "rooms_activities" && (
                    <div className="space-y-8 text-left">
                      <div>
                        <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-1">
                          Resort Suites & Activities
                        </h3>
                        <p className="text-xs text-luxury-400 font-sans font-light">
                          Manage descriptions, nightly rates, room features, active adventure packages, and primary images (including device upload) across our bookable sanctuaries.
                        </p>
                      </div>

                      {/* SECTION: ROOMS */}
                      <div className="space-y-6">
                        <div className="border-b border-luxury-900 pb-2 flex justify-between items-center">
                          <h4 className="text-sm tracking-widest text-gold-300 font-sans uppercase font-bold">
                            Sanctuary Rooms / Suites
                          </h4>
                          <button
                            type="button"
                            onClick={handleCreateNewRoom}
                            className="inline-flex items-center space-x-1 bg-gold-500 hover:bg-gold-400 text-luxury-950 px-2.5 py-1 text-xs font-sans font-bold transition-all rounded-sm uppercase cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>Add New Villa</span>
                          </button>
                        </div>

                        <div className="space-y-4">
                          {rooms.map((room) => (
                            <div key={room.id} className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-luxury-900 rounded overflow-hidden border border-luxury-800 flex-shrink-0 flex items-center justify-center">
                                    {isVideo(room.imageUrl) ? (
                                      <video src={room.imageUrl} className="w-full h-full object-cover" muted />
                                    ) : (
                                      <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-serif text-luxury-100 uppercase font-bold">{room.name}</h5>
                                    <p className="text-[10px] text-gold-400 font-sans">${room.pricePerNight} / Night // {room.size} // {room.capacity}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingRoomId(editingRoomId === room.id ? null : room.id)}
                                    className="text-[10px] tracking-widest font-sans uppercase bg-luxury-900 text-luxury-300 hover:text-white px-3 py-1.5 rounded cursor-pointer flex items-center space-x-1"
                                  >
                                    <span>{editingRoomId === room.id ? "Close Editor" : "Edit Assets"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to permanently delete ${room.name}?`)) {
                                        deleteRoom(room.id);
                                        triggerSuccess(`Successfully deleted ${room.name}.`);
                                      }
                                    }}
                                    className="p-1.5 text-luxury-400 hover:text-red-400 bg-luxury-900 rounded hover:bg-luxury-850 transition-colors cursor-pointer"
                                    title="Delete Villa"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {editingRoomId === room.id && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-luxury-900">
                                  {/* Left: Info */}
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                        Room Name Title
                                      </label>
                                      <input
                                        type="text"
                                        value={room.name}
                                        onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                                        className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                                      />
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                          Price Per Night ($)
                                        </label>
                                        <input
                                          type="number"
                                          value={room.pricePerNight}
                                          onChange={(e) => updateRoom(room.id, { pricePerNight: parseInt(e.target.value) || 0 })}
                                          className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-2 text-xs text-luxury-100 rounded focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                          Room Size
                                        </label>
                                        <input
                                          type="text"
                                          value={room.size}
                                          onChange={(e) => updateRoom(room.id, { size: e.target.value })}
                                          className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-2 text-xs text-luxury-100 rounded focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                          Max Capacity
                                        </label>
                                        <input
                                          type="text"
                                          value={room.capacity}
                                          onChange={(e) => updateRoom(room.id, { capacity: e.target.value })}
                                          className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-2 text-xs text-luxury-100 rounded focus:outline-none"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                        Suite Description Paragraph
                                      </label>
                                      <textarea
                                        rows={3}
                                        value={room.description}
                                        onChange={(e) => updateRoom(room.id, { description: e.target.value })}
                                        className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans"
                                      />
                                    </div>
                                  </div>

                                  {/* Right: Image file upload & tags */}
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                        Featured Image Source
                                      </label>
                                      <div className="flex gap-2 mb-2">
                                        <button
                                          type="button"
                                          onClick={() => roomFileRefs.current[room.id]?.click()}
                                          className="bg-luxury-900 hover:bg-luxury-850 text-[10px] tracking-wider font-sans uppercase px-3 py-1.5 border border-luxury-800 rounded text-luxury-200 cursor-pointer w-full flex justify-center items-center space-x-1"
                                        >
                                          <Upload size={10} />
                                          <span>Choose New File</span>
                                        </button>
                                        <input
                                          type="file" accept={ACCEPTED_IMAGE_TYPES}
                                          ref={(el) => { roomFileRefs.current[room.id] = el; }}

                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              handleImageUpload(file, (base64) => {
                                                const currentImages = room.images || [room.imageUrl];
                                                updateRoom(room.id, { 
                                                  imageUrl: base64,
                                                  images: currentImages[0] === room.imageUrl ? [base64, ...currentImages.slice(1)] : [base64, ...currentImages]
                                                });
                                                triggerSuccess(`Room main image updated for ${room.name}.`);
                                              });
                                            }
                                          }}
                                          className="hidden"
                                        />
                                      </div>
                                      <p className="mb-2 text-[9px] tracking-wider text-luxury-500 font-sans uppercase">
                                        {ACCEPTED_IMAGE_GUIDANCE}
                                      </p>
                                      <input
                                        type="text"
                                        value={room.imageUrl}
                                        onChange={(e) => {
                                          const baseVal = e.target.value;
                                          const currentImages = room.images || [room.imageUrl];
                                          updateRoom(room.id, { 
                                            imageUrl: baseVal,
                                            images: currentImages[0] === room.imageUrl ? [baseVal, ...currentImages.slice(1)] : [baseVal, ...currentImages]
                                          });
                                        }}
                                        className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                        Amenity Tags (Comma separated)
                                      </label>
                                      <input
                                        type="text"
                                        value={room.amenities.join(", ")}
                                        onChange={(e) => {
                                          const tags = e.target.value.split(",").map(t => t.trim()).filter(t => t !== "");
                                          updateRoom(room.id, { amenities: tags });
                                        }}
                                        className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                                      />
                                    </div>
                                  </div>

                                  {/* Bottom: Slideshow Media Manager */}
                                  <div className="md:col-span-2 pt-4 border-t border-luxury-900 space-y-4">
                                    <div className="flex justify-between items-center">
                                      <label className="text-[10px] tracking-wider text-gold-300 font-sans uppercase block font-bold">
                                        Villa Slideshow Media ({room.images?.length || 1} items)
                                      </label>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => roomAddMediaFileRefs.current[room.id]?.click()}
                                          className="bg-gold-500 hover:bg-gold-400 text-luxury-950 text-[10px] tracking-wider font-sans uppercase font-bold px-3 py-1.5 rounded-sm flex items-center space-x-1 cursor-pointer"
                                        >
                                          <Plus size={10} />
                                          <span>Upload Image</span>
                                        </button>
                                        <input
                                          type="file" accept={ACCEPTED_IMAGE_TYPES}
                                          ref={(el) => { roomAddMediaFileRefs.current[room.id] = el; }}

                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              handleImageUpload(file, (base64) => {
                                                const currentImages = room.images || [room.imageUrl];
                                                updateRoom(room.id, { images: [...currentImages, base64] });
                                                triggerSuccess("New media file uploaded and added to villa slideshow.");
                                              });
                                            }
                                          }}
                                          className="hidden"
                                        />
                                      </div>
                                    </div>
                                    <p className="text-[9px] tracking-wider text-luxury-500 font-sans uppercase">
                                      {ACCEPTED_IMAGE_GUIDANCE}
                                    </p>

                                    {/* Display slides grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                      {(room.images && room.images.length > 0 ? room.images : [room.imageUrl]).map((media, mIdx) => (
                                        <div key={mIdx} className="bg-luxury-900 border border-luxury-800 p-2 rounded-sm space-y-2 relative group/item">
                                          <div className="aspect-[4/3] bg-black rounded overflow-hidden flex items-center justify-center relative">
                                            {isVideo(media) ? (
                                              <video src={media} className="w-full h-full object-cover" muted />
                                            ) : (
                                              <img src={media} alt={`slide-${mIdx}`} className="w-full h-full object-cover" />
                                            )}
                                            
                                            {/* Delete slide button */}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const currentImages = room.images && room.images.length > 0 ? [...room.images] : [room.imageUrl];
                                                if (currentImages.length <= 1) {
                                                  alert("Each villa must have at least one media slide.");
                                                  return;
                                                }
                                                const updated = currentImages.filter((_, i) => i !== mIdx);
                                                const updateObj: Partial<RoomTier> = { images: updated };
                                                if (mIdx === 0 && updated.length > 0) {
                                                  updateObj.imageUrl = updated[0];
                                                }
                                                updateRoom(room.id, updateObj);
                                                triggerSuccess("Slide deleted from slideshow.");
                                              }}
                                              className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-red-500 text-white rounded-full transition-all opacity-0 group-hover/item:opacity-100 cursor-pointer"
                                              title="Delete slide"
                                            >
                                              <X size={10} />
                                            </button>
                                          </div>
                                          <div className="text-[9px] font-mono text-luxury-400 truncate px-1">
                                            {isVideo(media) ? "Video File/URL" : "Image File/URL"}
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Paste media URL */}
                                    <div className="flex gap-2 items-center">
                                      <input
                                        type="text"
                                        placeholder="Or paste any Web Image/Video URL and press Enter..."
                                        id={`paste-url-${room.id}`}
                                        className="bg-luxury-900 border border-luxury-800 text-xs py-1.5 px-3 rounded text-luxury-100 focus:outline-none flex-1"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            const inputEl = e.currentTarget as HTMLInputElement;
                                            const url = inputEl.value.trim();
                                            if (url) {
                                              const currentImages = room.images || [room.imageUrl];
                                              updateRoom(room.id, { images: [...currentImages, url] });
                                              inputEl.value = "";
                                              triggerSuccess("Web media URL added to villa slideshow.");
                                            }
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const inputEl = document.getElementById(`paste-url-${room.id}`) as HTMLInputElement;
                                          const url = inputEl?.value.trim();
                                          if (url) {
                                            const currentImages = room.images || [room.imageUrl];
                                            updateRoom(room.id, { images: [...currentImages, url] });
                                            inputEl.value = "";
                                            triggerSuccess("Web media URL added to villa slideshow.");
                                          }
                                        }}
                                        className="bg-luxury-800 hover:bg-luxury-700 text-luxury-200 text-xs px-3 py-1.5 rounded transition-all cursor-pointer shrink-0"
                                      >
                                        Add URL
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SECTION: ACTIVITIES */}
                      <div className="space-y-6 pt-4 border-t border-luxury-900/40">
                        <div className="border-b border-luxury-900 pb-2">
                          <h4 className="text-sm tracking-widest text-gold-300 font-sans uppercase font-bold">
                            Curated Adventure Activities
                          </h4>
                        </div>

                        <div className="space-y-4">
                          {activities.map((act) => (
                            <div key={act.id} className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-luxury-900 rounded overflow-hidden border border-luxury-800 flex-shrink-0">
                                    <img src={act.imageUrl} alt={act.title} className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-serif text-luxury-100 uppercase font-bold">{act.title}</h5>
                                    <p className="text-[10px] text-gold-400 font-sans">{act.category} // {act.duration} // {act.price}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingActivityId(editingActivityId === act.id ? null : act.id)}
                                  className="text-[10px] tracking-widest font-sans uppercase bg-luxury-900 text-luxury-300 hover:text-white px-3 py-1.5 rounded cursor-pointer flex items-center space-x-1"
                                >
                                  <span>{editingActivityId === act.id ? "Close Editor" : "Edit Assets"}</span>
                                </button>
                              </div>

                              {editingActivityId === act.id && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-luxury-900">
                                  {/* Info fields */}
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                        Activity Title
                                      </label>
                                      <input
                                        type="text"
                                        value={act.title}
                                        onChange={(e) => updateActivity(act.id, { title: e.target.value })}
                                        className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                          Duration
                                        </label>
                                        <input
                                          type="text"
                                          value={act.duration}
                                          onChange={(e) => updateActivity(act.id, { duration: e.target.value })}
                                          className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-2 text-xs text-luxury-100 rounded focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                          Price Label
                                        </label>
                                        <input
                                          type="text"
                                          value={act.price}
                                          onChange={(e) => updateActivity(act.id, { price: e.target.value })}
                                          className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-2 text-xs text-luxury-100 rounded focus:outline-none"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                        Activity description paragraph
                                      </label>
                                      <textarea
                                        rows={2}
                                        value={act.description}
                                        onChange={(e) => updateActivity(act.id, { description: e.target.value })}
                                        className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none font-sans"
                                      />
                                    </div>
                                  </div>

                                  {/* Right side upload */}
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                        Activity Image Source
                                      </label>
                                      <div className="flex gap-2 mb-2">
                                        <button
                                          type="button"
                                          onClick={() => activityFileRefs.current[act.id]?.click()}
                                          className="bg-luxury-900 hover:bg-luxury-850 text-[10px] tracking-wider font-sans uppercase px-3 py-1.5 border border-luxury-800 rounded text-luxury-200 cursor-pointer w-full flex justify-center items-center space-x-1"
                                        >
                                          <Upload size={10} />
                                          <span>Choose New File</span>
                                        </button>
                                        <input
                                          type="file" accept={ACCEPTED_IMAGE_TYPES}
                                          ref={(el) => { activityFileRefs.current[act.id] = el; }}

                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              handleImageUpload(file, (base64) => {
                                                updateActivity(act.id, { imageUrl: base64 });
                                                triggerSuccess(`Activity image updated for ${act.title}.`);
                                              });
                                            }
                                          }}
                                          className="hidden"
                                        />
                                      </div>
                                      <p className="mb-2 text-[9px] tracking-wider text-luxury-500 font-sans uppercase">
                                        {ACCEPTED_IMAGE_GUIDANCE}
                                      </p>
                                      <input
                                        type="text"
                                        value={act.imageUrl}
                                        onChange={(e) => updateActivity(act.id, { imageUrl: e.target.value })}
                                        className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-3 text-xs text-luxury-100 rounded focus:outline-none"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                          Difficulty Category
                                        </label>
                                        <input
                                          type="text"
                                          value={act.difficulty}
                                          onChange={(e) => updateActivity(act.id, { difficulty: e.target.value as "Easy" | "Medium" | "Challenging" })}
                                          className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-2 text-xs text-luxury-100 rounded focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] tracking-wider text-luxury-400 font-sans uppercase block mb-1">
                                          Categorization
                                        </label>
                                        <input
                                          type="text"
                                          value={act.category}
                                          onChange={(e) => updateActivity(act.id, { category: e.target.value })}
                                          className="w-full bg-luxury-900 border border-luxury-800 py-1.5 px-2 text-xs text-luxury-100 rounded focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* -------------------- TAB: THEME & PALETTE -------------------- */}
                  {activeTab === "theme_colors" && (
                    <div className="space-y-8 text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-luxury-900 pb-4">
                        <div>
                          <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-1">
                            Site Typography & Palette Configurator
                          </h3>
                          <p className="text-xs text-luxury-400 font-sans font-light">
                            Craft a cohesive, responsive visual style by matching curated professional typefaces and responsive color palettes. Changes update in real-time.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to reset all typography and colors back to the original design?")) {
                              updateTheme(DEFAULT_THEME);
                              triggerSuccess("Typography and color palette reset to original defaults.");
                            }
                          }}
                          className="flex items-center space-x-2 border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-400 px-4 py-2 rounded text-xs tracking-wider uppercase font-sans font-medium transition-all self-start sm:self-center cursor-pointer"
                        >
                          <RefreshCw size={13} />
                          <span>Reset to Original</span>
                        </button>
                      </div>

                      {/* Section 1: Typography */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-6">
                        <div className="flex items-center space-x-2 text-gold-300">
                          <Sliders size={16} />
                          <h4 className="text-sm font-sans font-bold uppercase tracking-wider">
                            Designer Font Pairings
                          </h4>
                        </div>

                        {/* Uniform Checkbox */}
                        <div className="bg-luxury-900/50 p-4 border border-luxury-900 rounded-sm">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                theme.heroFont === theme.sectionsFont &&
                                theme.heroFont === theme.headerFont &&
                                theme.heroFont === theme.footerFont
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  // Set all to current sections font as base uniform
                                  updateTheme({
                                    heroFont: theme.sectionsFont,
                                    headerFont: theme.sectionsFont,
                                    footerFont: theme.sectionsFont
                                  });
                                  triggerSuccess("Site-wide uniform typography enabled.");
                                }
                              }}
                              className="w-4 h-4 bg-luxury-950 border-luxury-800 rounded focus:ring-0 focus:ring-offset-0 text-gold-500 cursor-pointer"
                            />
                            <div>
                              <span className="text-xs font-sans font-bold text-luxury-100 uppercase tracking-wider">
                                Apply Uniform Font across entire site
                              </span>
                              <p className="text-[10px] text-luxury-400 font-sans mt-0.5">
                                Automatically synchronize hero, headers, sections, and footers with a single unified typeface.
                              </p>
                            </div>
                          </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(() => {
                            const isUniform = 
                              theme.heroFont === theme.sectionsFont &&
                              theme.heroFont === theme.headerFont &&
                              theme.heroFont === theme.footerFont;

                            const fonts = [
                              { id: "Inter", name: "Inter", desc: "Modern Swiss Neo-Grotesque", style: "sans-serif" },
                              { id: "Cormorant Garamond", name: "Cormorant Garamond", desc: "Luxurious Display Editorial", style: "serif" },
                              { id: "Satoshi", name: "Satoshi", desc: "Neo-Grotesque modernist typeface", style: "sans-serif" },
                              { id: "Plus Jakarta Sans", name: "Plus Jakarta Sans", desc: "Warm and friendly geometric sans", style: "sans-serif" },
                              { id: "Outfit", name: "Outfit", desc: "Sleek geometric display curves", style: "sans-serif" },
                              { id: "DM Sans", name: "DM Sans", desc: "Low-contrast premium body sans", style: "sans-serif" },
                              { id: "Playfair Display", name: "Playfair Display", desc: "High-contrast luxury display serif", style: "serif" },
                              { id: "Cinzel", name: "Cinzel", desc: "Classical monument Roman serif", style: "serif" },
                              { id: "Fraunces", name: "Fraunces", desc: "Organic, warm Display Serif", style: "serif" },
                              { id: "Italiana", name: "Italiana", desc: "Delicate Italian calligraphy serif", style: "serif" },
                              { id: "Bodoni Moda", name: "Bodoni Moda", desc: "Didone-style high-end luxury fashion", style: "serif" },
                              { id: "Space Grotesk", name: "Space Grotesk", desc: "Tech-forward geometric display", style: "sans-serif" },
                              { id: "Montserrat", name: "Montserrat", desc: "Bold classic geometric display", style: "sans-serif" },
                              { id: "Unbounded", name: "Unbounded", desc: "Premium bold streetwear geometric", style: "sans-serif" }
                            ];

                            return (
                              <>
                                {/* Selector 1: All sections or Unified Font */}
                                <div className="space-y-2">
                                  <label className="text-[10px] tracking-widest text-gold-300 font-sans font-bold uppercase block">
                                    {isUniform ? "Unified Global Font" : "General Sections & Body Font"}
                                  </label>
                                  <select
                                    value={theme.sectionsFont}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (isUniform) {
                                        updateTheme({
                                          heroFont: val,
                                          sectionsFont: val,
                                          headerFont: val,
                                          footerFont: val
                                        });
                                      } else {
                                        updateTheme({ sectionsFont: val });
                                      }
                                      triggerSuccess(`Sections font set to "${val}"`);
                                    }}
                                    className="w-full bg-luxury-900 border border-luxury-800 text-luxury-100 py-2.5 px-3 rounded text-xs focus:outline-none"
                                  >
                                    {fonts.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.name} ({f.desc})
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-luxury-500 leading-relaxed font-sans font-light">
                                    Applied to body copy, room details, descriptions, and dynamic inputs.
                                  </p>
                                </div>

                                {/* Selector 2: Hero Font */}
                                <div className="space-y-2">
                                  <label className="text-[10px] tracking-widest text-gold-300 font-sans font-bold uppercase block">
                                    Hero & Section Titles Font
                                  </label>
                                  <select
                                    value={theme.heroFont}
                                    disabled={isUniform}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({ heroFont: val });
                                      triggerSuccess(`Hero titles font set to "${val}"`);
                                    }}
                                    className={`w-full bg-luxury-900 border border-luxury-800 text-luxury-100 py-2.5 px-3 rounded text-xs focus:outline-none ${
                                      isUniform ? "opacity-40 cursor-not-allowed" : ""
                                    }`}
                                  >
                                    {fonts.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.name} ({f.desc})
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-luxury-500 leading-relaxed font-sans font-light">
                                    Used for prominent display titles, including Hero titles and category headers.
                                  </p>
                                </div>

                                {/* Selector 3: Header Font */}
                                <div className="space-y-2">
                                  <label className="text-[10px] tracking-widest text-gold-300 font-sans font-bold uppercase block">
                                    Header & Navbar Links Font
                                  </label>
                                  <select
                                    value={theme.headerFont}
                                    disabled={isUniform}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({ headerFont: val });
                                      triggerSuccess(`Header font set to "${val}"`);
                                    }}
                                    className={`w-full bg-luxury-900 border border-luxury-800 text-luxury-100 py-2.5 px-3 rounded text-xs focus:outline-none ${
                                      isUniform ? "opacity-40 cursor-not-allowed" : ""
                                    }`}
                                  >
                                    {fonts.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.name} ({f.desc})
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-luxury-500 leading-relaxed font-sans font-light">
                                    Controls typography inside the navigation bar, logo label, and booking button.
                                  </p>
                                </div>

                                {/* Selector 4: Footer Font */}
                                <div className="space-y-2">
                                  <label className="text-[10px] tracking-widest text-gold-300 font-sans font-bold uppercase block">
                                    Footer & Trust Badge Font
                                  </label>
                                  <select
                                    value={theme.footerFont}
                                    disabled={isUniform}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({ footerFont: val });
                                      triggerSuccess(`Footer font set to "${val}"`);
                                    }}
                                    className={`w-full bg-luxury-900 border border-luxury-800 text-luxury-100 py-2.5 px-3 rounded text-xs focus:outline-none ${
                                      isUniform ? "opacity-40 cursor-not-allowed" : ""
                                    }`}
                                  >
                                    {fonts.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.name} ({f.desc})
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-luxury-500 leading-relaxed font-sans font-light">
                                    Overrides font styling inside footer blocks, contact lists, and trust credentials.
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Section 2: Color Palette */}
                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-6">
                        <div className="flex items-center space-x-2 text-gold-300">
                          <Palette size={16} />
                          <h4 className="text-sm font-sans font-bold uppercase tracking-wider">
                            Resort Color Palette
                          </h4>
                        </div>

                        {/* Presets Grid */}
                        <div className="space-y-3">
                          <label className="text-[10px] tracking-widest text-gold-300 font-sans font-bold uppercase block">
                            Curated Designer Color Presets
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {[
                              { id: "warm_gold", name: "Warm Gold", desc: "Barefoot luxury default", primary: "#5a5a40", bg: "#f9f8f6" },
                              { id: "silent_indigo", name: "Silent Indigo", desc: "Deep oceanic twilight", primary: "#2b4c7e", bg: "#f8fafc" },
                              { id: "forest_retreat", name: "Forest Canopy", desc: "Organic Teak & Sage", primary: "#3f5e4d", bg: "#f6f9f7" },
                              { id: "sand_charcoal", name: "Minimal Sand", desc: "Monochrome luxury", primary: "#1c1917", bg: "#ffffff" },
                              { id: "deep_burgundy", name: "Deep Burgundy", desc: "Imperial beach house", primary: "#5c1d24", bg: "#fdfbfb" }
                            ].map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  updateTheme({ preset: p.id });
                                  triggerSuccess(`Loaded preset palette "${p.name}"`);
                                }}
                                className={`p-3 border rounded-sm text-left transition-all hover:bg-luxury-900/40 relative cursor-pointer ${
                                  theme.preset === p.id 
                                    ? "border-gold-500 bg-gold-500/5 shadow" 
                                    : "border-luxury-800 bg-luxury-950"
                                }`}
                              >
                                {theme.preset === p.id && (
                                  <span className="absolute top-1 right-1 text-gold-300 bg-gold-500/10 p-0.5 rounded-full">
                                    <Check size={10} />
                                  </span>
                                )}
                                <span className="text-xs font-sans font-bold text-luxury-100 block mb-1">
                                  {p.name}
                                </span>
                                <div className="flex space-x-1.5 mb-1">
                                  <span className="w-4 h-4 rounded-full border border-luxury-800" style={{ backgroundColor: p.primary }} />
                                  <span className="w-4 h-4 rounded-full border border-luxury-800" style={{ backgroundColor: p.bg }} />
                                </div>
                                <span className="text-[9px] text-luxury-400 block font-light leading-snug">
                                  {p.desc}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Detailed Palette Editor */}
                        <div className="bg-luxury-900/30 p-5 border border-luxury-900 rounded-sm space-y-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <h5 className="text-xs font-sans font-bold text-luxury-100 uppercase tracking-wider">
                                Fine-Tune Aspect Colors
                              </h5>
                              <p className="text-[10px] text-luxury-400 font-sans">
                                Modify specific tonal ranges to match custom brand guidelines. Tweaking any value shifts preset mode to <strong className="text-gold-300 font-bold">"Custom"</strong>.
                              </p>
                            </div>
                            {theme.preset !== "custom" && (
                              <span className="text-[9px] bg-luxury-900 border border-luxury-800 text-luxury-300 font-mono py-1 px-2 rounded">
                                Active Preset: {theme.preset.replace("_", " ").toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Group A: Luxury Base (Canvas/Text/Backgrounds) */}
                            <div className="space-y-4">
                              <span className="text-[10px] tracking-widest text-gold-300 font-sans font-bold uppercase block border-b border-luxury-800 pb-1">
                                Base Layout Colors
                              </span>

                              {/* Canvas Background */}
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-luxury-100 font-semibold block">Main Site Background</span>
                                  <span className="text-[10px] text-luxury-400 block">Controls the overall canvas base (body)</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-luxury-300 font-mono select-all">{theme.colors.luxury950}</span>
                                  <input
                                    type="color"
                                    value={theme.colors.luxury950}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({
                                        preset: "custom",
                                        colors: { ...theme.colors, luxury950: val }
                                      });
                                    }}
                                    className="w-8 h-8 rounded-sm bg-transparent cursor-pointer border-0"
                                  />
                                </div>
                              </div>

                              {/* Surface / Cards Background */}
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-luxury-100 font-semibold block">Card & Dropdown Surface</span>
                                  <span className="text-[10px] text-luxury-400 block">Controls modal, booking bars & card faces</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-luxury-300 font-mono select-all">{theme.colors.luxury900}</span>
                                  <input
                                    type="color"
                                    value={theme.colors.luxury900}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({
                                        preset: "custom",
                                        colors: { ...theme.colors, luxury900: val }
                                      });
                                    }}
                                    className="w-8 h-8 rounded-sm bg-transparent cursor-pointer border-0"
                                  />
                                </div>
                              </div>

                              {/* Primary Text Color */}
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-luxury-100 font-semibold block">Primary Text Shade</span>
                                  <span className="text-[10px] text-luxury-400 block">Main description paragraph and content colors</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-luxury-300 font-mono select-all">{theme.colors.luxury200}</span>
                                  <input
                                    type="color"
                                    value={theme.colors.luxury200}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({
                                        preset: "custom",
                                        colors: { ...theme.colors, luxury200: val }
                                      });
                                    }}
                                    className="w-8 h-8 rounded-sm bg-transparent cursor-pointer border-0"
                                  />
                                </div>
                              </div>

                              {/* Borders & Dividers */}
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-luxury-100 font-semibold block">Borders & Accent Outlines</span>
                                  <span className="text-[10px] text-luxury-400 block">Controls thin grid line dividers and item borders</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-luxury-300 font-mono select-all">{theme.colors.luxury800}</span>
                                  <input
                                    type="color"
                                    value={theme.colors.luxury800}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({
                                        preset: "custom",
                                        colors: { ...theme.colors, luxury800: val }
                                      });
                                    }}
                                    className="w-8 h-8 rounded-sm bg-transparent cursor-pointer border-0"
                                  />
                                </div>
                              </div>

                              {/* Dark Block / contrast background */}
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-luxury-100 font-semibold block">Contrast / Footer background</span>
                                  <span className="text-[10px] text-luxury-400 block">Used inside footer and ultra-dark layout sections</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-luxury-300 font-mono select-all">{theme.colors.luxury50}</span>
                                  <input
                                    type="color"
                                    value={theme.colors.luxury50}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({
                                        preset: "custom",
                                        colors: { 
                                          ...theme.colors, 
                                          luxury50: val,
                                          luxury100: val 
                                        }
                                      });
                                    }}
                                    className="w-8 h-8 rounded-sm bg-transparent cursor-pointer border-0"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Group B: Brand Accents (Gold Tone) */}
                            <div className="space-y-4">
                              <span className="text-[10px] tracking-widest text-gold-300 font-sans font-bold uppercase block border-b border-luxury-800 pb-1">
                                Brand Accent Colors
                              </span>

                              {/* Primary Accent Color */}
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-luxury-100 font-semibold block">Brand Theme Accent</span>
                                  <span className="text-[10px] text-luxury-400 block">Controls buttons, badge text, and focus outlines</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-luxury-300 font-mono select-all">{theme.colors.gold500}</span>
                                  <input
                                    type="color"
                                    value={theme.colors.gold500}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({
                                        preset: "custom",
                                        colors: { 
                                          ...theme.colors, 
                                          gold300: val,
                                          gold400: val,
                                          gold500: val,
                                          gold600: val 
                                        }
                                      });
                                    }}
                                    className="w-8 h-8 rounded-sm bg-transparent cursor-pointer border-0"
                                  />
                                </div>
                              </div>

                              {/* Light Highlight Fill */}
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-luxury-100 font-semibold block">Light Highlight Accent</span>
                                  <span className="text-[10px] text-luxury-400 block">Background tints and light active hover tiles</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-luxury-300 font-mono select-all">{theme.colors.gold50}</span>
                                  <input
                                    type="color"
                                    value={theme.colors.gold50}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({
                                        preset: "custom",
                                        colors: { 
                                          ...theme.colors, 
                                          gold50: val,
                                          gold100: val 
                                        }
                                      });
                                    }}
                                    className="w-8 h-8 rounded-sm bg-transparent cursor-pointer border-0"
                                  />
                                </div>
                              </div>

                              {/* Dark Accent Tint */}
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="space-y-0.5">
                                  <span className="text-luxury-100 font-semibold block">Deep Contrast Accent</span>
                                  <span className="text-[10px] text-luxury-400 block">Used for dark lettering inside gold accents</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-luxury-300 font-mono select-all">{theme.colors.gold950}</span>
                                  <input
                                    type="color"
                                    value={theme.colors.gold950}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTheme({
                                        preset: "custom",
                                        colors: { 
                                          ...theme.colors, 
                                          gold800: val,
                                          gold900: val,
                                          gold950: val 
                                        }
                                      });
                                    }}
                                    className="w-8 h-8 rounded-sm bg-transparent cursor-pointer border-0"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* -------------------- TAB: SYSTEM SETTINGS -------------------- */}
                  {activeTab === "system" && (
                    <div className="space-y-8 text-left">
                      <div>
                        <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-1">
                          System Recovery & Reset
                        </h3>
                        <p className="text-xs text-luxury-400 font-sans font-light">
                          Admin level system tools to revert configurations back to default resort specifications or backup database nodes.
                        </p>
                      </div>

                      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-6">
                        <div className="flex items-start space-x-3 text-xs text-gold-400 font-sans leading-relaxed bg-gold-500/5 p-4 border border-gold-500/10 rounded">
                          <Info size={16} className="shrink-0 mt-0.5 text-gold-300" />
                          <div>
                            <span className="font-bold uppercase block mb-1">Safety Instruction Node</span>
                            Reverting the database will instantly erase any changes you made on your current device—including customized hero copy, edited room dimensions, and visual journal photos. It will restore the original high-end BAIA Resort designs.
                          </div>
                        </div>

                        <div className="pt-2 flex flex-wrap gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              resetToDefault();
                              triggerSuccess("Database successfully reset to original resort designs.");
                            }}
                            className="inline-flex items-center space-x-2 bg-red-950/40 border border-red-900 text-red-300 hover:bg-red-950/80 px-5 py-3 text-xs tracking-wider uppercase font-sans font-bold rounded-sm cursor-pointer transition-colors"
                          >
                            <Trash2 size={14} />
                            <span>Revert to Design Defaults</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Uploading progress notification widget */}
            <AnimatePresence>
              {isUploading && (
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 30, scale: 0.95 }}
                  className="absolute bottom-6 right-6 z-50 w-80 bg-luxury-950/95 border border-gold-500/30 shadow-2xl p-4 rounded-sm backdrop-blur-md space-y-3 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 bg-gold-500/10 border border-gold-500/20 rounded text-gold-400 shrink-0">
                        {uploadStatus === "uploading" ? (
                          <RefreshCw size={14} className="animate-spin text-gold-300" />
                        ) : uploadStatus === "completed" ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <X size={14} className="text-red-400" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[9px] tracking-[0.2em] text-gold-400 font-sans uppercase font-bold block">
                          {uploadStatus === "uploading" ? "Asset Uploading" : uploadStatus === "completed" ? "Upload Ready" : "Upload Failed"}
                        </span>
                        <span className="text-[11px] text-luxury-200 truncate block font-sans font-medium max-w-[180px]">
                          {uploadFileName || "resort_asset.dat"}
                        </span>
                      </div>
                    </div>
                    {uploadStatus !== "uploading" && (
                      <button 
                        onClick={() => setIsUploading(false)}
                        className="text-luxury-400 hover:text-white transition-colors p-1 rounded hover:bg-luxury-900 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Progress bar container */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] tracking-wider font-sans uppercase text-luxury-400">
                      <span>Database Parsing</span>
                      <span className="text-gold-300 font-mono font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-luxury-900 h-1.5 rounded-full overflow-hidden border border-luxury-800">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.15 }}
                        className={`h-full rounded-full transition-colors duration-300 ${
                          uploadStatus === 'completed' 
                            ? 'bg-emerald-500' 
                            : uploadStatus === 'error' 
                            ? 'bg-red-500' 
                            : 'bg-gold-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Microcopy */}
                  <p className="text-[8px] text-luxury-500 tracking-wider font-sans uppercase font-semibold text-right">
                    {uploadStatus === "uploading" ? "Encrypting node values..." : "Sync sequence complete"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
