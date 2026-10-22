# Zeep — Futuristic Design Spec

Oct 22, 2026 · Draft for review

## Purpose

This spec plans a radical UI/UX upgrade for the Zeep frontend: a clean, futuristic design system with real 3D, cinematic motion and top-tier finish. It is written against the code as it stands on `main` (commit `5db83f8`), not only against `docs/frontend-architecture.md`. Where the two disagree, the code wins, and section 2 lists the differences.

When this spec is adopted, it **replaces the "Design direction: Vault" and "Motion" sections** of `docs/frontend-architecture.md`. Those sections ban shadows, gradients, glow and self-moving UI. Everything else in that document still holds: the security model, the CSP, the routes, the storage layout and the proof engine are inputs to this spec, not things it may change.

## 1. Vision

**Name: Vault, Obsidian edition.** Zeep stays a security tool, and it looks like one: a precision instrument machined from dark glass and lit from inside by gold. The futurism comes from light, depth and physics, not from neon colour or noise.

**The core idea: colour is identity, and Zeep removes it.** The current landing canvas already tells this story: coloured dots (people) pass a gold proof gate and leave as identical white dots. This spec makes that metaphor the visual grammar of the whole product:

| Visual state | Meaning | Where it appears |
| --- | --- | --- |
| Warm, tinted, individual | Something that identifies you: phrase, PIN, keys, notes | Onboarding, unlock, the note book, the deposit before it confirms |
| Gold, emissive | The proof: the moment identity is exchanged for a payment | Proof gate, Send/Pay buttons, the balance |
| White, uniform, cool | What leaves the device: an unlinkable request | Request trails, receipts, service responses |

A user who never reads a word should still feel the product's promise: things go in coloured and come out anonymous.

**Three signature moments.** Each one gets the most motion budget, and everything else stays quiet so these land:

1. **The Proof Gate** (landing hero). A live 3D scene. Requests arrive as coloured particles, pass a rotating gold lattice (the Groth16 gate), and leave as identical white points along five lanes to five service monoliths. It reacts to the cursor and scroll, and narrates the product in about eight seconds.
2. **The Forge** (every paid request). While `client.pay` builds a proof in `workers/spend.worker.ts` (about 1–2 seconds), the Send button turns into a small gold forge: inputs converge, the lattice spins, a white mote is released. The animation is driven by the real proof state, never a timer.
3. **The Vault Door** (create, unlock, lock and network switch). Creating a vault seals a door. Unlocking opens it while Argon2id derives the key. Lock and the testnet/mainnet switch close it. These are the ceremonies around the user's secrets, so they feel heavy, mechanical and certain.

## Design principles

1. **Motion tells the truth.** An animation that says "proof verified" plays only when a proof was verified. Timers never stand in for real state. The landing scene keeps its "simulated live" label.
2. **Secrets stay still.** Phrase, PIN and reauth surfaces get almost no motion budget: no cursor effects, no scrambles, no canvas rendering of secret text (section 8).
3. **Light, not colour.** One accent stays gold. Depth, refraction, emissive edges and bloom carry the futurism. New hues appear only for semantic states (ok, warn, danger) and the pre-gate identity colours.
4. **Earned spectacle.** Heavy 3D lives on marketing pages and the three signature moments. App screens are fast instruments with lightweight depth (CSS 3D, SVG, Canvas 2D).
5. **Everything is self-hosted.** No CDN, no runtime fetch to a third party, no cloud 3D embeds. Every model, texture, decoder, font and script ships from this origin (the CSP and COEP require it).
6. **Graceful at every tier.** Every scene has a static poster, a reduced-motion state and a low-power tier. A five-year-old Android phone and a 120 Hz MacBook both get a finished product.
7. **Numbers are sacred.** Credits, ZEC, prices and addresses stay monospace, legible and copyable. Effects never blur, warp or delay a counted number past its settle time.

## 2. What the codebase audit found

Every file in `app/`, `components/`, `lib/`, `workers/`, `styles/` and the config was read. The architecture doc is accurate on the security model, routes, storage keys, proof engine and wallet. These findings change or constrain the redesign.

**Constraints the redesign must work inside**

| Fact in code | Consequence for design |
| --- | --- |
| `next.config.ts` CSP: `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`, `connect-src` limited to the APIs and lightwalletd, `font-src 'self'`, `img-src 'self' data: blob:` | Every 3D library, decoder, model, HDRI and font must ship from `/public` or the bundle. No `eval`-based libraries. |
| `Cross-Origin-Embedder-Policy: require-corp` and `CORP: same-origin` on every route | Third-party images, iframes and embeds fail to load. Same-origin assets only. |
| Pages are statically prerendered, and the App Router boots from inline scripts | 3D must be client-only (`next/dynamic`, `ssr: false`), and every scene needs a prerendered static poster so the first paint is never blank. |
| Proofs (`spend.worker.ts`), Argon2id (`kdf.worker.ts`, 64 MiB) and WebZjs (`wallet.worker.ts`, up to 4 threads) all run in workers | The main thread stays free for rendering, but CPU and memory are contended on phones. The render loop must back off while these run (section 5). |
| `ProofFlowCanvas` already pauses off-screen (IntersectionObserver), caps DPR at 2 and draws a still frame under reduced motion | Keep these patterns. They become requirements for every scene. |
| `NEXT_PUBLIC_LANDING_ANIMATION` gates the landing canvas | Generalise it into a site-wide FX level (section 9). |
| Busy states are plain strings ("Proving…", "Deriving key…", "Reserving an address…", "Finding your notes") | These are the real state hooks the Forge and Vault Door attach to. Every flow already exposes them. |
| All components style with Tailwind v4 utilities over the tokens in `styles/tokens.css` via `@theme inline` | New tokens are added the same way, so existing class names (`bg-surface`, `text-gold`, `border-line`) keep working during the migration. |
| `@radix-ui/*` (dialog, dropdown, tooltip) provides behaviour | Keep Radix for accessibility. Motion is layered on with `data-state` attributes and `forceMount`, not by replacing it. |

**Mismatches and loose ends to fix during the redesign**

These are small, but each touches a screen the redesign rebuilds, so fixing them in the same pass is cheaper.

1. **The nav label "Refunds" points to `/reserve`**, whose page is titled "Reserve: public books" (`SiteHeader.tsx` `PUBLIC`). Rename the link "Reserve".
2. **The footer's "Public reserve" is a `<span>`, not a link** (`SiteFooter.tsx`). Make it link to `/reserve`.
3. **The landing proof log shows the route `rpc/zcash`** (`ProofFlowCanvas.tsx` `ROUTES`), but the Chain service supports Ethereum, Base and Solana (`lib/catalog.ts` `CHAINS`). Use `rpc/ethereum` or similar.
4. **`/privacy` still uses the old credit-model words** "pass", "slot map", "which pass a proof came from" and "issued, used, refunded". The rest of the app says "balance", "notes" and "vault". Rewrite the copy when the page is rebuilt.
5. **The Health screen says "Look up a condition."** but offers only Drug and Trial lookups. Retitle it "Look up a drug or a trial."
6. **`lib/api/client.ts` and `lib/api/schemas.ts` are mostly legacy** (plans, leaves, refund tranches, `/v1/chain/call`). Only `api().reserve()` is used. Don't build new UI on them. Prune them in a separate cleanup.
7. **Dead code:** `@radix-ui/react-tabs` is installed but never imported. `components/ProofTag.tsx` is never used. `config.docsUrl` is no longer read since the FAQ replaced the Docs link. `phraseWords` is defined twice (`PhraseGrid.tsx` and `GetFlow.tsx`).
8. **Tokens missing from the doc:** `--on-gold` and `--raised` exist in `styles/tokens.css` but not in the architecture doc's token table. The new token set below documents everything.
9. **The secret-copy path is unused:** `CopyField` supports `secret` (clear the clipboard after 30 s), but nothing passes it, and `PhraseGrid` has no copy button. The doc's "copied recovery words are cleared" rule has no UI behind it. Decide deliberately (section 8 recommends no copy button for the phrase).
10. **The landing hero has no image**, so its Largest Contentful Paint element is the `<h1>` text. That is fast, and the 3D hero must not regress it (section 8).
11. **Working tree note:** after cloning, `package-lock.json` shows unstaged changes that strip `"libc"` fields (a different npm version rewrote it). This spec doesn't touch it. Pin the npm version in `package.json` `engines`/`packageManager` before adding the dependencies in section 9.
12. **`--faint` (#6F6B62) fails WCAG AA for text.** It measures about 3.6:1 on `--bg`, yet it is used for 12–13 px hints, the footer and empty-state copy. Section 3 raises it to at least 4.5:1.
