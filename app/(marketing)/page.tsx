import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SERVICES } from "@/lib/catalog";
import { Faq } from "@/components/landing/Faq";
import { ProofGateHero } from "@/components/landing/ProofGateHero";
import { HomeBackdrop } from "@/components/fx/home-backdrop/HomeBackdrop";
import { Reveal } from "@/components/landing/Reveal";
import { ServiceIcon } from "@/components/landing/ServiceIcon";
import { TiltLink } from "@/components/landing/TiltLink";

export const metadata: Metadata = { title: "Pay once. Stay unlinkable." };

export default function HomePage() {
  return (
    // isolate: the fixed backdrop (-z-10) stacks inside main, above the body background.
    <main className="relative isolate mx-auto max-w-[1200px] px-4 sm:px-8">
      <HomeBackdrop />
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-20">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <i className="zeep-pulse inline-block h-1.5 w-1.5 rounded-full bg-ok" />
            Built on Zcash shielded payments
          </div>
          <h1 className="mt-[18px] text-[42px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[60px]">
            Pay once.
            <br />
            <span className="text-muted">Stay unlinkable.</span>
          </h1>
          <p className="mt-[22px] max-w-[470px] text-[17px] leading-relaxed text-muted">
            Deposit any amount of ZEC. Half stays as your ZEC, and half becomes dollars. Services are paid from the dollar balance, one zero-knowledge proof per request. Credits show both together.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/get" className="inline-flex items-center rounded-lg bg-gold px-[18px] py-3 text-[15px] font-medium text-on-gold transition-[background-color,transform] duration-150 hover:bg-gold-hover motion-safe:hover:-translate-y-px">
              Open a balance
            </Link>
            <Link href="/privacy" className="inline-flex items-center rounded-lg border border-line-strong px-[18px] py-3 text-[15px] font-medium transition-[background-color,transform] duration-150 hover:bg-line-strong motion-safe:hover:-translate-y-px">
              How it stays private
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 text-[13px] text-muted sm:grid-cols-3">
            <div><b className="mb-0.5 block text-[15px] font-medium text-text">No account</b>No email, no password</div>
            <div><b className="mb-0.5 block text-[15px] font-medium text-text">Withdraw any time</b>Two parts, about 10 and 20 min</div>
            <div><b className="mb-0.5 block text-[15px] font-medium text-text">One phrase</b>Wallet, balance, and chats</div>
          </div>
        </div>
        <ProofGateHero />
      </section>

      <section id="how" className="border-t border-line py-16">
        <Reveal>
          <p className="text-[13px] text-muted">How it works</p>
          <h2 className="mt-2.5 text-[32px] font-semibold tracking-[-0.025em]">Three steps, no identity.</h2>
        </Reveal>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Deposit any amount", "A fresh address, no memo. Pay from the in-app wallet or any other wallet. Whatever arrives is credited."],
            ["02", "One proof per request", "Each request spends dollars. The proof shows the payment, not who you are."],
            ["03", "Use it, or withdraw", "Four services share one private balance. Withdraw any amount above the minimum, in two parts about 10 and 20 minutes apart."],
          ].map(([n, title, body], index) => (
            <Reveal key={n} delay={index * 120} className="h-full">
              <div className="home-float h-full" style={{ "--float-delay": `${-index * 2.3}s` } as CSSProperties}>
                <article className="glass-1 glass-edge relative h-full rounded-2xl border border-line p-6 shadow-elev-2 transition-colors duration-(--dur-base) hover:border-gold/40">
                  <span className="inline-grid h-8 min-w-8 place-items-center rounded-lg border border-gold/30 bg-gold/10 px-2 font-mono text-[12px] text-gold">{n}</span>
                  <h3 className="mt-4 text-[17px] font-medium tracking-[-0.01em]">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
                </article>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="services" className="relative border-t border-line py-20">
        <div className="home-halo" aria-hidden="true" />
        <Reveal className="relative">
          <p className="text-[13px] text-muted">Services</p>
          <h2 className="mt-2.5 max-w-2xl text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[40px]">
            Four services,{" "}
            <span className="bg-linear-to-r from-gold via-gold-hover to-anon bg-clip-text text-transparent">one private balance.</span>
          </h2>
          <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
            Each request is paid from your dollar balance with its own zero-knowledge proof. The service sees what you asked, not who asked it.
          </p>
        </Reveal>
        <div className="relative mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, index) => (
            <Reveal key={service.id} delay={index * 110} className="h-full">
              <div className="home-float h-full" style={{ "--float-delay": `${-index * 1.8}s` } as CSSProperties}>
                <TiltLink
                  href={`/get?next=${encodeURIComponent(service.href)}`}
                  className="glass-1 glass-edge relative flex h-full min-h-[264px] flex-col rounded-2xl border border-line p-6 shadow-elev-2"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                    <ServiceIcon id={service.id} />
                  </span>
                  <h3 className="mt-6 text-[18px] font-medium tracking-[-0.01em]">{service.name}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{service.summary}</p>
                  <span className="mt-auto flex items-center justify-between gap-3 pt-6">
                    <span className="font-mono text-[12px] text-gold">Priced in credits</span>
                    <span className="home-arrow inline-flex items-center gap-1.5 text-[13px] font-medium text-text">
                      Open
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" />
                      </svg>
                    </span>
                  </span>
                </TiltLink>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200} className="relative mt-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/get" className="inline-flex items-center rounded-lg bg-gold px-[18px] py-3 text-[15px] font-medium text-on-gold transition-[background-color,transform] duration-150 hover:bg-gold-hover motion-safe:hover:-translate-y-px">
              Open a balance
            </Link>
            <p className="text-[14px] text-muted">One deposit pays for all four.</p>
          </div>
        </Reveal>
      </section>

      <Faq />
    </main>
  );
}
