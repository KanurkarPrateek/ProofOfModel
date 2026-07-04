import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proof of Model — Trust layer for the Agent Economy",
  description:
    "Verify which model an LLM endpoint really serves, and record it on Monad.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="appbar">
          <div className="appbar-left">
            <span className="appbar-menu">☰</span>
            <span className="appbar-brand">ProofOfModel</span>
            <span className="appbar-project">
              <b>monad-testnet</b> ▾
            </span>
          </div>
          <div className="appbar-right">
            <span className="appbar-avatar">S</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
