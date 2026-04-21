import type { Metadata } from "next";
import "./globals.css";
import OnboardingTour from "./components/OnboardingTour";
import MobileNav from "./components/MobileNav";

export const metadata: Metadata = {
  title: "Melodica – AI That Understands the Soul of Music",
  description: "Create, edit, and transcribe music effortlessly with an intuitive AI engine. Melodica is the ultimate platform for musicians, producers, and creators.",
  keywords: "AI music, DAW, music generation, sheet music, transcription, virtual piano",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <MobileNav />
        <OnboardingTour />
      </body>
    </html>
  );
}

