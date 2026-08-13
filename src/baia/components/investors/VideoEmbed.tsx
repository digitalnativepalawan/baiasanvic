/**
 * VideoEmbed — renders a hosted video (YouTube / Vimeo / direct mp4) with a
 * poster fallback. Admin pastes a URL; we derive an embed src without any
 * third-party SDK. Free, no paid service.
 */

interface Props {
  url: string;
  poster?: string;
  caption?: string;
}

function toEmbed(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  try {
    const p = new URL(u);
    const host = p.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "youtu.be") {
      const id = host === "youtu.be" ? p.pathname.slice(1) : p.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = p.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    // Direct file (mp4/webm) or anything else — use as-is in <video>.
    return u;
  } catch {
    return u; // not a URL; let <video> attempt it
  }
}

export default function VideoEmbed({ url, poster, caption }: Props) {
  const src = toEmbed(url);
  if (!src) return null;

  const isDirect = /\.(mp4|webm|ogg)(\?.*)?$/i.test(src);

  return (
    <figure className="space-y-2">
      <div className="overflow-hidden bg-luxury-950">
        {isDirect ? (
          <video src={src} poster={poster} controls className="w-full h-56 md:h-72 object-cover" />
        ) : (
          <iframe
            src={src}
            title={caption || "AMUMA video"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-56 md:h-72"
          />
        )}
      </div>
      {caption && (
        <figcaption className="text-[10px] tracking-[0.18em] uppercase text-luxury-400 font-sans">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
