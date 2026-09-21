"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import CompanySwitcher from "./CompanySwitcher";

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
  signupHref?: string;
  signupLabel?: string;
  profileHref?: string;
  sessionAware?: boolean;
  hideProfile?: boolean;
};

export default function Navbar({ onNavigate, onLogin, loginHref, loginLabel = "Log In", signupHref, signupLabel = "Sign Up", profileHref, sessionAware = false }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (!sessionAware) return;
    let active = true;
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (active) setAuthenticated(data?.authenticated === true);
      } catch {
        if (active) setAuthenticated(false);
      }
    };
    void checkSession();
    const interval = window.setInterval(checkSession, 10 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [sessionAware]);

  const navigate = (href: string) => {
    setMenuOpen(false);
    if (onNavigate) onNavigate(href);
    else window.location.href = `/${href}`;
  };

  const login = () => {
    setMenuOpen(false);
    onLogin?.();
  };

  const unauthenticatedAuthControl = (
    <div className="hidden items-center gap-3 sm:flex">
      {signupHref && <a href={signupHref} onClick={() => setMenuOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-600 hover:shadow-md sm:px-5">{signupLabel}</a>}
      {loginHref ? <a href={loginHref} onClick={() => setMenuOpen(false)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md sm:px-5">{loginLabel}</a> : <button type="button" onClick={login} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md sm:px-5">{loginLabel}</button>}
    </div>
  );

  const authenticatedAuthControl = (
    <div className="hidden items-center gap-3 sm:flex">
      <CompanySwitcher />
      <a href="/customer/briefing" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100 hover:shadow-md sm:px-5">CFO Briefing</a>
      <a href="/alerts" className="px-1 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-600">Alerts &amp; reports</a>
      <a href={profileHref ?? "/profile"} className="px-1 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-600">Account</a>
      <a href="/api/auth/logout" onClick={() => setMenuOpen(false)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md sm:px-5">Log Out</a>
    </div>
  );

  const authControl = sessionAware && authenticated ? authenticatedAuthControl : unauthenticatedAuthControl;

  const showMarketingNav = !(sessionAware && authenticated);

  const mobileAuthControl = sessionAware && authenticated ? (
    <>
      <a href="/customer/briefing" onClick={() => setMenuOpen(false)} className="border-b border-slate-100 px-1 py-4 text-left text-base font-semibold text-blue-600">CFO Briefing</a>
      <a href="/alerts" onClick={() => setMenuOpen(false)} className="border-b border-slate-100 px-1 py-4 text-left text-base font-medium text-slate-700 transition-colors hover:text-blue-600">Alerts &amp; reports</a>
      <a href={profileHref ?? "/profile"} onClick={() => setMenuOpen(false)} className="border-b border-slate-100 px-1 py-4 text-left text-base font-medium text-slate-700 transition-colors hover:text-blue-600">Account</a>
      <a href="/api/auth/logout" onClick={() => setMenuOpen(false)} className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">Log Out</a>
    </>
  ) : (
    <>
      {signupHref && <a href={signupHref} onClick={() => setMenuOpen(false)} className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600">{signupLabel}</a>}
      {loginHref ? <a href={loginHref} onClick={() => setMenuOpen(false)} className="mt-3 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">{loginLabel}</a> : <button type="button" onClick={login} className="mt-3 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">{loginLabel}</button>}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        {onNavigate ? (
          <button type="button" onClick={() => navigate("#top")} aria-label="ClearCFO home" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-4"><Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority /></button>
        ) : (
          <a href="/" aria-label="ClearCFO home" className="shrink-0" onClick={() => setMenuOpen(false)}><Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority /></a>
        )}

        {showMarketingNav && (
        <div className="hidden items-center gap-8 md:flex">
          {navItems.map(([label, href]) => onNavigate ? <button key={href} type="button" onClick={() => navigate(href)} className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-4">{label}</button> : <a key={href} href={`/${href}`} onClick={() => setMenuOpen(false)} className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600">{label}</a>)}
        </div>
        )}

        <div className="flex items-center gap-3">
          {authControl}
          <button type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 md:hidden">
            <span className="sr-only">Menu</span>
            <span className="flex w-5 flex-col gap-1.5"><span className={`block h-0.5 w-full rounded-full bg-current transition-transform ${menuOpen ? "translate-y-2 rotate-45" : ""}`} /><span className={`block h-0.5 w-full rounded-full bg-current transition-opacity ${menuOpen ? "opacity-0" : ""}`} /><span className={`block h-0.5 w-full rounded-full bg-current transition-transform ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} /></span>
          </button>
        </div>
      </nav>

      {menuOpen && <div className="border-t border-slate-200 bg-white px-5 pb-5 pt-3 shadow-lg md:hidden"><div className="mx-auto flex max-w-7xl flex-col">{showMarketingNav && navItems.map(([label, href]) => onNavigate ? <button key={href} type="button" onClick={() => navigate(href)} className="border-b border-slate-100 px-1 py-4 text-left text-base font-semibold text-slate-700 transition-colors hover:text-blue-600">{label}</button> : <a key={href} href={`/${href}`} onClick={() => setMenuOpen(false)} className="border-b border-slate-100 px-1 py-4 text-left text-base font-semibold text-slate-700 transition-colors hover:text-blue-600">{label}</a>)}{mobileAuthControl}</div></div>}
    </header>
  );
}
