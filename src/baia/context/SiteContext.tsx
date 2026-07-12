import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { RoomTier, Activity, Testimonial } from "../types";
import { ROOMS as DEFAULT_ROOMS, ACTIVITIES as DEFAULT_ACTIVITIES, TESTIMONIALS as DEFAULT_TESTIMONIALS } from "../data";
import { supabase } from "@/integrations/supabase/client";
import { saveSiteState } from "../admin.functions";

export interface ThemeColors {
  gold50: string;
  gold100: string;
  gold200: string;
  gold300: string;
  gold400: string;
  gold500: string;
  gold600: string;
  gold700: string;
  gold800: string;
  gold900: string;
  gold950: string;

  luxury50: string;
  luxury100: string;
  luxury200: string;
  luxury300: string;
  luxury400: string;
  luxury500: string;
  luxury600: string;
  luxury700: string;
  luxury800: string;
  luxury900: string;
  luxury950: string;
}

export interface ThemeData {
  heroFont: string;
  sectionsFont: string;
  headerFont: string;
  footerFont: string;
  preset: string; // "warm_gold" | "silent_indigo" | "forest_retreat" | "sand_charcoal" | "deep_burgundy" | "custom"
  colors: ThemeColors;
}

export const PRESETS: { [key: string]: ThemeColors } = {
  warm_gold: {
    gold50: "#f9f8f4",
    gold100: "#e5e3d8",
    gold200: "#c9c5b9",
    gold300: "#5a5a40",
    gold400: "#4e4e37",
    gold500: "#5a5a40",
    gold600: "#444430",
    gold700: "#333324",
    gold800: "#222218",
    gold900: "#11110c",
    gold950: "#080806",
    luxury50: "#1a1a1a",
    luxury100: "#2d2d2d",
    luxury200: "#3e3c35",
    luxury300: "#54524a",
    luxury400: "#6c6a60",
    luxury500: "#8f8b7b",
    luxury600: "#b5b09e",
    luxury700: "#c9c5b9",
    luxury800: "#e5e2d9",
    luxury900: "#edebe4",
    luxury950: "#f9f8f6"
  },
  silent_indigo: {
    gold50: "#f0f3f9",
    gold100: "#dbe3f1",
    gold200: "#b4c5e3",
    gold300: "#2b4c7e",
    gold400: "#1f3659",
    gold500: "#2b4c7e",
    gold600: "#1a2e4c",
    gold700: "#122035",
    gold800: "#0c1523",
    gold900: "#060a11",
    gold950: "#030508",
    luxury50: "#0c121e",
    luxury100: "#182337",
    luxury200: "#243553",
    luxury300: "#374c71",
    luxury400: "#566d94",
    luxury500: "#7a91b8",
    luxury600: "#a3b6d7",
    luxury700: "#cdd7eb",
    luxury800: "#e7edf8",
    luxury900: "#f1f5fc",
    luxury950: "#f8fafc"
  },
  forest_retreat: {
    gold50: "#f3f5f3",
    gold100: "#e1e6e1",
    gold200: "#c2ccc2",
    gold300: "#3f5e4d",
    gold400: "#2e4538",
    gold500: "#3f5e4d",
    gold600: "#23362a",
    gold700: "#19261e",
    gold800: "#101813",
    gold900: "#080c0a",
    gold950: "#040605",
    luxury50: "#141a16",
    luxury100: "#242f28",
    luxury200: "#324137",
    luxury300: "#475b4e",
    luxury400: "#627b6b",
    luxury500: "#849f8e",
    luxury600: "#aac0b2",
    luxury700: "#cbd9d1",
    luxury800: "#e5ece9",
    luxury900: "#eef3f0",
    luxury950: "#f6f9f7"
  },
  sand_charcoal: {
    gold50: "#fafaf9",
    gold100: "#f5f5f4",
    gold200: "#e7e5e4",
    gold300: "#1c1917",
    gold400: "#292524",
    gold500: "#44403c",
    gold600: "#57534e",
    gold700: "#78716c",
    gold800: "#a8a29e",
    gold900: "#d6d3d1",
    gold950: "#e7e5e4",
    luxury50: "#1c1917",
    luxury100: "#292524",
    luxury200: "#44403c",
    luxury300: "#57534e",
    luxury400: "#78716c",
    luxury500: "#a8a29e",
    luxury600: "#d6d3d1",
    luxury700: "#e7e5e4",
    luxury800: "#f5f5f4",
    luxury900: "#fafaf9",
    luxury950: "#ffffff"
  },
  deep_burgundy: {
    gold50: "#faf5f5",
    gold100: "#f5e6e6",
    gold200: "#ebcccc",
    gold300: "#5c1d24",
    gold400: "#47161c",
    gold500: "#5c1d24",
    gold600: "#361115",
    gold700: "#240b0e",
    gold800: "#180709",
    gold900: "#0c0405",
    gold950: "#060202",
    luxury50: "#1c0c0d",
    luxury100: "#2f1618",
    luxury200: "#422023",
    luxury300: "#5c3134",
    luxury400: "#7e494d",
    luxury500: "#a16b70",
    luxury600: "#c29498",
    luxury700: "#dcbdc0",
    luxury800: "#f0e0e1",
    luxury900: "#f8f0f1",
    luxury950: "#fdfbfb"
  }
};

export interface MediaPlayback {
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  controls: boolean;
  posterUrl?: string;
}

export interface HeroData {
  title: string;
  subtitle: string;
  backgroundImage: string;
  videoUrl?: string;
  youtubeUrl?: string;
  playback?: MediaPlayback;
}

export interface PhilosophyData {
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  videoUrl?: string;
  youtubeUrl?: string;
  badgeTitle: string;
  badgeText: string;
  playback?: MediaPlayback;
}

export interface IslandIntroData {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  image: string;
  videoUrl?: string;
  youtubeUrl?: string;
  playback?: MediaPlayback;
}

export const DEFAULT_HERO_PLAYBACK: MediaPlayback = {
  autoplay: true, muted: true, loop: true, controls: false, posterUrl: "",
};
export const DEFAULT_SECTION_PLAYBACK: MediaPlayback = {
  autoplay: false, muted: false, loop: false, controls: true, posterUrl: "",
};


export interface LogoData {
  text: string;
  letter: string;
  sizePx: number;       // For logo text size
  letterSizePx: number; // For logo icon circle size
  customImage?: string; // Base64 or image URL
  imageHeightPx?: number; // Customizable logo image height
}

export interface HeaderData {
  bookButtonText: string;
  links: Array<{ label: string; id: string }>;
}

export interface FooterData {
  brandText: string;
  location1: string;
  location2: string;
  email: string;
  trustTitle: string;
  trustBadge: string;
  trustDescription: string;
  copyright: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
}

export interface GalleryItem {
  id: string;
  src: string;
  title: string;
  location: string;
  description: string;
  category: "Nature" | "Resort" | "Surf" | "Sanctuary" | string;
}

interface SiteContextType {
  hero: HeroData;
  philosophy: PhilosophyData;
  islandIntro: IslandIntroData;
  logo: LogoData;
  header: HeaderData;
  footer: FooterData;
  theme: ThemeData;
  galleryItems: GalleryItem[];
  rooms: RoomTier[];
  activities: Activity[];
  testimonials: Testimonial[];
  updateHero: (data: Partial<HeroData>) => void;
  updatePhilosophy: (data: Partial<PhilosophyData>) => void;
  updateIslandIntro: (data: Partial<IslandIntroData>) => void;
  updateLogo: (data: Partial<LogoData>) => void;
  updateHeader: (data: Partial<HeaderData>) => void;
  updateFooter: (data: Partial<FooterData>) => void;
  updateTheme: (data: Partial<ThemeData>) => void;
  // Gallery Management
  addGalleryItem: (item: Omit<GalleryItem, "id">) => void;
  updateGalleryItem: (id: string, data: Partial<GalleryItem>) => void;
  deleteGalleryItem: (id: string) => void;
  // Rooms Management
  updateRoom: (id: string, data: Partial<RoomTier>) => void;
  addRoom: (room: Omit<RoomTier, "id">) => void;
  deleteRoom: (id: string) => void;
  // Activities Management
  updateActivity: (id: string, data: Partial<Activity>) => void;
  addActivity: (activity: Omit<Activity, "id">) => void;
  deleteActivity: (id: string) => void;
  // Testimonials Management
  updateTestimonial: (id: string, data: Partial<Testimonial>) => void;
  addTestimonial: (testimonial: Omit<Testimonial, "id">) => void;
  deleteTestimonial: (id: string) => void;
  // General Image Updater (helper for raw asset overrides)
  resetToDefault: () => void;
  // Admin passkey (in-memory; set by AdminGate on unlock)
  adminPasskey: string | null;
  setAdminPasskey: (passkey: string | null) => void;
}

const DEFAULT_HERO: HeroData = {
  title: "Escape\nBeyond the\nOrdinary",
  subtitle: "A barefoot luxury retreat on the island of Palawan, where nature, design, and soul move in perfect rhythm.",
  backgroundImage: "/src/assets/images/baia_hero_sunset_1783731965243.jpg",
  videoUrl: "",
  youtubeUrl: "",
  playback: { ...DEFAULT_HERO_PLAYBACK },
};

const DEFAULT_PHILOSOPHY: PhilosophyData = {
  eyebrow: "OUR PHILOSOPHY",
  title: "\"True luxury is feeling completely at home in nature.\"",
  subtitle: "At BAIA, we believe that slowing down connects you to what truly matters. Here, simplicity becomes riches, and raw tropical beauty is framed by custom design and hospitality.",
  image: "/src/assets/images/baia_beachfront_lounge_1783731978499.jpg",
  videoUrl: "",
  youtubeUrl: "",
  badgeTitle: "THE EXPERIENCE",
  badgeText: "Quiet luxury on the shorelines of San Vicente.",
  playback: { ...DEFAULT_SECTION_PLAYBACK },
};

const DEFAULT_ISLAND_INTRO: IslandIntroData = {
  eyebrow: "THE ISLAND",
  title: "Palawan as it should be",
  subtitle: "Unspoiled. Untamed. Unforgettable. Discover a slower pace of life surrounded by raw natural beauty, turquoise saltwater tidal pools, and warm Filipino island hospitality.",
  ctaLabel: "EXPLORE CURATED EXPERIENCES",
  image: "/src/assets/images/baia_luxury_room_1783731990599.jpg",
  videoUrl: "",
  youtubeUrl: "",
  playback: { ...DEFAULT_SECTION_PLAYBACK },
};


const DEFAULT_LOGO: LogoData = {
  text: "BAIA",
  letter: "Q",
  sizePx: 20,
  letterSizePx: 32,
  customImage: "",
  imageHeightPx: 32
};

const DEFAULT_HEADER: HeaderData = {
  bookButtonText: "BOOK YOUR STAY",
  links: [
    { label: "STAY", id: "stay" },
    { label: "EXPERIENCES", id: "experiences" },
    { label: "PHILOSOPHY", id: "philosophy" },
    { label: "GALLERY", id: "gallery" },
    { label: "TESTIMONIALS", id: "testimonials" }
  ]
};

const DEFAULT_FOOTER: FooterData = {
  brandText: "A barefoot luxury sanctuary nestled along the tropical shores of San Vicente, Palawan. Slow living, island excursions, and timeless design in perfect rhythm.",
  location1: "Penanindigan Beach, San Vicente",
  location2: "Philippines",
  email: "hello@baiapalawan.com",
  trustTitle: "TRUST & SECURITY",
  trustBadge: "SSL Secured Transactions",
  trustDescription: "Our reservations database is encrypted, and payments are direct and authorized seamlessly through full 256-bit gateway encryption.",
  copyright: "© 2026 BAIA Beachfront Boutique Lodge, San Vicente, Palawan. All Rights Reserved.",
  instagramUrl: "https://instagram.com/baia.resort",
  facebookUrl: "https://facebook.com/baia.resort",
  tiktokUrl: "https://tiktok.com/@baia.resort"
};

const DEFAULT_THEME_COLORS: ThemeColors = {
  gold50: "#f9f8f4",
  gold100: "#e5e3d8",
  gold200: "#c9c5b9",
  gold300: "#5a5a40",
  gold400: "#4e4e37",
  gold500: "#5a5a40",
  gold600: "#444430",
  gold700: "#333324",
  gold800: "#222218",
  gold900: "#11110c",
  gold950: "#080806",
  
  luxury50: "#1a1a1a",
  luxury100: "#2d2d2d",
  luxury200: "#3e3c35",
  luxury300: "#54524a",
  luxury400: "#6c6a60",
  luxury500: "#8f8b7b",
  luxury600: "#b5b09e",
  luxury700: "#c9c5b9",
  luxury800: "#e5e2d9",
  luxury900: "#edebe4",
  luxury950: "#f9f8f6"
};

export const DEFAULT_THEME: ThemeData = {
  heroFont: "Cormorant Garamond",
  sectionsFont: "Inter",
  headerFont: "Inter",
  footerFont: "Inter",
  preset: "warm_gold",
  colors: DEFAULT_THEME_COLORS
};

const DEFAULT_GALLERY: GalleryItem[] = [
  {
    id: "g1",
    src: "/src/assets/images/baia_hero_sunset_1783731965243.jpg",
    title: "Penanindigan Beach at Dawn",
    location: "BAIA Beachfront, San Vicente",
    description: "The calm expanse of Penanindigan Beach at first light, where the Sulu Sea meets a traditional fishing village on the island of Palawan.",
    category: "Resort"
  },
  {
    id: "g2",
    src: "/src/assets/images/baia_beachfront_lounge_1783731978499.jpg",
    title: "Oceanfront Living Pavilion",
    location: "BAIA Lounge & Social",
    description: "Our signature open-air beachfront social space, woven from native materials with low teak daybeds and warm coastal winds.",
    category: "Resort"
  },
  {
    id: "g3",
    src: "/src/assets/images/baia_luxury_room_1783731990599.jpg",
    title: "Deluxe Beachfront Suite",
    location: "BAIA Suites",
    description: "The only front-row villa — a king bed, separate seating area, and an uninterrupted view of the water from the moment you wake.",
    category: "Resort"
  },
  {
    id: "g4",
    src: "/src/assets/images/baia_hero_sunset_1783731965243.jpg",
    title: "Sunset Over the Sulu Sea",
    location: "BAIA Beachfront",
    description: "A soft bronze sunset painting the skies over BAIA's peaceful beachfront, signaling the arrival of starry tropical nights.",
    category: "Resort"
  },
  {
    id: "g5",
    src: "/src/assets/images/baia_hero_sunset_1783731965243.jpg",
    title: "Twilight on Penanindigan Beach",
    location: "BAIA Beachfront",
    description: "A soft bronze sunset painting the skies over BAIA's peaceful beachfront, signaling the arrival of starry tropical nights.",
    category: "Resort"
  },
  {
    id: "g6",
    src: "/src/assets/images/baia_beachfront_lounge_1783731978499.jpg",
    title: "Oceanfront Living Pavilion",
    location: "BAIA Lounge & Social",
    description: "Our signature open-air beachfront social space, designed with native woven materials, low-slung teak daybeds, and warm coastal winds.",
    category: "Resort"
  },
  {
    id: "g7",
    src: "/src/assets/images/baia_luxury_room_1783731990599.jpg",
    title: "The Suluian Master Pool Villa",
    location: "BAIA Villa Sanctuary",
    description: "A private, minimalist sanctuary blending handcrafted Filipino textures, cool polished concrete, and a private pool facing the sea.",
    category: "Sanctuary"
  }
];

const SiteContext = createContext<SiteContextType | undefined>(undefined);

const normalizeAssetUrl = (url: unknown) => {
  if (typeof url !== "string") return url;
  const marker = "/storage/v1/object/public/site-assets/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return url;
  const objectPath = url.slice(markerIndex + marker.length).split("?")[0];
  return objectPath ? `/api/site-assets/${objectPath}` : url;
};

const normalizeLoadedSiteState = (data: any) => {
  const normalized = { ...data };
  if (normalized.hero?.backgroundImage) {
    normalized.hero = {
      ...normalized.hero,
      backgroundImage: normalizeAssetUrl(normalized.hero.backgroundImage),
    };
  }
  if (normalized.logo?.customImage) {
    normalized.logo = {
      ...normalized.logo,
      customImage: normalizeAssetUrl(normalized.logo.customImage),
    };
  }
  const normalizePlayback = (pb: any, fallback: MediaPlayback): MediaPlayback => ({
    ...fallback,
    ...(pb || {}),
    posterUrl: normalizeAssetUrl(pb?.posterUrl ?? fallback.posterUrl ?? "") as string,
  });
  if (normalized.hero) {
    normalized.hero = {
      ...normalized.hero,
      videoUrl: normalized.hero.videoUrl ? normalizeAssetUrl(normalized.hero.videoUrl) : normalized.hero.videoUrl,
      playback: normalizePlayback(normalized.hero.playback, DEFAULT_HERO_PLAYBACK),
    };
  }
  if (normalized.philosophy) {
    normalized.philosophy = {
      ...normalized.philosophy,
      image: normalizeAssetUrl(normalized.philosophy.image),
      videoUrl: normalizeAssetUrl(normalized.philosophy.videoUrl),
      playback: normalizePlayback(normalized.philosophy.playback, DEFAULT_SECTION_PLAYBACK),
    };
  }
  if (normalized.islandIntro) {
    normalized.islandIntro = {
      ...normalized.islandIntro,
      image: normalizeAssetUrl(normalized.islandIntro.image),
      videoUrl: normalizeAssetUrl(normalized.islandIntro.videoUrl),
      playback: normalizePlayback(normalized.islandIntro.playback, DEFAULT_SECTION_PLAYBACK),
    };
  }

  if (Array.isArray(normalized.galleryItems)) {
    normalized.galleryItems = normalized.galleryItems.map((item: GalleryItem) => ({
      ...item,
      src: normalizeAssetUrl(item.src) as string,
    }));
  }
  if (Array.isArray(normalized.rooms)) {
    normalized.rooms = normalized.rooms.map((room: RoomTier) => ({
      ...room,
      imageUrl: normalizeAssetUrl(room.imageUrl) as string,
      images: room.images?.map((image) => normalizeAssetUrl(image) as string),
    }));
  }
  if (Array.isArray(normalized.activities)) {
    normalized.activities = normalized.activities.map((activity: Activity) => ({
      ...activity,
      imageUrl: normalizeAssetUrl(activity.imageUrl) as string,
    }));
  }
  return normalized;
};

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hero, setHero] = useState<HeroData>(DEFAULT_HERO);
  const [philosophy, setPhilosophy] = useState<PhilosophyData>(DEFAULT_PHILOSOPHY);
  const [islandIntro, setIslandIntro] = useState<IslandIntroData>(DEFAULT_ISLAND_INTRO);
  const [logo, setLogo] = useState<LogoData>(DEFAULT_LOGO);
  const [header, setHeader] = useState<HeaderData>(DEFAULT_HEADER);
  const [footer, setFooter] = useState<FooterData>(DEFAULT_FOOTER);
  const [theme, setTheme] = useState<ThemeData>(DEFAULT_THEME);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(DEFAULT_GALLERY);
  const [rooms, setRooms] = useState<RoomTier[]>(DEFAULT_ROOMS);
  const [activities, setActivities] = useState<Activity[]>(DEFAULT_ACTIVITIES);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [loaded, setLoaded] = useState(false);
  const [adminPasskey, setAdminPasskey] = useState<string | null>(null);
  const adminPasskeyRef = useRef<string | null>(null);
  adminPasskeyRef.current = adminPasskey;

  // Load site state from Supabase on mount, and track admin session for save gating
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("site_state")
        .select("data")
        .eq("key", "default")
        .maybeSingle();
      if (!cancelled && !error && data?.data) {
        const d: any = normalizeLoadedSiteState(data.data);
        if (d.hero) setHero({ ...DEFAULT_HERO, ...d.hero });
        if (d.philosophy) setPhilosophy({ ...DEFAULT_PHILOSOPHY, ...d.philosophy });
        if (d.islandIntro) setIslandIntro({ ...DEFAULT_ISLAND_INTRO, ...d.islandIntro });
        if (d.logo) setLogo({ ...DEFAULT_LOGO, ...d.logo });
        if (d.header) setHeader({ ...DEFAULT_HEADER, ...d.header });
        if (d.footer) setFooter({ ...DEFAULT_FOOTER, ...d.footer });
        if (d.theme) setTheme({ ...DEFAULT_THEME, ...d.theme });
        if (Array.isArray(d.galleryItems)) setGalleryItems(d.galleryItems);
        if (Array.isArray(d.rooms)) setRooms(d.rooms);
        if (Array.isArray(d.activities)) setActivities(d.activities);
        if (Array.isArray(d.testimonials)) setTestimonials(d.testimonials);
      }
      if (!cancelled) setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced save to Supabase (via server fn) when admin passkey is present
  useEffect(() => {
    if (!loaded) return;
    const passkey = adminPasskeyRef.current;
    if (!passkey) return;
    const timer = setTimeout(async () => {
      try {
        await saveSiteState({
          data: {
            passkey,
            state: { hero, philosophy, islandIntro, logo, header, footer, theme, galleryItems, rooms, activities, testimonials },
          },
        });
      } catch (err) {
        console.error("[BAIA] Failed to save site state:", err);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [loaded, adminPasskey, hero, philosophy, islandIntro, logo, header, footer, theme, galleryItems, rooms, activities, testimonials]);

  // Load Google Fonts and apply CSS custom properties dynamically
  useEffect(() => {
    if (typeof document === "undefined") return;
    const selectedFonts = [theme.heroFont, theme.sectionsFont, theme.headerFont, theme.footerFont];
    const uniqueFonts = Array.from(new Set(selectedFonts));

    const fontQueries = uniqueFonts.map(font => {
      switch (font) {
        case "Inter": return "Inter:wght@300;400;500;600;700";
        case "Cormorant Garamond": return "Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400";
        case "Outfit": return "Outfit:wght@300;400;500;600;700";
        case "Plus Jakarta Sans": return "Plus+Jakarta+Sans:wght@300;400;500;600;700";
        case "DM Sans": return "DM+Sans:wght@300;400;500;700";
        case "Playfair Display": return "Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400";
        case "Cinzel": return "Cinzel:wght@400;500;600;700";
        case "Syne": return "Syne:wght@400;500;600;700;800";
        case "Fraunces": return "Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,700;1,9..144,400";
        case "Italiana": return "Italiana";
        case "Bodoni Moda": return "Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400";
        case "Space Grotesk": return "Space+Grotesk:wght@300;400;500;600;700";
        case "Montserrat": return "Montserrat:wght@300;400;500;600;700";
        case "Unbounded": return "Unbounded:wght@300;400;500;700";
        default: return "";
      }
    }).filter(Boolean);

    if (fontQueries.length > 0) {
      const linkId = "dynamic-google-fonts";
      let link = document.getElementById(linkId) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${fontQueries.join("&family=")}&display=swap`;
    }

    const isSerif = (fontName: string) => {
      const serifs = ["Cormorant Garamond", "Playfair Display", "Cinzel", "Fraunces", "Italiana", "Bodoni Moda"];
      return serifs.includes(fontName);
    };
    const getFallback = (fontName: string) => {
      return isSerif(fontName) ? "Georgia, serif" : "ui-sans-serif, system-ui, sans-serif";
    };

    const styleId = "dynamic-theme-styles";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.innerHTML = `
      :root {
        --font-hero: "${theme.heroFont}", ${getFallback(theme.heroFont)};
        --font-sections: "${theme.sectionsFont}", ${getFallback(theme.sectionsFont)};
        --font-header: "${theme.headerFont}", ${getFallback(theme.headerFont)};
        --font-footer: "${theme.footerFont}", ${getFallback(theme.footerFont)};

        --gold-50: ${theme.colors.gold50};
        --gold-100: ${theme.colors.gold100};
        --gold-200: ${theme.colors.gold200};
        --gold-300: ${theme.colors.gold300};
        --gold-400: ${theme.colors.gold400};
        --gold-500: ${theme.colors.gold500};
        --gold-600: ${theme.colors.gold600};
        --gold-700: ${theme.colors.gold700};
        --gold-800: ${theme.colors.gold800};
        --gold-900: ${theme.colors.gold900};
        --gold-950: ${theme.colors.gold950};

        --luxury-50: ${theme.colors.luxury50};
        --luxury-100: ${theme.colors.luxury100};
        --luxury-200: ${theme.colors.luxury200};
        --luxury-300: ${theme.colors.luxury300};
        --luxury-400: ${theme.colors.luxury400};
        --luxury-500: ${theme.colors.luxury500};
        --luxury-600: ${theme.colors.luxury600};
        --luxury-700: ${theme.colors.luxury700};
        --luxury-800: ${theme.colors.luxury800};
        --luxury-900: ${theme.colors.luxury900};
        --luxury-950: ${theme.colors.luxury950};
      }

      #hero-title, #hero-subtitle { font-family: var(--font-hero) !important; }
      #header, #header *, #navbar-container, #navbar-container * { font-family: var(--font-header) !important; }
      #footer, #footer * { font-family: var(--font-footer) !important; }
    `;
  }, [theme]);


  const updateHero = (data: Partial<HeroData>) => {
    setHero((prev) => ({ ...prev, ...data }));
  };

  const updatePhilosophy = (data: Partial<PhilosophyData>) => {
    setPhilosophy((prev) => ({ ...prev, ...data }));
  };

  const updateIslandIntro = (data: Partial<IslandIntroData>) => {
    setIslandIntro((prev) => ({ ...prev, ...data }));
  };

  const updateLogo = (data: Partial<LogoData>) => {
    setLogo((prev) => ({ ...prev, ...data }));
  };

  const updateHeader = (data: Partial<HeaderData>) => {
    setHeader((prev) => ({ ...prev, ...data }));
  };

  const updateFooter = (data: Partial<FooterData>) => {
    setFooter((prev) => ({ ...prev, ...data }));
  };

  // Gallery
  const addGalleryItem = (item: Omit<GalleryItem, "id">) => {
    const newItem: GalleryItem = {
      ...item,
      id: "g_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4)
    };
    setGalleryItems((prev) => [...prev, newItem]);
  };

  const updateGalleryItem = (id: string, data: Partial<GalleryItem>) => {
    setGalleryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...data } : item))
    );
  };

  const deleteGalleryItem = (id: string) => {
    setGalleryItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Rooms
  const updateRoom = (id: string, data: Partial<RoomTier>) => {
    setRooms((prev) =>
      prev.map((room) => (room.id === id ? { ...room, ...data } : room))
    );
  };

  const addRoom = (room: Omit<RoomTier, "id">) => {
    const newRoom: RoomTier = {
      ...room,
      id: "room_" + Date.now()
    };
    setRooms((prev) => [...prev, newRoom]);
  };

  const deleteRoom = (id: string) => {
    setRooms((prev) => prev.filter((room) => room.id !== id));
  };

  // Activities
  const updateActivity = (id: string, data: Partial<Activity>) => {
    setActivities((prev) =>
      prev.map((act) => (act.id === id ? { ...act, ...data } : act))
    );
  };

  const addActivity = (activity: Omit<Activity, "id">) => {
    const newAct: Activity = {
      ...activity,
      id: "act_" + Date.now()
    };
    setActivities((prev) => [...prev, newAct]);
  };

  // Testimonials
  const updateTestimonial = (id: string, data: Partial<Testimonial>) => {
    setTestimonials((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
  };

  const addTestimonial = (testimonial: Omit<Testimonial, "id">) => {
    const newT: Testimonial = {
      ...testimonial,
      id: "t_" + Date.now()
    };
    setTestimonials((prev) => [...prev, newT]);
  };

  const deleteTestimonial = (id: string) => {
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
  };

  const deleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((act) => act.id !== id));
  };

  const updateTheme = (data: Partial<ThemeData>) => {
    setTheme((prev) => {
      let updated = { ...prev, ...data };
      // If preset changes and is not custom, apply PRESETS colors
      if (data.preset && data.preset !== "custom" && PRESETS[data.preset]) {
        updated.colors = { ...PRESETS[data.preset] };
      }
      return updated;
    });
  };

  const resetToDefault = () => {
    if (window.confirm("Are you sure you want to revert all site customizations back to the original design?")) {
      setHero(DEFAULT_HERO);
      setPhilosophy(DEFAULT_PHILOSOPHY);
      setIslandIntro(DEFAULT_ISLAND_INTRO);
      setLogo(DEFAULT_LOGO);
      setHeader(DEFAULT_HEADER);
      setFooter(DEFAULT_FOOTER);
      setTheme(DEFAULT_THEME);
      setGalleryItems(DEFAULT_GALLERY);
      setRooms(DEFAULT_ROOMS);
      setActivities(DEFAULT_ACTIVITIES);

    }
  };

  return (
    <SiteContext.Provider
      value={{
        hero,
        philosophy,
        islandIntro,
        logo,
        header,
        footer,
        theme,
        galleryItems,
        rooms,
        activities,
        updateHero,
        updatePhilosophy,
        updateIslandIntro,
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
        setAdminPasskey,
      }}
    >
      {!loaded ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#0c0c0c",
            zIndex: 9999,
          }}
          aria-hidden="true"
        />
      ) : (
        children
      )}
    </SiteContext.Provider>
  );
};


export const useSite = () => {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return context;
};
