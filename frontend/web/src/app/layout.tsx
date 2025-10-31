import type { Metadata } from "next";
import { Instrument_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Providers } from "../components/Providers";
import { ToastProvider } from "../components/ui/Toast";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Octamarket",
  description: "Octamarket",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} ${dmMono.variable} antialiased`}>
        <Providers>
          <ToastProvider>
            <Header />
            {children}
            <Footer />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
