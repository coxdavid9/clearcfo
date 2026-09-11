"use client";

import Image from "next/image";
import { useState } from "react";

const navItems = [
  ["Product", "#product"],
  ["How It Works", "#how-it-works"],
  ["What You Receive", "#what-you-receive"],
  ["Pricing", "#pricing"],
  ["Contact", "#contact"],
];

type NavbarProps = {
  onNavigate?: (href: string) => void;
  onLogin?: () => void;
  loginHref?: string;
  loginLabel?: string;
};

export default function Navbar({ onNavigate, onLogin, loginHref, loginLabel = "Log In" }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (href: string) => {
    setMenuOpen(false);
    if (onNavigate) {
      onNavigate(href);
    } else {
      window.location.hash = href.replace("#", "");
    }
  };

  const login = () => {
    setMenuOpen(false);
    onLogin?.();
  };

  const authControl = loginHref ? (
    <a href={loginHref} onClick={() => setMenuOpen(false)} className="hidden rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-2 sm:inline-flex sm:px-5">
      {loginLabel}
    </a>
  ) : (
    <button type="button" onClick={login} className="hidden rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-2 sm:inline-flex sm:px-5">
      {loginLabel}
    </button>
  );

  const mobileAuthControl = loginHref ? (
    <a href={loginHref} onClick={() => setMenuOpen(false)} className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
      {loginLabel}
    </a>
  ) : (
    <button type="button" onClick={login} className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
      {loginLabel}
    </button>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        {onNavigate ? (
          <button type="button" onClick={() => navigate("#top")} aria-label="ClearCFO home" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-4">
            <Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority />
          </button>
        ) : (
          <a href="#top" aria-label="ClearCFO home" className="shrink-0" onClick={() => setMenuOpen(false)}>
            <Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority />
          </a>
        )}

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map(([label, href]) => (
            <button key={href} type="button" onClick={() => navigate(href)} className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-4">
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {authControl}

          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 md:hidden"
          >
            <span className="sr-only">Menu</span>
            <span className="flex w-5 flex-col gap-1.5">
              <span className={`block h-0.5 w-full rounded-full bg-current transition-transform ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`block h-0.5 w-full rounded-full bg-current transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-full rounded-full bg-current transition-transform ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-5 pb-5 pt-3 shadow-lg md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col">
            {navItems.map(([label, href]) => (
              <button key={href} type="button" onClick={() => navigate(href)} className="border-b border-slate-100 px-1 py-4 text-left text-base font-semibold text-slate-700 transition-colors hover:text-blue-600">
                {label}
              </button>
            ))}
            {mobileAuthControl}
          </div>
        </div>
      )}
    </header>
  );
}
