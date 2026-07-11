import { createFileRoute } from "@tanstack/react-router";
import { SiteProvider } from "@/baia/context/SiteContext";
import App from "@/baia/App";

// The BAIA site is a client-side SPA (uses window/document/motion effects).
// Render it client-only to avoid SSR crashes.
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "BAIA — Beachfront Boutique Lodge" },
      { name: "description", content: "A barefoot luxury retreat on Palawan — beachfront villas, island excursions, and slow living on Penanindigan Beach." },
      { property: "og:title", content: "BAIA — Beachfront Boutique Lodge" },
      { property: "og:description", content: "A barefoot luxury retreat on Palawan — beachfront villas, island excursions, and slow living on Penanindigan Beach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <SiteProvider>
      <App />
    </SiteProvider>
  );
}
