import type { Metadata } from "next";
import { Krub, Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthContext";
import { DemoMode } from "@/components/demo/DemoMode";

const krub = Krub({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-krub",
});

const montserrat = Montserrat({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-montserrat",
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
      className={`${krub.variable} ${montserrat.variable} dark antialiased`}
    >
      <body className={`h-screen overflow-hidden ${krub.className} bg-[#181d23] text-[#a5a8ad]`}>
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
