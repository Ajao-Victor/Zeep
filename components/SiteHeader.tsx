"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { config } from "@/lib/config";
import { cx } from "@/lib/cx";
import { SignOutDialog } from "@/components/account/SignOutDialog";
import { useVault } from "@/components/VaultState";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/ui/IconButton";

const PUBLIC = [
  { href: "/services", label: "Services" },
  { href: "/#how", label: "How it works" },
  { href: "/credits", label: "Refunds" },
  { href: "/#faq", label: "FAQ" },
];

const APP = [
  ["/services", "Services"],
  ["/ai", "AI"],
  ["/search", "Search"],
  ["/health", "Health"],
  ["/chain", "Chain"],
  ["/inbox", "Inbox"],
  ["/credits", "Credits"],
  ["/agents", "Agents"],
  ["/deposit", "Deposit"],
] as const;

function current(href: string, pathname: string) {
  return href === pathname;
}

function scrollToSection(href: string) {
  if (typeof window === "undefined") return;
  const id = href.startsWith("/#") ? href.slice(2) : "";
  const node = id ? document.getElementById(id) : null;
  if (!node) return;
  const header = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
  const top = node.getBoundingClientRect().top + window.scrollY - header - 16;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function onSectionLink(event: { preventDefault: () => void }, href: string) {
  if (typeof window === "undefined" || window.location.pathname !== "/" || !href.startsWith("/#")) return;
  event.preventDefault();
  window.history.replaceState(null, "", href);
  scrollToSection(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { view, lock } = useVault();
  const inApp = APP.some(([href]) => pathname === href);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const timer = window.setTimeout(() => scrollToSection(`/#${id}`), 50);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const link = activeRef.current;
    const scroller = link?.parentElement;
    if (!link || !scroller) return;
    const item = link;
    const bar = scroller;
    function centerActive() {
      const delta = item.getBoundingClientRect().left - bar.getBoundingClientRect().left;
      const left = bar.scrollLeft + delta - (bar.clientWidth - item.clientWidth) / 2;
      bar.scrollTo({ left: Math.max(0, left) });
    }
    centerActive();
    const observer = new ResizeObserver(centerActive);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 sm:gap-6 sm:px-8 lg:gap-8">
        <Link href="/" aria-label={config.appName} className="flex shrink-0 items-center gap-2.5 text-[18px] font-semibold tracking-[-0.02em]">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md border-[1.5px] border-gold text-[12px] text-gold">
            Z
          </span>
          <span className="max-[399px]:sr-only">{config.appName}</span>
        </Link>
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <IconButton variant="glass" label="Open menu" className="lg:hidden">
              <span className="flex w-3.5 flex-col gap-[3px]" aria-hidden="true">
                <span className="h-px bg-current" />
                <span className="h-px bg-current" />
                <span className="h-px bg-current" />
              </span>
            </IconButton>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-line bg-bg outline-none sm:w-[320px]">
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <Dialog.Title className="text-[15px] font-medium">Menu</Dialog.Title>
                <Dialog.Description className="sr-only">Services, how it works, refunds, and FAQ.</Dialog.Description>
                <Dialog.Close className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] text-muted hover:bg-raised hover:text-text">
                  Close
                </Dialog.Close>
              </div>
              <nav className="flex flex-col gap-1 overflow-y-auto p-3 text-[15px]">
                {PUBLIC.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => {
                      setMenuOpen(false);
                      onSectionLink(event, item.href);
                    }}
                    className={cx(
                      "rounded-lg px-3 py-3",
                      current(item.href, pathname) ? "bg-raised text-text" : "text-muted hover:bg-raised hover:text-text",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                {view.status === "unlocked" ? (
                  <>
                    <p className="px-3 pb-1 pt-4 text-[12px] text-faint">This balance</p>
                    {APP.filter(([href]) => href !== "/services").map(([href, label]) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className={cx(
                          "rounded-lg px-3 py-3",
                          current(href, pathname) ? "bg-raised text-text" : "text-muted hover:bg-raised hover:text-text",
                        )}
                      >
                        {label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setSignOutOpen(true);
                      }}
                      className="rounded-lg px-3 py-3 text-left text-muted hover:bg-raised hover:text-text"
                    >
                      Sign out
                    </button>
                  </>
                ) : null}
              </nav>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <nav className="hidden min-w-0 items-center gap-6 text-[14px] text-muted lg:flex">
          {PUBLIC.map((item) => (
            <Link key={item.href} href={item.href} onClick={(event) => onSectionLink(event, item.href)} className="hover:text-text">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        {view.status === "unlocked" ? (
          <div className="flex items-center gap-2 md:gap-1">
            <Tooltip.Provider delayDuration={200}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <Link href="/credits" className="shrink-0 whitespace-nowrap font-mono text-[13px] text-gold">
                    {view.creditLabel} cr
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="z-40 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-text">
                    <span className="block">Credits (dollars): {view.usdLabel}</span>
                    <span className="block">ZEC: {view.zecHeldLabel} ZEC ≈ {view.zecValueLabel}</span>
                    <span className="block">Total: {view.creditLabel} cr</span>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
            <IconButton label="Lock" className="md:hidden" onClick={() => void lock()}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </IconButton>
            <IconButton label="Sign out" className="max-[359px]:hidden md:hidden" onClick={() => setSignOutOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M10 5l3 3-3 3M13 8H6.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconButton>
            <Button variant="ghost" size="sm" className="shrink-0 whitespace-nowrap max-md:hidden" onClick={() => void lock()}>
              Lock
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0 whitespace-nowrap max-md:hidden" onClick={() => setSignOutOpen(true)}>
              Sign out
            </Button>
          </div>
        ) : (
          <Button href="/get" size="sm" className="shrink-0 whitespace-nowrap leading-none">
            <span className="max-[399px]:hidden">Open a balance</span>
            <span className="hidden max-[399px]:inline">Start</span>
          </Button>
        )}
      </div>
      {inApp && view.status === "unlocked" ? (
        <div className="border-t border-line">
          <nav className="mx-auto flex max-w-[1200px] gap-5 overflow-x-auto px-4 py-2 text-[13px] sm:px-8">
            {APP.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                ref={pathname === href ? activeRef : undefined}
                className={cx("shrink-0", pathname === href ? "text-text" : "text-muted hover:text-text")}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
      {config.network === "testnet" ? (
        <div className="border-t border-warn/40 bg-surface px-4 py-2 text-center text-[13px] text-warn">Testnet: test ZEC only</div>
      ) : null}
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </header>
  );
}
