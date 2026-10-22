import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageIntro, Panel } from "@/components/Panel";

export const metadata: Metadata = { title: "Privacy" };

const SEES = [
  "A zero-knowledge proof and the request it pays for",
  "The prompt, search, or lookup itself, because that is the service",
  "The payout address of a withdrawal, only when you withdraw",
  "Public books: owed, held, coverage, deposits, and services, in dollars",
];

const CANNOT = [
  "Your PIN, recovery phrase, or spend key",
  "Which balance a proof was paid from",
  "Who paid for the credits",
  "Your notes, usage, or agent keys",
];

export default function PrivacyPage() {
  return (
    <Page>
      <PageIntro title="How it stays private" lede="The browser holds every secret. Vercel serves the pages, the circuit files, and the JavaScript. It does not see a request or a key." />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="text-[17px] font-medium">What Zeep receives</h2>
          <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-muted">
            {SEES.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Panel>
        <Panel>
          <h2 className="text-[17px] font-medium">What stays on this device</h2>
          <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-muted">
            {CANNOT.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Panel>
      </div>
      <div className="mt-4 grid gap-4">
        <Panel>
          <h2 className="text-[17px] font-medium">Frontier models</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">Open models run on Zeep. A frontier model is a different provider. That provider sees the prompt, not who sent it. The screen says so before you send.</p>
        </Panel>
        <Panel>
          <h2 className="text-[17px] font-medium">Two vaults</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">Testnet and mainnet are separate vaults. Switching networks locks the one you were using. A testnet balance cannot be shown or spent while mainnet is selected.</p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            The reserve that backs unused credits is public. <Link href="/reserve" className="text-text underline">Read the books.</Link>
          </p>
        </Panel>
      </div>
    </Page>
  );
}
