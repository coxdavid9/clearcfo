import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearCFO | AI-Powered Financial Intelligence",
  description: "Turn financial data into clear insights, prioritized actions, and better business decisions with ClearCFO.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const removeFileAcceptFilter = () => {
                  document
                    .querySelectorAll('input[type="file"][accept]')
                    .forEach((input) => input.removeAttribute("accept"));
                };

                removeFileAcceptFilter();

                new MutationObserver(removeFileAcceptFilter).observe(document.documentElement, {
                  childList: true,
                  subtree: true,
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
