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

## 3. Design tokens

Tokens stay in `styles/tokens.css` and are exposed to Tailwind through `@theme inline` in `app/globals.css`, exactly as today. **Existing names keep their meaning**, so current components keep working while screens migrate one at a time. New tokens are additive.

### Colour

| Token | Value | Use | Change |
| --- | --- | --- | --- |
| `--void` | `#070706` | Behind 3D scenes and glass. The "space" the UI floats in | New |
| `--bg` | `#0B0B0A` | Page background | Darker (was `#0F0F0E`) to deepen the glass |
| `--surface` | `#131311` | Opaque panels, and the glass fallback | Was `#151513` |
| `--raised` | `#1B1A17` | Hover, selected rows, user chat bubbles | Documented |
| `--line` | `#24221F` | Hairline borders | — |
| `--line-strong` | `#312F2A` | Secondary button borders | — |
| `--text` | `#EEEAE3` | Primary text | Slightly brighter |
| `--muted` | `#8C877D` | Secondary text (≈5.4:1 on `--bg`) | — |
| `--faint` | `#827D73` | Hints (≥4.5:1 on `--bg`; verify with a checker) | **Raised** from `#6F6B62` (AA fix) |
| `--gold` | `#D9A441` | Primary actions, the balance, the proof | — |
| `--gold-hover` | `#E6B656` | Gold hover | — |
| `--gold-deep` | `#8F6418` | Shadow side of gold surfaces and lattice edges | New |
| `--gold-glow` | `rgb(217 164 65 / 0.35)` | Bloom tint, focus glow, emissive rims | New |
| `--on-gold` | `#141311` | Text on gold | Documented |
| `--anon` | `#F4F2EE` | Post-gate "anonymous" white: request trails, receipts | New |
| `--anon-glow` | `rgb(244 242 238 / 0.22)` | Glow for anonymous particles | New |
| `--ok` | `#9CB58A` | Confirmed | — |
| `--warn` | `#D98A41` | Testnet, shielding | — |
| `--danger` | `#D06B5C` | Errors, wiped vault | — |
| `--id-1` … `--id-6` | `#C9785D` `#7FA7C9` `#B58AC9` `#8FBF9A` `#C9B26A` `#C98AA6` | Pre-gate identity colours. **Scenes and identity surfaces only, never UI chrome** | New (taken from `ProofFlowCanvas` `COLORS`) |

Rule: gold appears where the user acts or a number is counted (unchanged from today). `--anon` appears only on things that have passed a proof. The `--id-*` colours appear only before the gate.

### Glass and depth

Glass is the main new material. It is a surface with translucency, background blur, a lit top edge and a hairline border.

| Token | Value |
| --- | --- |
| `--glass-1` | `rgb(19 19 17 / 0.72)` + `backdrop-filter: blur(16px) saturate(1.2)`. Header, cards over scenes |
| `--glass-2` | `rgb(27 26 23 / 0.62)` + `blur(24px)`. Modals, drawers, popovers |
| `--glass-edge` | `linear-gradient(180deg, rgb(255 255 255 / 0.09), rgb(255 255 255 / 0) 40%)`, painted as a 1px inner border via `mask` |
| `--elev-1` | `0 1px 0 rgb(255 255 255 / 0.04) inset, 0 12px 32px -16px rgb(0 0 0 / 0.7)` |
| `--elev-2` | `0 1px 0 rgb(255 255 255 / 0.05) inset, 0 24px 64px -24px rgb(0 0 0 / 0.8)` |
| `--elev-gold` | `0 0 0 1px rgb(217 164 65 / 0.5), 0 8px 32px -8px var(--gold-glow)`. Primary action at rest |

Glass rules:

- Text on glass must still pass 4.5:1 against the **worst-case** backdrop. The minimum opacity values above are chosen for that. Never go below them.
- `@media (prefers-reduced-transparency: reduce)` swaps every glass surface for the opaque `--surface` and drops the blur.
- Where `backdrop-filter` is unsupported, fall back to opaque `--surface` (an `@supports` guard).
- Don't stack more than two blurred layers. Blur is expensive on mobile GPUs.

### Type

| Role | Face | Sizes (desktop / phone) | Notes |
| --- | --- | --- | --- |
| Display | Inter variable (optical size), or one added display face (open decision below) | 96 / 48, 64 / 40 | Tracking `-0.045em`, weight 560–640. Hero headlines can animate weight on reveal |
| Heading | Inter | 44 / 32, 32 / 26, 20 / 18 | Tracking `-0.025em` |
| Body | Inter | 17, 15, 14 | Unchanged |
| Numeric | JetBrains Mono | 13–64 | **Always `font-variant-numeric: tabular-nums`**, so animated counters don't jitter |
| Label | JetBrains Mono | 11–12, uppercase, tracking `0.08em` | Kickers, step numbers, proof IDs |

Both faces stay self-hosted through `next/font` (`font-src 'self'`). **Open decision:** whether to add a single display face (for example Geist or Space Grotesk, loaded the same way) for the hero and section headings. The recommendation is to start with Inter's optical sizes and add a face only if the hero lacks character after the 3D work lands.

### Layout, radius and layers

- **Grid:** 12 columns. Content max 1200 px (unchanged), plus a 1440 px "bleed" width for hero scenes. 32 px gutters, 16 px on phones (unchanged).
- **Spacing:** 4 px base, with the 8 px scale for layout.
- **Radius:** `--r-xs 6`, `--r-sm 8` (buttons), `--r-md 12` (panels), `--r-lg 16`, `--r-xl 24` (hero cards), `--r-full`.
- **Z layers:** `--z-scene 0`, `--z-content 10`, `--z-header 30`, `--z-overlay 40`, `--z-modal 50`, `--z-toast 60`. These match the values already used by `SiteHeader`, the Radix overlays and `Toast`, and give them names.
