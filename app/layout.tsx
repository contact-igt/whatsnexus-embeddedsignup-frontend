import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import Providers from "@/provider/provider";

const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans/PlusJakartaSans-variable.ttf",
  variable: "--font-jakarta",
  weight: "200 800",
});

export const metadata: Metadata = {
  title: "WhatsNexus - AI Receptionist Hub",
  description: "AI Receptionist Hub for Business Automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
