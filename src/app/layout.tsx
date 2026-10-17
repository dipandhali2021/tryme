import type { Metadata } from "next";
import "./globals.css";
import { ScrollbarProvider } from "@/components/ui/scroll-area";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "TryMe — live virtual try-on",
  description:
    "Turn on your camera, pick a garment from Amazon, Flipkart or Myntra, and see it on you in real time.",
};

const themeScript = `(function(){try{var m=localStorage.getItem("tryme-mode");if(m==="light"||m==="dark"){document.documentElement.dataset.mode=m}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-mode="dark"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ScrollbarProvider>
          <SiteHeader />
          {children}
        </ScrollbarProvider>
      </body>
    </html>
  );
}
