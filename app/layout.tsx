import type { Metadata, Viewport } from "next";
import { Anuphan, Chakra_Petch, JetBrains_Mono, Kanit } from "next/font/google";
import { BASE } from "@/lib/data";
import "./globals.css";

const kanit = Kanit({ weight: ["800", "900"], style: "italic", subsets: ["thai", "latin"], variable: "--f-kanit", display: "swap" });
const anuphan = Anuphan({ subsets: ["thai", "latin"], variable: "--f-anuphan", display: "swap" });
const chakra = Chakra_Petch({ weight: ["500", "600", "700"], subsets: ["thai", "latin"], variable: "--f-chakra", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--f-jb", display: "swap" });

export const metadata: Metadata = {
  title: "A10 / CPE102 Grand Prix",
  description: "Viewbook วิชา CPE102 มจธ. ของทีม A10: บันทึกการเรียนครบ 16 สัปดาห์ ในรูปแบบฤดูกาลแข่งรถ 16 สนาม",
};

export const viewport: Viewport = { themeColor: "#121418" };

// Runs before paint: marks whether motion is allowed so the hero can hide its words without a flash.
const motionScript = `(function(){var d=document.documentElement;if(matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('still')}else{d.classList.add('motion');setTimeout(function(){d.classList.add('hero-ready')},2000)}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${kanit.variable} ${anuphan.variable} ${chakra.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
        {/* the hero's still and the 3D files start downloading with the page, not when the script that needs them runs */}
        <link rel="preload" as="image" href={`${BASE}/stills/grid.webp`} media="(min-width: 1024px) and (min-aspect-ratio: 1/1)" fetchPriority="high" />
        <link rel="preload" as="fetch" href={`${BASE}/models/car.glb`} crossOrigin="anonymous" />
        <link rel="preload" as="image" href={`${BASE}/models/asphalt.webp`} crossOrigin="anonymous" />
        <link rel="preload" as="image" href={`${BASE}/models/car-shadow.png`} crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
