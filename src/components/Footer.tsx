const links = [
  ["Product", "#product"],
  ["How It Works", "#how-it-works"],
  ["What You Receive", "#what-you-receive"],
  ["Pricing", "#pricing"],
  ["Contact", "#contact"],
];

type FooterProps = {
  onNavigate?: (href: string) => void;
  tagline?: string;
};

function marketingHref(label: string, href: string) {
  if (label === "Contact") return "/contact";
  return href.startsWith("#") ? `/${href}` : href;
}

export default function Footer({ onNavigate, tagline = "Turning financial data into better decisions through financial intelligence, evidence, and action." }: FooterProps) {
  return (
    <footer id="footer" className="border-t border-slate-200 bg-slate-950 px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            {onNavigate ? (
              <button type="button" onClick={() => onNavigate("#top")} className="inline-flex rounded-lg text-xl font-bold tracking-tight focus-visible:ring-2 focus-visible:ring-blue-400">
                Clear<span className="text-blue-400">CFO</span>
              </button>
            ) : (
              <a href={marketingHref("ClearCFO", "#top")} className="inline-flex rounded-lg text-xl font-bold tracking-tight focus-visible:ring-2 focus-visible:ring-blue-400">
                Clear<span className="text-blue-400">CFO</span>
              </a>
            )}
            <p className="mt-3 text-sm leading-6 text-slate-400">{tagline}</p>
          </div>
          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:grid-cols-3">
            {links.map(([label, href]) =>
              onNavigate ? (
                <button key={href} type="button" onClick={() => onNavigate(href)} className="rounded-md text-left text-slate-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400">{label}</button>
              ) : (
                <a key={href} href={marketingHref(label, href)} className="rounded-md text-slate-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400">{label}</a>
              )
            )}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ClearCFO. All rights reserved.</p>
          <p>Built for owners who want to know what matters.</p>
        </div>
      </div>
    </footer>
  );
}
