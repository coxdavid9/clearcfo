import Image from "next/image";

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
  loginLabel?: string;
};

export default function Navbar({ onNavigate, onLogin, loginLabel = "Log In" }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        {onNavigate ? (
          <button type="button" onClick={() => onNavigate("#top")} aria-label="ClearCFO home" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-4">
            <Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority />
          </button>
        ) : (
          <a href="#top" aria-label="ClearCFO home" className="shrink-0">
            <Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority />
          </a>
        )}

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map(([label, href]) =>
            onNavigate ? (
              <button key={href} type="button" onClick={() => onNavigate(href)} className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-4">
                {label}
              </button>
            ) : (
              <a key={href} href={href} className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-4">
                {label}
              </a>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          {onLogin ? (
            <button type="button" onClick={onLogin} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-2 sm:px-5">
              {loginLabel}
            </button>
          ) : onNavigate ? (
            <button type="button" onClick={() => onNavigate("#pricing")} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-2 sm:px-5">
              Log In
            </button>
          ) : (
            <a href="#top" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-2 sm:px-5">
              Log In
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}
