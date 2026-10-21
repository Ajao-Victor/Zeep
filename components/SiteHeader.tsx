"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { config } from "@/lib/config";
import { cx } from "@/lib/cx";
import { NetworkToggle } from "@/components/NetworkToggle";
import { useVault } from "@/components/VaultState";

const PUBLIC = [
  { href: "/services", label: "Services" },
  { href: "/#how", label: "How it works" },
  { href: "/reserve", label: "Refunds" },
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

export function SiteHeader() {
  const pathname = usePathname();
  const { view, chooseNetwork, lock } = useVault();
  const inApp = APP.some(([href]) => pathname === href);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
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
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-1.5 px-4 sm:gap-6 sm:px-8 lg:gap-8">
        <Link href="/" aria-label={config.appName} className="flex shrink-0 items-center gap-2.5 text-[18px] font-semibold tracking-[-0.02em]">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md border-[1.5px] border-gold text-[12px] text-gold">
            Z
          </span>
          <span className="max-[399px]:sr-only">{config.appName}</span>
        </Link>
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line-strong text-text lg:hidden"
              aria-label="Open menu"
            >
              <span className="flex w-3.5 flex-col gap-[3px]" aria-hidden="true">
                <span className="h-px bg-current" />
                <span className="h-px bg-current" />
                <span className="h-px bg-current" />
              </span>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-line bg-bg outline-none sm:w-[320px]">
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <Dialog.Title className="text-[15px] font-medium">Menu</Dialog.Title>
                <Dialog.Description className="sr-only">Services, how it works, refunds, and docs.</Dialog.Description>
                <Dialog.Close className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] text-muted hover:bg-raised hover:text-text">
                  Close
                </Dialog.Close>
              </div>
              <nav className="flex flex-col gap-1 overflow-y-auto p-3 text-[15px]">
                {PUBLIC.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cx(
                      "rounded-lg px-3 py-3",
                      current(item.href, pathname) ? "bg-raised text-text" : "text-muted hover:bg-raised hover:text-text",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                {config.docsUrl ? (
                  <a href={config.docsUrl} className="rounded-lg px-3 py-3 text-muted hover:bg-raised hover:text-text" rel="noreferrer" onClick={() => setMenuOpen(false)}>
                    Docs
                  </a>
                ) : null}
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
                  </>
                ) : null}
              </nav>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <nav className="hidden min-w-0 items-center gap-6 text-[14px] text-muted lg:flex">
          {PUBLIC.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-text">
              {item.label}
            </Link>
          ))}
          {config.docsUrl ? (
            <a href={config.docsUrl} className="hover:text-text" rel="noreferrer">
              Docs
            </a>
          ) : null}
        </nav>
        <div className="flex-1" />
        <Tooltip.Provider delayDuration={200}>
          {view.network === "testnet" ? (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="hidden shrink-0 rounded border border-warn px-1.5 py-0.5 font-mono text-[11px] text-warn sm:inline">Testnet</span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="z-40 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-text">
                  A separate vault. Mainnet credits stay locked.
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ) : null}
        </Tooltip.Provider>
        <NetworkToggle network={view.network} onChange={(network) => void chooseNetwork(network)} />
        {view.status === "unlocked" ? (
          <div className="flex items-center gap-3">
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
            <button type="button" onClick={() => void lock()} className="shrink-0 text-[14px] text-muted hover:text-text">
              Lock
            </button>
          </div>
        ) : (
          <Link href="/get" className="shrink-0 whitespace-nowrap rounded-lg bg-gold px-3 py-2 text-[13px] font-medium leading-none text-on-gold transition-colors duration-150 hover:bg-gold-hover sm:px-3.5 sm:text-[14px]">
            <span className="max-[399px]:hidden">Open a balance</span>
            <span className="hidden max-[399px]:inline">Start</span>
          </Link>
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
    </header>
  );
}
