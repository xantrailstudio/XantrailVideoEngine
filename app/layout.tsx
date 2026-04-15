import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zyntros",
  description: "Zyntros Video Production Engine",
  icons: {
    icon: "/Zyntros_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
