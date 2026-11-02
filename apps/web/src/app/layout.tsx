import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ApiStatus } from "@/components/ApiStatus";

export const metadata: Metadata = { title: "3D-MOVIE", description: "プロンプトから 3D アセットを作り、動かして動画にする" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="flex flex-col min-h-screen">
        <Nav />
        <main className="flex-1 p-4">{children}</main>
        <footer className="px-4 h-8 flex items-center border-t" style={{ borderColor: "var(--border)" }}><ApiStatus /></footer>
      </body>
    </html>
  );
}
