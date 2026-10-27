import type { Metadata } from "next";
import Link from "next/link";
import { SERVICES } from "@/lib/catalog";
import { Faq } from "@/components/landing/Faq";
import { ProofGateHero } from "@/components/landing/ProofGateHero";
import { ServiceCard } from "@/components/ServiceCard";

export const metadata: Metadata = { title: "Pay once. Stay unlinkable." };

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 sm:px-8">
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
        <p className="text-[13px] text-muted">How it works</p>
        <h2 className="mt-2.5 text-[32px] font-semibold tracking-[-0.025em]">Three steps, no identity.</h2>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Deposit any amount", "A fresh address, no memo. Pay from the in-app wallet or any other wallet. Whatever arrives is credited."],
            ["02", "One proof per request", "Each request spends dollars. The proof shows the payment, not who you are."],
            ["03", "Use it, or withdraw", "Five services share one private balance. Withdraw any amount above the minimum, in two parts about 10 and 20 minutes apart."],
          ].map(([n, title, body]) => (
            <article key={n} className="step-card h-full rounded-xl border border-line bg-surface p-6">
              <div className="font-mono text-[12px] text-gold">{n}</div>
              <h3 className="mt-3.5 text-[17px] font-medium tracking-[-0.01em]">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="services" className="border-t border-line py-16">
        <p className="text-[13px] text-muted">Services</p>
        <h2 className="mt-2.5 max-w-xl text-[32px] font-semibold tracking-[-0.025em]">Five services, one private balance.</h2>
        <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted">
          Each request is paid from your dollar balance with its own zero-knowledge proof. The service sees what you asked, not who asked it.
        </p>
        <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SERVICES.map((service) => (
            <ServiceCard
              key={service.id}
              name={service.name}
              summary={service.summary}
              cost="Priced in credits"
              className="last:sm:col-span-2 last:lg:col-span-1"
            />
          ))}
        </div>
      </section>

      <Faq />
    </main>
  );
}
