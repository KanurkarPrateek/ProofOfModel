"use client";

import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Model Verification", ic: "◎" },
  { href: "/gateway", label: "Secure Gateway", ic: "▤" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <div className="side-mark">◈</div>
        <div className="nm">ProofOfModel</div>
      </div>
      <nav className="side-group">
        <div className="lbl">Trust Layer</div>
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className={`side-link${path === n.href ? " active" : ""}`}
          >
            <span className="ic">{n.ic}</span>
            {n.label}
          </a>
        ))}
      </nav>
      <div className="side-foot">
        <div className="env">
          <span className="dot" /> monad-testnet · 10143
        </div>
      </div>
    </aside>
  );
}
