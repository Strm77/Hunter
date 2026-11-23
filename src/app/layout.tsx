import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navegacao from "@/components/Navegacao";
import AvisoPrototipo from "@/components/AvisoPrototipo";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hunter",
  description: "Organização da busca de emprego: candidaturas, vagas, perfil e currículos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Navegacao />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
        <AvisoPrototipo />
      </body>
    </html>
  );
}
