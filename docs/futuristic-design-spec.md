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

## 4. Motion system

Motion has three registers. Each screen picks one, and only the signature moments use the third.

| Register | Character | Where |
| --- | --- | --- |
| **Instrument** | Fast, precise, under 250 ms, no overshoot | App screens: inputs, menus, toggles, toasts, chat |
| **Mechanism** | Weighted springs, a slight settle, 300–700 ms | Panels entering, steppers, the balance counter, the network switch |
| **Cinematic** | Choreographed timelines, 0.8–3 s, scroll-linked or state-linked | The Proof Gate, the Forge, the Vault Door, the landing scroll story |

### Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--dur-instant` | 90 ms | Press feedback |
| `--dur-quick` | 150 ms | Colour and opacity changes (today's button timing) |
| `--dur-base` | 240 ms | Menus, tooltips, small layout changes |
| `--dur-slow` | 420 ms | Panels, modals, route content |
| `--dur-cinematic` | 900 ms+ | Signature moments |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Default for entering (expo-out) |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Moving between two places |
| `--ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Leaving (always shorter than entering) |
| `spring.snappy` | stiffness 500, damping 38 | Toggles, chips, the PIN dots |
| `spring.weighty` | stiffness 220, damping 28, mass 1.2 | Panels, the vault door, cards |
| `spring.float` | stiffness 60, damping 14 | Ambient drift in scenes |

The CSS values live in `styles/tokens.css`. The spring presets live in `lib/motion/tokens.ts`, shared by Motion (DOM) and the 3D scenes, so DOM and WebGL move with the same physics.

### Choreography rules

- **Stagger** lists at 40 ms per item. Cap a stagger at 8 items; later items appear with the eighth.
- **Enter from where the user's attention is.** A modal scales from its trigger (Radix exposes the trigger rect). A toast rises from the bottom edge. A route's content rises 12 px and fades.
- **Exit faster than enter**, roughly 60% of the entry duration.
- **One hero motion per viewport.** If the Proof Gate is on screen, nothing else animates on its own.
- **Never animate layout-thrashing properties.** Transform, opacity, filter and clip-path only. Height animations use the `grid-template-rows: 0fr → 1fr` technique (FAQ, settings).
- **No flashing.** Nothing flashes more than three times per second (WCAG 2.3.1). Bloom pulses are slow (≥ 1.2 s) and low contrast.
- **Numbers settle fast.** An animated counter reaches its final value within 600 ms and is never mid-roll when the user can act on it.

### Route transitions

Use the browser View Transitions API (`document.startViewTransition`) for same-document route changes where it is supported, with Next's built-in view-transition support when it is stable in the installed Next 15 version. Named elements carry across routes:

- The header balance (`view-transition-name: balance`) morphs into the big balance on `/credits` and `/services`.
- A service card morphs into its screen's header when opened from `/services`.
- Unsupported browsers get a plain 240 ms fade. Reduced motion gets an instant swap.

### Micro-interactions

| Element | Interaction |
| --- | --- |
| Primary button | Gold sheen sweeps across on hover (a masked gradient, 700 ms). A 2 px press-in on `:active`. A soft magnetic pull toward the cursor (max 4 px) on desktop marketing pages only |
| Secondary button | Hairline border brightens to `--line-strong` → `--gold` at 40% opacity |
| Inputs | Focus draws the gold ring from the left edge (clip-path, 240 ms). Invalid shakes 3 × 4 px once |
| Balance in the header | An odometer roll per digit when the note book changes (`emit()` in `lib/vault/session.ts`). Down-rolls tint `--muted` for 600 ms, up-rolls tint `--gold` |
| Copy buttons | "Copy" → check icon draws itself (SVG stroke-dashoffset) → back after 1.5 s (today's timing) |
| Toggles and segmented controls | A gold pill slides between options with `spring.snappy` (network toggle, Drug/Trial, chain chips) |
| Toasts | Rise and un-blur (8 px → 0) in, fall and blur out. Danger toasts get one 4 px horizontal nudge |
| Cards | 3D tilt toward the cursor (max 6°), with a specular highlight following it. Desktop only, and never on secret screens |

### Reduced motion

`prefers-reduced-motion: reduce` is honoured everywhere, as it is today:

- Cinematic and Mechanism registers fall back to opacity crossfades of ≤ 150 ms.
- Scenes render one still frame (the existing `ProofFlowCanvas` behaviour) and stop their loop.
- Counters jump straight to the value. Tilt, magnetic pull and parallax are off.
- Smooth scrolling (Lenis) is not started.

## 5. 3D system

### Where 3D runs

| Surface | Technique | Why |
| --- | --- | --- |
| `/` landing: Proof Gate hero and scroll story | WebGL (three.js via React Three Fiber) | The flagship. Worth the bundle on a marketing page |
| `/privacy`: the Membrane | WebGL, reusing the Proof Gate engine with a different config | Same engine, no extra bundle |
| The Forge (every paid request) | Canvas 2D + CSS 3D | Runs on app routes, which must stay light and fast |
| The Vault Door (`/get`, `/unlock`, `/restore`, lock, network switch) | CSS 3D transforms + SVG (layered rings, conic gradients) | Must start instantly while Argon2id is using 64 MiB in a worker |
| Balance Core (`/credits`, `/services`) | SVG + CSS 3D | Two-part orb, cheap enough to sit on every visit |
| Cards, buttons, tilt | CSS 3D (`perspective`, `rotateX/Y`) | No WebGL needed |

**Rule: three.js is loaded only on marketing routes** (`app/(marketing)/*`). App routes never import it, so the vault, chat and payment screens stay fast on every device.

### Scene 1: the Proof Gate (landing)

The current `ProofFlowCanvas` story, rebuilt in 3D.

- **Gate.** An icosahedral lattice ring made of instanced thin bars, in a gold metal material (`MeshPhysicalMaterial`, metalness 1, roughness 0.28, clearcoat). Its rim is emissive and brightens when a request passes and when the cursor is near (as today). Inside the ring sits an "event horizon" disc: a custom shader with screen-space refraction and slow noise distortion. That is cheaper than true transmission and reads the same.
- **Requests.** GPU-driven particles (instanced points, positions computed in the vertex shader with curl noise), so the CPU only updates uniforms. Before the gate they take the `--id-*` colours with soft trails. Crossing the gate's plane, they flash gold for one frame-group, then turn `--anon` white, shrink slightly and snap into five lanes.
- **Services.** Five thin glass monoliths, one per lane, labelled Private AI, Search, Health, Chain and Inbox. **Labels are DOM overlays** positioned from 3D coordinates, not 3D text. That keeps them crisp, accessible and translatable, and avoids loading font files into WebGL.
- **Interaction.** The camera orbits ±4° with the pointer. Particles move away from the cursor (as today). Clicking the gate fires a proof pulse: a ring of light, a burst of white motes and one new line in the proof log.
- **DOM layer.** The proof log, the "requests verified" and "0 linked to a person" counters and the "simulated live" label stay as DOM over the scene, in glass panels.
- **Lighting.** `RoomEnvironment` + PMREM, generated in code. No HDRI download.
- **Post-processing** (by tier): selective bloom on emissive parts only, a vignette, AgX tone mapping, very low film grain, and a slight chromatic aberration at the frame edges at the top tier.

**Scroll story ("How it works").** On desktop the scene pins while the three steps scroll past, and the camera travels:

1. **Deposit any amount.** A ZEC coin drops in and splits: one half stays a ZEC coin, the other becomes a gold dollar coin, and a thin 1.5% shard breaks off it. The real 50/50 split and conversion fee, shown.
2. **One proof per request.** The camera flies through the gate with a request. The world goes from colour to white.
3. **Use it, or withdraw.** The camera pulls back to the five monoliths. Then two beams leave for a withdrawal, about 10 and 20 minutes apart (the two tranches), shown as two pulses.

On phones nothing pins. Each step plays its beat once when scrolled into view, at the lite tier, and the step cards carry the explanation.

### Scene 2: the Membrane (`/privacy`)

The same engine with two chambers separated by a glowing membrane. "What Zeep receives" particles (proof, request, refund address, public books) pass through as white. "What stays on this device" particles (PIN, phrase, identity, usage) stay on the left, coloured, and bounce softly off the membrane. Each list item on the page highlights its particle on hover.

### Rendering tiers

| Tier | Gets | Chosen when |
| --- | --- | --- |
| **T0 Still** | A prerendered AVIF poster of the scene and the full DOM content | Reduced motion, `Save-Data`, no WebGL, the FX flag set to `off`, or WebGL context loss |
| **T1 Lite** | The Canvas 2D version (today's `ProofFlowCanvas`, upgraded to the new palette and trails) | WebGL1 only, `deviceMemory` ≤ 2, ≤ 4 cores on a phone, or sustained FPS under 30 at T2 |
| **T2 Standard** | WebGL2, about 1,500 particles, vignette only, DPR ≤ 1.5 | The default for capable phones and laptops |
| **T3 Ultra** | About 6,000 particles, trails, selective bloom, chromatic aberration, DPR ≤ 2 | Desktop-class GPUs that hold 55+ FPS at T2 for 3 seconds |

- The first guess uses `hardwareConcurrency`, `deviceMemory`, WebGL2 support and the screen size. A runtime FPS monitor then moves one tier up or down, with hysteresis so it doesn't flap.
- **Don't use `detect-gpu`'s defaults.** It downloads benchmark data from a CDN, which the CSP blocks. If GPU detection is needed, self-host its data files or skip it.
- The chosen tier is remembered in the existing `prefs` record in IndexedDB (no personal data, the same as the network choice), so a returning visitor starts on the right tier.

### Render loop rules

- **One WebGL context per page.** Use a single fixed `<Canvas>` behind the content, with drei `View` for any extra viewports. Never a canvas per section.
- **Render only when it matters.** `frameloop="always"` only while the scene is on screen. Otherwise switch to `"demand"` or stop. Keep today's IntersectionObserver pause.
- **Back off when the device is busy.** Halve the frame rate and drop a tier while the prover, the Argon2id KDF or the wallet worker is running. `lib/zeep/prove.ts`, `lib/vault/kdf.ts` and `lib/zcash/wallet.ts` each expose a small "busy" signal for this.
- **Stop when the tab is hidden** (`visibilitychange`).
- **Handle context loss.** On `webglcontextlost`, show the T0 poster and don't retry until the next navigation.
- **Dispose** geometries, materials and render targets on unmount.

### Asset rules

- Everything lives under `/public/fx/` and is served same-origin. CSP and COEP leave no alternative.
- **Prefer procedural geometry.** The gate, particles, lanes and monoliths are all generated in code. The target is zero glTF files for the landing page.
- If a model is ever needed, compress it with **Meshopt** (its decoder ships as JavaScript in the bundle). If Draco or KTX2 are used, **self-host the decoders** under `/public/fx/decoders/` and point the loaders at them. drei's `useGLTF` defaults the Draco decoder to a Google CDN, which the CSP blocks.
- **Never use drei `<Environment preset="…">`.** The presets download HDRIs from a CDN. Use `RoomEnvironment` or self-hosted files.
- **Avoid 3D text.** If it is ever needed, drei `<Text>` must be given a self-hosted font file, because troika's default font comes from a CDN.
- **Budget:** at most 600 KB of scene assets at T2, textures at most 1024 px, and posters at most 120 KB AVIF each.

## 6. Component primitives

Every screen is rebuilt from a small set of primitives. Each row maps a new primitive to the component it replaces or extends, so the migration path is explicit.

| Primitive | Replaces / extends | What changes |
| --- | --- | --- |
| `Surface` | `Panel` (`components/Panel.tsx`) | Variants `solid`, `glass-1`, `glass-2`, `hero`. Props for elevation and the lit edge. `Panel` becomes a thin alias during the migration |
| `Button` | `components/Button.tsx` | Variants `primary` (gold with `--elev-gold` and the hover sheen), `secondary` (glass), `ghost`, `danger`. New `busy` and `phase` props for the Forge. Keeps the `href` → `Link` behaviour |
| `ProofButton` (the Forge) | Every "Proving…" button: chat Send, Search, Look up, Call, Open an inbox, Transfer, Withdraw | Shows the live proof phase (below). Width stays fixed so the layout never jumps |
| `Counter` | Plain balance strings (`view.creditLabel` and others) | Per-digit odometer, tabular mono, settles within 600 ms, `aria-live="polite"` announces only the final value |
| `BalanceCore` | The balance blocks on `/services` and `/credits` | A two-part orb: a solid gold core for dollars and a translucent shell for ZEC, sized by their share of the total. Hover or tap shows the existing tooltip split |
| `StatusRail` | The deposit `Notice` and the withdrawal status lines | Deposit: waiting → confirming 1/3, 2/3, 3/3 → credited. Withdrawal: converting → scheduled → paying → done, with a node per tranche and its txid |
| `Receipt` | Nothing today (`ProofTag.tsx` is unused) | A local-only proof receipt after each paid request: route, cost in credits and the short tag. Revives `ProofTag`. Never sent anywhere |
| `Field` | `TextField` | Floating label, gold focus line, a `mono` variant for amounts and addresses, and an inline address badge (shielded, transparent, invalid) driven by `addressKind()` as the user types |
| `Segmented` | `NetworkToggle`, the Drug/Trial pills, the chain chips | A sliding gold pill with `spring.snappy`. Keeps `aria-pressed` |
| `Dialog` | `Modal`, `SignOutDialog`, chat `SettingsDialog` | One glass-2 dialog. Scales from its trigger, backdrop blur, Radix behaviour unchanged |
| `Drawer` | The mobile menu in `SiteHeader`, the chat history drawer | Slides with `spring.weighty`, the page behind recedes (scale 0.98, dim) |
| `Toast` | `components/Toast.tsx` | Glass, rise-and-unblur entry, a tone icon. Same API (`useToast()(text, tone)`) |
| `TiltCard` | `ServiceCard` and the landing step cards (`.step-card`) | CSS 3D tilt with a specular highlight. The `scale(1.02)` hover stays for touch devices |
| `PhraseGrid` | `components/PhraseGrid.tsx` | Words stay blurred until the user presses and holds "Reveal" (shoulder-surfing protection), then appear in sequence with an opacity-only fade. See section 8 |
| `PinPad` | `components/PinPad.tsx` | Glass keys, uniform press feedback, dots that fill with `spring.snappy`, an optional short vibration on Android. See section 8 |
| `SceneFrame` | The wrapper in `ProofFlowCanvas` | Picks the tier, shows the poster, lazy-loads the scene, pauses off-screen and carries the accessible description |
| `SiteHeader` | `components/SiteHeader.tsx` | Glass that condenses from 64 to 52 px on scroll. Balance becomes a `Counter`. The network switch plays the Vault Door transition |

### The Forge: proof phases

`client.pay` is a single promise, and `lib/zeep` is a copy of the backend SDK that should stay unmodified. The phases therefore come from the edges the app already owns, with no SDK change:

| Phase | Signal | Visual |
| --- | --- | --- |
| `preparing` | The button's handler has called `client.pay` (or `payJson`) and the prover has not started | Inputs (coloured motes) gather at the button's left edge |
| `proving` | `workerProve` in `lib/zeep/prove.ts` posts a `prove` message (emit "start") | The motes converge into a spinning gold lattice. Label: "Proving…" (today's copy) |
| `sending` | `workerProve` resolves (emit "end") and the request is in flight | The lattice collapses into one white mote that leaves to the right |
| `settled` | The `pay` promise resolves with an OK response | A check draws itself. The header `Counter` rolls down. A `Receipt` appears |
| `failed` | The promise rejects, or `isFundsError` | A short shake and the existing error text. A funds error shows "Add funds", as today |

A small event emitter in `lib/zeep/prove.ts` (the app's own file, not part of the copied SDK) publishes "start" and "end". Merges and staged refills also prove, so one click can show the lattice spin more than once. That is honest, since each spin is a real proof.

## 7. Screen by screen

Every route from the architecture doc's route table, plus the shell. "Register" refers to section 4.

### Shell

- **Header.** Glass-1 over the page, condensing on scroll. The logo mark becomes a small gold lattice glyph that turns 60° on route changes. Public links: Services, How it works, **Reserve** (renamed from "Refunds"), FAQ. On the right: the testnet badge, the `Segmented` network switch, then either the balance `Counter` with Lock and Sign out, or the gold "Open a balance" button ("Start" under 400 px, as today).
- **App nav.** The horizontal scroller under the header gets a gold underline that slides between items (shared layout animation) and edge fades where it scrolls. The active-item centring logic in `SiteHeader` stays.
- **Footer.** Hairline top border with a slow gold light travelling along it (T2+ only). "Public reserve" becomes a link to `/reserve`. The commit hash stays in mono.
- **404.** The lattice glyph, cracked and drifting slowly. "This page is not here." and a gold link home. No glitch or flash effects.
- **Ambient background.** On app routes, a very faint `--void` vignette and one slow, low-contrast gold light leak in a corner (CSS radial gradient, no animation under reduced motion). No WebGL.

### `/` Landing (Cinematic)

1. **Hero.** Full-bleed Proof Gate scene (1440 px). The headline "Pay once. / Stay unlinkable." reveals line by line, with a weight animation from 400 to 600 and a mask wipe. The lede and the two buttons rise after. The three facts (No account, Withdraw any time, One phrase) sit in a glass strip at the bottom edge. The "Built on Zcash shielded payments" kicker keeps its pulsing green dot.
2. **"Three steps, no identity."** The pinned scroll story from section 5. The three step cards are glass `TiltCard`s that light up in turn as the camera reaches each beat.
3. **Five services.** The five monoliths come forward. Each service card shows its name and summary, and "Priced in credits" in gold mono. Hovering a card lights its lane in the scene.
4. **FAQ.** The seven questions keep their numbered layout. Answers expand with the `grid-template-rows` technique, and the number turns gold when open. All questions stay in the DOM for search engines and find-in-page.
5. **Closing call to action.** A new final band: the gate seen head-on, slowly rotating, with "Open a balance" and the reserve coverage figure (from the public `/v1/reserve`, cached by TanStack Query) as a live trust signal.

### `/privacy` (Cinematic, lighter)

The Membrane scene at the top. Below it, the two lists side by side as glass panels: "What Zeep receives" in `--anon` white and "What stays on this device" in warm tints. Hovering an item highlights its particle. **Rewrite the copy** to the current model (balance, notes, vault), replacing "pass" and "slot map" (audit finding 4). The "Frontier models" and "Two vaults" panels follow, with a link to `/reserve`.

### `/reserve` (Mechanism)

A public dashboard, readable without a vault.

- A large **coverage gauge**: an SVG arc with a gold fill sweeping to `coverage_pct`, the percentage in big mono and a glass halo.
- **Owed** and **Held** as two vertical columns whose heights animate to their values, so the gap (or surplus) is visible at a glance.
- **Deposits** and **Services** totals as `Counter`s.
- The error state ("The public books are unreachable from this browser.") as a calm glass notice with a retry button, not a red alarm.

### `/get` Open a balance (Mechanism, ceremony at the end)

A four-step stepper (Welcome, Phrase, PIN, Deposit), shown as a thin rail with nodes that fill gold as steps complete.

- **Welcome.** Two large glass choices: "Create a new account" and "Sign in with 24 words".
- **Phrase.** The 24 words in a 3 × 8 grid, blurred until press-and-hold. Then the quiz for words 3, 12 and 21. Each correct answer locks its tile with a gold edge. A wrong one gives a single shake and the existing error copy.
- **PIN.** The new `PinPad`, entered twice. "Also use fingerprint" is a secondary glass button with a fingerprint glyph that draws itself.
- **Vault creation.** While `createVault` runs ("Saving the vault…"), the **Vault Door seals**: concentric rings rotate into alignment, bolts slide in, and a gold seam closes. It plays once and is tied to the real promise.
- **Deposit.** The deposit panel (see `/deposit`) with "Skip for now".
- If the network already has a balance (locked or unlocked), show the existing message on a glass panel with the door shown closed.

### `/unlock` (Mechanism)

The Vault Door, closed, centred above the `PinPad`. When the user submits, the door's rings start turning in time with "Deriving key…" (the Argon2id worker). On success they align and the door swings open into the next route (`next` param, as today). On a wrong PIN the rings jolt back, and the "N tries left" message appears. **At one try left, the door's seam turns `--warn`.** On the wipe, the door greys out and the restore notice appears. "Unlock with fingerprint" sits above the pad when a passkey exists.

### `/restore` (Mechanism)

24 slots in a grid. Pasting a whole phrase into any slot fills the rest in sequence (the existing `fillWords` behaviour) with a quick cascade. Invalid phrases shake the grid once. During `restoreVault`, the progress messages ("Scanning N notes in tree X", "Finding deposits", "Checking spent notes", "Restoring the wallet", "Restoring chats") become a `StatusRail`, with a determinate bar for the note scan. The result ("Restored. $X in dollars and Y ZEC.") lands as two `Counter`s rolling up.

### `/services` (Mechanism)

`BalanceCore` at the top with the credit total as a big `Counter` and the Deposit button. Below it, the five services as `TiltCard`s in a 2 × 3 grid (the sixth cell stays "Next: same proof, same balance"). Each card shows its live price from `/v1/prices` and a faint lane line that echoes the landing scene.

### `/ai` Private AI (Instrument)

The chat keeps its structure (48 px rail and 272 px sidebar from 640 px up, a drawer below), restyled in glass.

- **Empty thread.** "No identity on this chat." with a small, slowly rotating lattice glyph above it (CSS 3D).
- **Messages.** User messages in `--raised` glass bubbles, assistant text on the page with no bubble. Streamed tokens fade in per chunk (opacity only, 120 ms). The assistant's model name in faint mono under each reply.
- **Composer.** A glass bar that lifts 2 px on focus. The Send button is a `ProofButton`, so the Forge plays in the composer during each paid request. Attachments are glass chips with thumbnails, and a drag-over shows a gold dashed drop zone.
- **Model picker.** A glass dropdown with prices in gold mono and the "reads images" badge. The auto-switch-to-vision toast stays.
- **Rules.** No autoplaying effects in the thread, and no scroll hijacking. Reduced motion shows tokens without fades.

### `/search`, `/health`, `/chain` (Instrument): the Service Console

The three single-request services share one template:

1. A header with the service name, a one-line description and the live price in credits.
2. One large `Field` with the `ProofButton` attached to its right edge (a command-bar look). Health adds the Drug/Trial `Segmented` control, and Chain adds the chain `Segmented` control and a Params JSON field in mono.
3. A results area. Search results are glass cards whose titles are gold links. Health and Chain responses appear in a mono code panel with syntax tints and a copy button.
4. A `Receipt` under the result.

Fix the Health title to "Look up a drug or a trial." (audit finding 5).

### `/inbox` (Instrument)

Before an inbox exists: a single glass card, "An address with no name on it.", with the `ProofButton` "Open an inbox". After: the address in a mono `CopyField` and messages as glass rows that stagger in on refresh. An empty refresh says so plainly.

### `/deposit` (Mechanism)

- **Wallet card.** A glass card with a subtle holographic edge (a conic-gradient border that shifts with device tilt or the pointer, T2+). The shielded balance as a `Counter`. The unified address in a `CopyField`. "My exchange can't send to this address" reveals the transparent address with a height animation. "Shielding 0.0x ZEC…" shows a slow shimmer on the balance.
- **Amount and estimate.** The ZEC amount in a mono `Field`. The estimate renders as a **split bar**: the part kept as ZEC and the part converted to dollars, with the conversion fee as a thin slice, updating live as the user types. The "Estimate" note stays.
- **Payment.** The QR sits in a glass frame, but **the QR itself stays flat, high-contrast and still** (dark on light, as today) so every wallet can scan it. Effects stay on the frame, never on the code.
- **Status.** A `StatusRail`: waiting → confirming with three ring segments that lock one by one (n/3) → credited. On credit, the breakdown (received, kept, converted, fee, rebate, dollar note) rolls in as `Counter`s.

### `/credits` (Mechanism)

- **Balance.** `BalanceCore` with the three lines (Credits in dollars, ZEC with its value, Total), and the total as the big `Counter` that the header balance morphs into.
- **Withdraw form.** Amount (with Max) and address `Field`s. The address badge shows shielded or transparent live. The transparent checkbox appears with a warn-tinted glass panel.
- **Fees line.** "Network fees: covered (first today)" in `--ok`, or the amount.
- **Conversion confirmation.** When `needsConversion` is true, the form flips (a 3D card flip, Mechanism register) to the confirmation side: ZEC covered, credits converted, the fee, the 20–60 minute timing and the two buttons. "Convert and withdraw" leads to `Reauth`, rendered with the same `PinPad` and Vault Door styling.
- **Tracking.** A `StatusRail` for converting → scheduled → paying → done, with two tranche nodes that each show their txid when it arrives.

### `/agents` (Instrument)

A glass form (label, amount, recipient spend key, optional note key) with a `ProofButton` "Transfer". On success, a short animation shows one white mote leaving for the recipient.

## 8. Guardrails: security, accessibility and performance

These are acceptance criteria. A screen isn't done until it meets them.

### Security

The redesign must not weaken any guarantee in the architecture doc's "What the frontend must guarantee" list.

- **No new origins.** No CDN, font service, analytics, error tracker, 3D cloud embed (Spline, Sketchfab and similar) or remote asset. The CSP and `connect-src` stay exactly as they are. A Playwright check loads every route on a production build and fails on any CSP violation or off-origin request.
- **No `eval`.** Every new dependency must run under `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` in production. Check this before adding a library, not after.
- **Secrets are DOM text only.** The recovery phrase, PIN digits and keys are never drawn into a canvas, a WebGL texture, an SVG `<text>` generated from data, or CSS `content:`. They are never passed to an animation library as data.
- **No secret effects.** No text scramble, typewriter or glitch effect on phrase words or the PIN. No cursor-following glow on `/get`, `/unlock`, `/restore`, `Reauth` or `SignOutDialog`.
- **The PIN pad doesn't point at the key.** Press feedback is the same subtle dim on every key, and the visible confirmation happens on the dot row. A large ripple or glow on the pressed key would show a shoulder-surfer (or a screen recording) which digit was entered.
- **The phrase is hidden by default.** Words are blurred until press-and-hold, and blur again on release and when the tab is hidden. Recommendation: **no copy button for the phrase** (audit finding 9). Copying a phrase puts it in the clipboard history of many operating systems, which the 30-second clear can't undo. If one is added, it must pass `secret` to `CopyField`.
- **Motion never fakes trust.** Proof, credit and confirmation animations play only on the real state change (section 6). The landing scene stays labelled "simulated live".
- **Auto-lock still wins.** The idle and hidden-tab auto-lock in `VaultState.tsx` interrupts any ceremony. The Vault Door closing animation may play, but must not delay clearing the session.

### Accessibility (WCAG 2.2 AA)

- **Contrast.** All text at least 4.5:1, and large text and UI parts at least 3:1, checked against the worst-case backdrop for glass. This is why `--faint` is raised.
- **Reduced motion and transparency.** Both media queries are honoured as described in sections 3 and 4.
- **Keyboard.** Every interactive element is reachable and operable by keyboard, with the gold `:focus-visible` ring kept (and animated). Scenes take no keyboard focus. Their interactions (click the gate) are decorative only.
- **Screen readers.** Each scene has one concise `aria-label` describing its meaning, not its graphics (the current canvas labels are a good model). Counters announce only their final value. The Forge phases are announced through a polite live region ("Proving", "Sent", "Paid").
- **No information in motion alone.** Every state shown by animation (confirmations, tranches, coverage) is also shown as text.
- **Touch targets** at least 44 × 44 px for PIN keys, toggles and icon buttons.
- **Zoom and reflow.** Layouts work at 400% zoom and 320 px width without horizontal scrolling (except the app nav scroller and code panels).

### Performance budgets

Measured on a mid-range Android phone (about 4× CPU throttling) and on a recent laptop, with production builds.

| Metric | Budget |
| --- | --- |
| Largest Contentful Paint | ≤ 2.5 s on mobile. The hero `<h1>` must paint before any scene code loads |
| Interaction to Next Paint | ≤ 200 ms, including while a proof is being built |
| Cumulative Layout Shift | ≤ 0.05. Scenes reserve their box, and the Forge keeps the button width |
| Landing JS before interaction | No increase over today. The scene chunk loads after first paint (`requestIdleCallback` or on first scroll or pointer move) |
| Landing scene chunk | ≤ 250 KB gzipped (three.js core, R3F, the effects used, the scene code) |
| App route JS | ≤ +30 KB gzipped over today for Motion and the primitives. **No three.js on app routes** |
| Frame rate | 60 FPS at T2/T3 on laptops; at least 30 FPS at T1/T2 on phones, or the tier drops |
| GPU memory | ≤ 150 MB for the landing scene at T3 |
| Scene assets | ≤ 600 KB at T2; posters ≤ 120 KB AVIF each |

Performance is measured locally and in CI with Lighthouse and the browser's performance tools. **No field analytics are added** (the architecture doc forbids Vercel Speed Insights and similar), so lab testing on real devices carries this.
