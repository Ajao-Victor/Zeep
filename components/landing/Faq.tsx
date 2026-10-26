const QUESTIONS = [
  {
    q: "What is a credit?",
    a: "A credit is one dollar of what you hold. The header adds your dollar notes to your ZEC at the live price, and shows that total. Open the balance to see the two parts: the dollar amount, and the ZEC with its dollar value.",
  },
  {
    q: "Why does the total change when I have not paid for anything?",
    a: "Half of every deposit stays as your ZEC, so that half follows the ZEC price. The dollar half is fixed once the deposit confirms. The credit total moves with the price, and it drops by the 1.5% conversion fee only when ZEC is turned into dollars.",
  },
  {
    q: "Can I deposit from an exchange?",
    a: "Yes. Each deposit gets a fresh Zcash address, and no memo is required, so any wallet can pay it. If an exchange can only send to a transparent address, the wallet card has one under “My exchange can't send to this address”. ZEC that lands there is shielded automatically.",
  },
  {
    q: "What are the 24 words for?",
    a: "They are the account. The same phrase restores the in-app Zcash wallet, the Zeep balance, and chats you chose to sync. Zeep cannot recover the words. Signing out removes the account from that device, and the words are the way back in.",
  },
  {
    q: "Where do my chats and files live?",
    a: "Chats are encrypted on this device. Sync is off until you turn it on, and the server then stores ciphertext only. Images and other files stay on the device where you added them. On another device, a missing file is marked as being on the device that has it.",
  },
  {
    q: "How do I withdraw?",
    a: "You enter an amount in ZEC, or tap Max. If your ZEC balance covers it, the withdrawal is scheduled immediately. If it needs more, you confirm a conversion of credits back to ZEC, with a 1.5% fee, which usually takes 20–60 minutes. The ZEC is sent in two parts, about 10 and 20 minutes apart. A transparent address makes the amount and recipient public, and the screen asks you to confirm that first.",
  },
  {
    q: "What does a request cost if my dollars run low?",
    a: "Each service has a price in credits, shown where you choose it. Paying spends the dollar balance, one proof per request. When that balance would run low, some of your ZEC is converted to dollars automatically, minus 1.5%. If the request still cannot be paid, the screen offers Add funds.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="border-t border-line pb-16 pt-8">
      <p className="text-[13px] text-muted">FAQ</p>
      <h2 className="mt-2.5 max-w-xl text-[32px] font-semibold tracking-[-0.025em]">Seven questions, answered.</h2>
      {/* Native disclosure: questions only until one is opened, with keyboard and screen-reader
          support and no JavaScript. */}
      <div className="mt-9 border-t border-line">
        {QUESTIONS.map((item, index) => (
          <details key={item.q} className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center gap-4 py-6 md:gap-8 [&::-webkit-details-marker]:hidden">
              <span className="w-5 flex-none font-mono text-[12px] text-gold">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="flex-1 text-[16px] font-medium tracking-[-0.01em]">{item.q}</h3>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                aria-hidden="true"
                className="flex-none text-muted transition-transform duration-(--dur-base) ease-(--curve-move) group-open:rotate-180"
              >
                <path d="M3 5.5 7 9.5 11 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p className="max-w-2xl pb-6 pl-9 text-[14px] leading-relaxed text-muted md:pl-13">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
