import type { Metadata } from "next";
import { Orbitron, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthContext";
import { DemoMode } from "@/components/demo/DemoMode";

const orbitron = Orbitron({
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-orbitron",
});

const inter = Inter({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Quasar Studio",
  description: "No-Code ML & Deep Learning Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${inter.variable} ${jetbrainsMono.variable} dark antialiased`}
    >
      <body className={`h-screen overflow-hidden ${inter.className} bg-[#181D23] text-[#F5F7FA]`}>
        <AuthProvider>
          <DemoMode>
            {children}
            <Toaster theme="dark" position="bottom-right" richColors />
          </DemoMode>
        </AuthProvider>
      </body>
    </html>
  );
}
