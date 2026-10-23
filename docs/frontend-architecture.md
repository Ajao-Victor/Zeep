# Zeep — Frontend Architecture (Vercel)

Oct 21, 2026 · @0xAristos

## Overview

The Zeep frontend is a Next.js app on Vercel. It holds every secret on the user's device and talks to the backend only with proofs. It has no login and no server-side code that sees user data. Vercel serves static pages, the spend-circuit files and the JavaScript. Key storage, PIN unlock, note keeping and proof generation all happen in the browser.

The user has two private balances, and the app shows them as one number:

- **ZEC notes** (asset 1, zatoshis). Half of every deposit stays as the user's own shielded ZEC. Its dollar value moves with the ZEC price.
- **Dollar notes** (asset 0, micro-USD). The other half is converted to fixed dollars, minus a 1.5% conversion fee. Services are paid from this balance, one Groth16 proof per request.

**Credits** are the display of both together: dollars plus ZEC at the live price. The default is 1 credit = $1 (`micro_usd_per_credit` = 1,000,000). The header shows the total. The split appears only in the header tooltip and on the balance screen. The treasury (USDC, bridges, the EVM wallet) stays on the backend. None of it is named or called from this app.

**Design direction: Vault, Obsidian edition.** A dark-first interface: near-black background, warm off-white text, one gold accent for actions and balances, and monospace numbers for anything counted. Depth comes from glass surfaces, a lit top edge and soft elevation, not from new hues. The tone is a security tool. Colour tells one story everywhere: things arrive in **identity colours** (six muted hues, used only before the proof), pass through **gold** (the proof) and leave **anonymous white**. The full specification is `docs/futuristic-design-spec.md`.

**Three signature moments** get the motion budget, and everything else stays quiet:

- **The Proof Gate** (landing hero). A live three.js scene: coloured requests funnel into a rotating gold lattice and leave as white points along five lanes to the services. See "Motion and signature moments".
- **The Forge** (every paid request). The Send/Search/Call/… button turns into a small gold forge driven by the real proof.
- **The Vault Door** (create, unlock, lock, network switch). A CSS 3D door that turns while Argon2id derives the key and opens, seals or closes on the real outcome.

**Landing page.** New visitors see the Proof Gate beside the hero, with a glass "What Zeep sees" panel over its lower part (labelled "simulated live"). Requests move away from the cursor, the camera tilts slightly with it and the gate pulses on click. The scene picks a quality tier per device and falls back to a 2D canvas or a still poster.

**What the frontend must guarantee**

- The recovery phrase, PIN and spend key never leave the device.
- Testnet and mainnet are separate vaults. The toggle is always visible, and switching locks the current vault.
- Each request's proof is built in a Web Worker so the UI stays responsive.
- Motion tells the truth: the Forge and the Vault Door react only to real proof, key-derivation and vault events, never to timers, and no animation may slow the cryptography (see "Rules for contributors").
- No third-party scripts, analytics or trackers.
- The page is cross-origin isolated, so the in-app Zcash wallet can use threads.

## App structure

Onboarding creates a 24-word phrase, wraps it with a PIN or a passkey, and opens a session. The session holds the Zeep client (`lib/zeep`, a copy of the backend `sdk/`) and the encrypted note book. App pages call `client.pay`, `client.startDeposit` or `client.withdraw`. Vercel only serves code and circuit files. It never sees a secret, a note or a request body.

The same phrase does three jobs: it derives the Zeep spend key, it opens the in-app Zcash wallet (WebZjs account 0), and it decrypts chats on restore.

## Tech stack

Every library runs in the browser and is bundled at build time. Nothing is loaded from a third-party CDN at runtime.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript on Vercel | Static pages, security headers in `next.config.ts` |
| Styling | Tailwind CSS v4, driven by the Vault tokens | One source of colours |
| UI primitives | Radix UI (dialog, dropdown, tooltip, tabs) | Accessible behaviour without a visual style to fight |
| Fonts | Inter and JetBrains Mono, self-hosted via `next/font` | No request to Google at runtime |
| Proof Gate (landing 3D) | `three` 0.186.1 + `@react-three/fiber` 9.8.2, exact pins | A lazy chunk (about 245 kB gzipped) fetched only on capable devices after first paint. Everything is generated in code: no models, textures, HDRIs, fonts or decoders to host. No drei, postprocessing or Motion (several drei helpers fetch from CDNs) |
| Proof Gate fallbacks | 2D `<canvas>` (tier 1) and a seeded SVG poster (tier 0) | Weak devices, no hardware WebGL2, reduced motion, data saver or FX off |
| The Forge and the Vault Door | Plain CSS (transforms, opacity, masks) driven by `data-phase` | No canvas, WebGL or JS frame loop, so they cost nothing next to the prover and Argon2id workers |
| Spend proofs | `snarkjs` Groth16 in a Web Worker, `poseidon-lite` for note hashes | Same circuit the backend verifies |
| PIN hardening | `hash-wasm` Argon2id | Memory-hard key derivation in the browser |
| Encryption | WebCrypto AES-GCM (256-bit) | Note backups, the vault record, and chats |
| Recovery phrase | `@scure/bip39`, 24 English words | One phrase for the Zeep keys and the Zcash wallet |
| Hashing | `@noble/hashes` | HKDF for keys, SHA-256 for circuit checks and request signals |
| Fingerprint unlock | WebAuthn passkey with the PRF extension | Derives the unlock key from Face ID or a fingerprint |
| Local storage | IndexedDB via `idb`, database `zeep`, object store `kv` | Encrypted vault, notes and chats |
| In-app wallet | ChainSafe WebZjs, vendored under `public/webzjs` | Shielded sync and PCZT send. The worker refuses to invent a balance when that build is absent, and the deposit falls back to a QR |
| Payment QR | `qrcode` + a ZIP 321 `zcash:` URI, no memo | Any wallet can pay a deposit |
| Attachments | `pdfjs-dist` in its worker; images downscaled on a canvas | Files travel only inside the paid chat request |
| API client | `fetch` + `zod` for public responses; the Zeep client for paid ones | OpenAI-style SSE for chat |
| Server state | TanStack Query | Public data such as the reserve books |
| Tests | Vitest | Units for credits, the deposit estimate, addresses, ZIP 321, the phrase quiz, motion-token drift, rendering tiers, and the Forge and Vault Door phase machines |

## Routes and screens

Fifteen routes. Public pages work without a pass. Anything that spends or withdraws needs the vault unlocked, and the app redirects to `/unlock` when it is not.

| Route | Screen | Needs unlocked pass |
| --- | --- | --- |
| `/` | Landing: hero, proof animation, three steps, five services | No |
| `/privacy` | How it stays private | No |
| `/get` | Open a balance: 24-word phrase, word check, 6-digit PIN, optional fingerprint, optional deposit | Creates one |
| `/unlock` | PIN pad or fingerprint; link to restore | No |
| `/restore` | Enter the 24 words, set a new PIN, rebuild notes, wallet and chats | No |
| `/services` | Credit total and the five service cards | Yes |
| `/ai` | Chat: history sidebar, composer, model picker, streamed replies | Yes |
| `/search` | One paid search | Yes |
| `/health` | Drug and trial lookup | Yes |
| `/chain` | Paid JSON-RPC to Ethereum, Base or Solana | Yes |
| `/inbox` | Open an anonymous inbox and read messages | Yes |
| `/deposit` | In-app wallet card, then a deposit of any ZEC amount | Yes |
| `/credits` | Balance details (dollars and ZEC) and withdrawals | Yes |
| `/agents` | Move ZEC notes to another spend key | Yes |
| `/reserve` | Public books: owed, held, coverage, deposits, services, in dollars | No |

The header credit link goes to `/credits`. Below 400 px the "Open a balance" button reads "Start" so it fits. The app nav is a horizontal scroller under the header, and a full-height menu on small screens.

## Design system

One accent, one border weight, two typefaces. Gold is used where the user acts or where a number is counted.

**Colour tokens** (`styles/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0F0F0E` | Page background |
| `--surface` | `#151513` | Panels and cards |
| `--line` | `#22211E` | Borders and dividers |
| `--line-strong` | `#2E2C28` | Secondary button borders |
| `--text` | `#ECE8E1` | Primary text |
| `--muted` | `#8C877D` | Secondary text |
| `--faint` | `#87827A` | Hints (raised from `#6F6B62` to pass 4.5:1 on every surface) |
| `--gold` | `#D9A441` | Primary buttons, credit total |
| `--gold-hover` | `#E6B656` | Gold button hover |
| `--ok` | `#9CB58A` | Confirmed states |
| `--warn` | `#D98A41` | Testnet badge, shielding |
| `--danger` | `#D06B5C` | Errors, a wiped vault |
| `--void` | `#070706` | The space behind scenes and glass |
| `--gold-deep`, `--gold-glow` | `#8F6418`, gold at 35% | Gold as a light source: ring shading, glows |
| `--anon`, `--anon-glow` | `#F4F2EE`, at 22% | Anonymous white: only things that passed a proof |
| `--id-1` … `--id-6` | six muted hues | Identity: before the proof only (scenes, the Forge's motes, the door's outer ring). Never UI chrome |

Also in `styles/tokens.css`: elevation (`--elev-1`, `--elev-2`, `--elev-gold`), glass (`--glass-1/2-fill`, `--glass-1/2-blur`, `--glass-edge`; the fills are the minimum opacity that keeps text AA and must not be lowered), and motion (`--dur-instant` 90 ms … `--dur-cinematic` 900 ms, `--curve-enter/move/exit`, with the slow durations capped under reduced motion). `lib/motion/tokens.ts` mirrors the durations and curves for JavaScript, and a test fails if the two drift. Components use these tokens. A light theme can come later by redefining them.

**Utilities** (`app/globals.css`): `glass-1` and `glass-2` (with an opaque fallback and `prefers-reduced-transparency`), `glass-edge` (a lit top edge; needs a positioned element), `tint-*` (sets `--tint`, which the focus ring and tinted components read), `sheen` (the primary button's hover light), `pop-in` (menus) and `zeep-shake`.

**Primitives** (`components/ui/` and `components/`): `Surface`/`Card` (`Panel` is an alias), `Button` (primary, secondary, ghost, danger; `busy` disables without dimming), `ProofButton` (hosts the Forge), `IconButton` (36 px visual, 44 px hit area), `Toggle` (segmented or chips), `Input`/`Textarea`, `Menu`, `PinPad`, and the effects in `components/fx/` (`VaultDoor`, `Forge`, `proof-gate/`).

**Type.** Inter for text (60 / 32 / 17 / 15 / 14 / 13 px). JetBrains Mono for credits, ZEC, prices and addresses.

**Layout.** An 8 px spacing scale. Max content width 1200 px, with 32 px gutters and 16 px on phones. Radius 12 px for panels and 8 px for buttons. Chat fills `calc(100dvh - 6.5rem)` so the composer stays on screen under the site header and the app nav. Step cards scale to 1.02 on hover.

**Chat layout**

- From 640 px up, a 48 px rail on the left holds the history toggle. Opening it shows a 272 px in-flow sidebar (new chat, search, Today / Yesterday / Previous 7 days / Older, settings). Closing it gives the thread the full width.
- Below 640 px the history is a full-height Radix drawer from the chat header. The composer stays above `env(safe-area-inset-bottom)`.
- The main column is centered at a max of 768 px.
- An empty thread says the proof shows the payment, not who you are, and that the history stays on the device. Once a chat exists, one faint line sits above the composer: "Zeep sees the prompt, not who sent it."

**Motion.** Instrument UI stays under `--dur-base` (buttons lift 1 px and change colour in 150 ms). Only the three signature moments use long or looping motion, described in the next section. Everything honours `prefers-reduced-motion` and `NEXT_PUBLIC_FX_LEVEL=off`.

## Motion and signature moments

Each moment uses the lightest technology that can carry it. Only the landing page runs WebGL. App routes never load three.js.

### The Proof Gate (landing, three.js)

`components/landing/ProofGateHero.tsx` puts `components/fx/proof-gate/SceneFrame.tsx` behind the glass "What Zeep sees" panel. Every tier reads one layout (`proof-gate/layout.ts`), so the DOM lane labels line up with whatever draws.

**Tiers** (`lib/fx/tier.ts`, tested):

| Tier | What draws | Chosen when |
| --- | --- | --- |
| 0 Still | `Poster.tsx`, a seeded SVG | Reduced motion, data saver, or `NEXT_PUBLIC_FX_LEVEL=off` |
| 1 Lite | `LiteScene.tsx`, a 2D canvas | `FX_LEVEL=lite`, no hardware WebGL2 (probed with `failIfMajorPerformanceCaveat`), 2 GB of memory or less, or a touch device with 4 cores or fewer |
| 2 Standard | `Scene3D.tsx`: 1,400 points, 16 bokeh lights, pixel ratio up to 1.5 | Other capable devices |
| 3 Ultra | 4,200 points with two trail echoes, 28 bokeh lights, antialiasing, pixel ratio up to 2 | Desktop (fine pointer, at least 1024 px), 8+ cores, 8 GB+ |

**Lifecycle**

- `Scene3D` is a `next/dynamic` import with `ssr: false`, requested after `requestIdleCallback` and only for tiers 2 and 3. The poster shows until the first WebGL frame. The landing page's first-load JS stays at about 114 kB, and the 3D chunks are about 245 kB gzipped (budget 250 kB).
- The scene renders only while it is on screen and the tab is visible (`IntersectionObserver` and `visibilitychange` set R3F's `frameloop` to `"never"`).
- Sustained frame rate is sampled in 2 s windows. Below 50 fps tier 3 steps down to 2, and below 30 fps tier 2 steps down to 1 (one-way). A lost WebGL context falls back to the poster.
- **Unmount.** Leaving the page unmounts the R3F root, which disposes the scene graph and the renderer and calls `forceContextLoss()`. Our components also dispose their own buffer geometries and the generated PMREM environment, and remove their pointer listeners and observers. Audited in headless Chrome: after 20 landing round trips (more than Chrome's 16 live-context limit) there were no context warnings, one canvas and one context left reachable (the same as after 3 trips), no three.js renderers, and window and document listener counts back at their baseline.
- **Shader rules learned the hard way.** Every custom fragment shader ends with `#include <colorspace_fragment>`. `smoothstep` edges must be ascending (a reversed call draws nothing on ANGLE/Metal). R3F copies a `uniforms` prop into the material, so per-frame updates go through the material ref, not the object passed in.

### The Forge (paid buttons, CSS ratchet)

`components/ui/ProofButton.tsx` hosts `components/fx/Forge.tsx` on Search, Look up, Call, Open an inbox, Transfer, Withdraw (direct withdrawals) and chat Send.

- **Signals.** `lib/zeep/prove.ts` (the app's worker bridge, not the copied SDK) emits `onProof` "start" and "end" around every proof posted to `workers/spend.worker.ts`. `lib/fx/useForge.ts` wraps one paid call in `track()`, listens only for that call's lifetime, and feeds the pure, tested reducer in `lib/fx/forge.ts`.
- **Phases.** preparing (dark, identity motes gather) → proving (gold, the motes converge into a hexagonal lattice; it spins again for every real proof) → sending (a white mote leaves) → settled (white with a drawn check) or failed (a shake). The outcome stays visible for 1.4 s or 0.9 s, which is the only timer.
- **Why a ratchet.** Smooth CSS loops are composited, but they still made the compositor draw 61 frames a second, and with the prover on every core that slowed real proofs by about 18%. The lattice and the mote orbit now tick in steps (`steps(24)` over 2.4 s, 10 changes a second), so the compositor draws 10 frames a second. A randomised A/B of the identical proof then measured within noise.
- **Layout and access.** Every label shares one grid cell, so the width never changes. `Button busy` keeps full colour while disabled. A polite live region announces "Proving" and the settled label.

### The Vault Door (create, unlock, lock, switch; CSS 3D)

`components/fx/VaultDoor.tsx` with `styles/vault-door.css`: a glass frame with six bolts, a leaf that swings on a left hinge under `perspective`, three notched rings (identity outside, gold in the middle, white inside) whose index ticks line up when unlocked or sealed, and a seam with warn and danger layers.

- **Signals.** `lib/vault/kdf.ts` emits `onKdf` "start" and "end" around every Argon2id run. `lib/fx/useVaultDoor.ts` wraps a vault call (`unlockWithPin`, `unlockWithPasskey`, `createVault`) and feeds the tested reducer in `lib/fx/door.ts` with `PinError`'s `attemptsLeft` and `wiped`.
- **Unlock.** The door is closed above the `PinPad`. The rings turn exactly while the worker derives. On success the session is already open, then the rings align, the bolts withdraw and the leaf swings, and only the route change waits (0.9 s, or none under reduced motion). A wrong PIN jolts the rings, and the dots turn red and shake. At one try left the seam turns `--warn` (restored from the stored count and also written as text). The wipe greys the door out.
- **Create.** The door stands open during PIN entry, shuts and turns while `createVault` runs, then seals (rings align, bolts in, gold seam), and the flow moves to Deposit.
- **Lock, auto-lock, network switch.** The session is cleared first. Then `lib/fx/doorIntent.ts` records why, and `/unlock` mounts the door "closing" and writes the reason. Auto-lock therefore always wins, and the ceremony never delays it. `/unlock` is prefetched while unlocked and has no Suspense boundary, so the door is in the first paint (measured at 11–48 ms from Lock in production).
- **Cost.** The same 100 ms-tick rule as the Forge: about 11 frames a second for one door, and the real Argon2id derivation measured 573 ms without the door versus 580 ms with it turning. Keep it to one door per screen: eleven turning at once slowed derivation by half.

**PIN pad.** Glass keys with the same subtle dim on every press and no hover lift or glow, so nothing points at the digit pressed. Confirmation happens on the dot row (gold → red and a shake → white). It locks while deriving and has an optional identical 8 ms vibration.

**Reduced motion and FX off.** The Proof Gate shows the poster. The Forge and the door drop all spins, swings, slides and shakes and cross-fade between phases. Outcome holds are skipped, so nothing waits on an animation the user cannot see.

## Two balances

`client.balances()` returns `{ usd, zec }` in micro-USD and zatoshis. `client.totalMicroUsd(zecUsd)` adds the ZEC at the price from `GET /v1/prices`. The header formats that with `formatCredits` and refreshes it on the price interval.

The tooltip, and the top of `/credits`, read:

- Credits (dollars): the dollar-note balance
- ZEC: the ZEC-note balance and its live dollar value
- Total: the credit figure

Prices from `/v1/prices` are in `micro_usd`. A search can be a fraction of a credit. Amounts sent to the API are micro-USD for services and zatoshis for withdrawals. Conversion to credits is display only.

**Staged refill.** The server never sees a balance, so the schedule lives in the SDK and runs inside `pay()`. When the dollar balance would fall to 5% of its last top-up, the client converts 50% of the ZEC notes to dollars (minus 1.5%). The next time it converts 50% of what is left. The third stage converts the rest. A new deposit resets the stages. If the dollars cannot cover a payment, further stages run immediately. That costs one extra proof. The credits total barely moves, because only the fee leaves. `book.refill` (`{ base, stage }`) is saved with the notes. The settings screen may later offer a manual `client.convertToUsd(zats)`. It is not required for launch.

## Deposits

On `/deposit` the user types an amount in ZEC. `estimateDeposit` shows, before anything is sent:

- the credit total it should add
- how much ZEC stays ZEC, and how much becomes dollars after the conversion fee

The dollar half is marked as an estimate. It is fixed when the deposit confirms.

`client.startDeposit` returns a fresh address for that deposit. No memo is required. The user can pay it two ways:

- **From the in-app wallet**, when it has shielded funds. The payment is a PCZT from the shielded balance only. If shielded funds are short and transparent funds are waiting, the wallet shields first, then pays.
- **From another wallet**, as a ZIP 321 QR with the address and the amount.

The screen polls `client.depositStatus` through waiting, confirming n/3, and credited. When it is credited it shows ZEC received, ZEC kept, ZEC converted, the fee, the network-fee rebate on the first deposit of the UTC day, and the dollar note.

## Withdrawals

`/credits` takes an amount in ZEC, with the credit value beside it, or Max.

1. `client.planWithdrawal(zats)` or `planWithdrawal("all")`.
2. If the ZEC notes cover it, the screen shows the amount and the network fee, then sends. Status is `scheduled` immediately.
3. If it does not, the screen stops and asks for confirmation: how much ZEC covers the withdrawal, how many credits must be converted, the 1.5% fee, and that this takes 20–60 minutes. The ZEC arrives shielded and is sent on its own. The buttons are **Convert and withdraw** and Cancel.
4. Convert and withdraw re-authenticates with the PIN, the passkey, or the recovery phrase. Only then does it call `client.withdraw(plan, address)`.

The total must be worth at least $1. A converted part is at least $1 as well. The plan rounds up.

A shielded address (`u1` / `zs` on mainnet, `utest` / `ztestsapling` on testnet) is the normal case. A transparent address (`t1` / `t3`, or `tm` / `t2` on testnet) needs the checkbox "I understand the amount and recipient will be public". The client then sends `{ allowTransparent: true }` and shows the warning from the response.

Network fees (the two payout fees, about $0.01) are the user's, except on the first withdrawal of the UTC day, when Zeep pays them if `GET /v1/fees` says `free_network_fees_available`. The app remembers that day locally (`fee-day:<network>`) and shows either "Network fees: covered (first today)" or the amount.

A withdrawal that converts credits returns `status: "converting"` and a processing message. The screen polls `GET /v1/withdrawals/:id` every 30 seconds. The status runs converting, then scheduled (with `zec_received_zats`), then paying, then done, with a txid on each of the two tranches. A ZEC-only withdrawal skips converting.

## Proof engine

Proofs run in `workers/spend.worker.ts`. On first use it fetches `/circuits/zeep_spend.wasm` and `/circuits/zeep_spend.zkey`, checks their SHA-256 against `NEXT_PUBLIC_SPEND_*_SHA256`, and refuses to prove on a mismatch. It then calls `snarkjs.groth16.fullProve` and returns `{ proof, publicSignals }`. One proof takes about 1–2 seconds. `/circuits/*` is cached for a year.

The circuit is a 2-input, 2-output spend on BN254, one asset at a time. Asset 0 is dollars (micro-USD). Asset 1 is ZEC (zatoshis). A zero-amount input is a dummy and its Merkle membership is not checked. Public signals, in the order the server expects, are:

`root[2], nullifier[2], outCommitment[2], cost, asset, signalHash, tag, tagEpoch, tagPurpose`

`signalHash` binds the request (method, path, and the exact raw body), a withdrawal id and address, a deposit, or a conversion. The client sends the proof as `X-Zeep-Proof`, in base64 chunks of 7,000 characters. The server returns `X-Zeep-Notes` and `X-Zeep-Cost`. The SDK reads them, marks the inputs spent, and stores the change note. If the upstream call fails, the server can return the cost as a new note.

The note book picks one or two notes that cover the cost. If the money is spread thinner than that, the client merges notes first (a zero-cost spend) and tries again.

**Current circuit hashes**

| File | SHA-256 |
| --- | --- |
| `zeep_spend.wasm` | `7ae27bcdcce4d4f85ef521d6a56bc22e581806ca9ca623d2df3b7155393cbfba` |
| `zeep_spend.zkey` | `0ee27fd3e4e5b3ac609ae4f382fa02ee7ba7a9b0b9fb2411096b23705da4b98f` |

Replace both files and both env values together whenever the circuit changes. An older wasm will not prove against this backend, because the public inputs now include `asset`.

## In-app Zcash wallet

ChainSafe publishes only `@chainsafe/webzjs-keys` on npm. The wallet package is built from the ChainSafe/WebZjs repo at a pinned commit and vendored at `public/webzjs` (`webzjs_wallet.js`, the wasm, and `snippets/`). Do not depend on unofficial npm forks. `workers/wallet.worker.ts` loads that build. If it is missing, or if `NEXT_PUBLIC_LIGHTWALLETD_URL_*` is empty, the worker says so and the user pays the deposit from another wallet.

WebZjs needs `SharedArrayBuffer`, so the app is cross-origin isolated (`COOP: same-origin`, `COEP: require-corp`, `CORP: same-origin`). It talks to lightwalletd over gRPC-web. That URL is a proxy in front of lightwalletd or Zaino, not the raw gRPC port.

After every sync, if the transparent balance is at least `NEXT_PUBLIC_AUTOSHIELD_MIN_ZATS` (default 100,000 zats), the worker runs `pczt_shield` → sign → prove → send. The wallet card shows "Shielding 0.0x ZEC…" until the next sync shows it shielded. Otherwise this is silent. Deposits to Zeep and wallet sends spend shielded funds only.

The wallet card, on the deposit screen only, shows the shielded balance and the unified address. The transparent address sits behind "My exchange can't send to this address", with the note that ZEC sent there is shielded automatically. The header never shows the wallet balance. The header is the Zeep credit total.

## Chat

The composer is an auto-growing textarea. Enter sends, Shift+Enter inserts a line. A paperclip accepts drag-and-drop and paste. The model button shows the model name and no price. Send has no price on it.

The model picker is the only place a chat price appears. Each row is name, a one-line detail, a "reads images" badge when the model has vision, and the price in credits. The tooltip is that price in ZEC at the live rate. Under the list: attachments over 64 KB add a per-MB credit price. After a model is chosen, the price is not repeated. The header balance drops after the reply.

Images (png, jpeg, webp, gif) go out as `image_url` parts, and only when the model has vision. Text and code are read in the browser and sent as a text part prefixed with the file name. PDFs are extracted with `pdfjs-dist` and sent as text. The request body must stay within `attachments.max_body_mb` (20). The cost passed to `client.pay` is `model.micro_usd` plus one attachment unit per MiB past 64 KB. Files are not uploaded anywhere else. The response is OpenAI-style SSE: lines starting with `:` are heartbeats, and text is read from `choices[0].delta.content`. A 402 with code `insufficient` shows Add funds, linking to `/deposit`.

Each chat is `{ id, title, model, createdAt, updatedAt, messages }`, encrypted with AES-GCM under `keys.vaultKey` and stored in IndexedDB. The title is the first user message, made on the device. Optional sync (off by default) writes ciphertext to `PUT /v1/vault/{vaultId}/items/chat-{id}` with `x-vault-auth`. Restore pulls those items back. Auto-delete after 30 days is off by default. When it is on, local chats older than 30 days are removed on load and every hour, and synced items get `expires_at`. "Delete all chats" clears IndexedDB and calls `DELETE /v1/vault/{id}`. Locking the vault drops decrypted chats from memory.

## Local state and storage

IndexedDB database `zeep`, one `kv` store. Keys are split by network. The server receives ciphertext only, and only when chat sync is on.

| Key | Contents | Encrypted |
| --- | --- | --- |
| `vault:<network>` | Vault record v2: the 24-word phrase, inbox id, inbox address, created time | Yes, AES-GCM under the PIN- or passkey-derived key |
| `vault-meta:<network>` | Argon2 salt, failed PIN count, passkey credential id and wraps | No secrets in the clear. Five failures wipe the vault and the notes on this device |
| `notes:<network>` | Note book: notes, `nextDeposit`, and `refill` | Yes |
| `chat:<network>:<id>`, `chat-ids:<network>`, `chat-prefs:<network>` | Chats, the id list, and the sync / auto-delete toggles | Chats yes. Prefs no |
| `fee-day:<network>` | UTC day of the last withdrawal whose network fee Zeep covered | No personal data |
| `prefs` | The selected network | No personal data |

A v1 vault (the old credit model) does not open. The user restores the 24 words.

**In memory only.** The unlocked AES key, the phrase, the Zeep keys and the decrypted note book. Cleared on lock, tab close, `AUTOLOCK_SEC` of inactivity, or the tab being hidden for more than 60 seconds.

**Restore.** Entering the 24 words on a new device recreates the keys, calls `client.restore()` (trial-decrypt every note backup, re-find deposits, drop spent notes) and, if sync was on, pulls chats. The old device should be locked first. Two devices can attempt the same note until the next `refreshSpent()`, and the second spend is rejected. `refreshSpent()` runs after unlock and mixes decoy nullifiers into `POST /v1/nullifiers/check`.

## Key flows in the UI

**First visit (`/` → `/get`)**

1. Create the 24-word phrase. The app asks for words 3, 12 and 21 before continuing.
2. Set a 6-digit PIN, twice. A passkey is optional.
3. Optionally deposit. Skip lands in the app with an empty balance.

**Unlock (`/unlock`).** Fingerprint first when a passkey exists, otherwise the PIN pad. The fifth wrong PIN wipes this device and offers `/restore`.

**Use a service.** The button does not show a price. Chat prices live only in the model picker. Other services use the live `micro_usd` from `/v1/prices`. The header credits update when the note book changes.

**Network switch.** The header toggle locks the vault, writes `prefs`, and opens `/unlock`, `/restore`, or `/get` for the other network. Testnet shows an orange badge.

## Security and hardening on Vercel

**Headers, set in `next.config.ts` for every route**

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
  connect-src 'self' <API_TESTNET> <API_MAINNET> <ONION_TESTNET> <ONION_MAINNET> <LIGHTWALLETD_TESTNET> <LIGHTWALLETD_MAINNET>;
  img-src 'self' data: blob:;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'none';
  form-action 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

`connect-src` is built from the env vars at build time. Empty URLs are left out, so a deploy with no API URLs can only connect to itself.

`'unsafe-inline'` is on `script-src` in production because the App Router boots from inline scripts and these pages are statically prerendered (`x-nextjs-prerender: 1`). A per-request nonce cannot be attached to script tags that were baked at build time. Without `'unsafe-inline'` the browser drops the prerendered HTML and the page is a blank near-black screen. Do not add a second CSP in middleware. The stricter of the two policies wins. `'wasm-unsafe-eval'` is for the proof circuit and the Argon2 wasm. `img-src` allows `data:` and `blob:` for attachment previews. Dev adds `'unsafe-eval'` so Next's hot reload can run.

**Rules**

- No analytics, no Vercel Web Analytics or Speed Insights, no error trackers. Errors stay in the browser console.
- Circuit files are hash-checked in the worker before use.
- No server component reads user data. There are no Vercel Functions holding secrets.
- Auto-lock after idle, and when the tab has been hidden for more than 60 seconds.
- Copied recovery words are cleared from the clipboard after 30 seconds where the browser allows.
- The deployed commit hash is shown in the footer.

## Vercel config vars

Add these under Project → Settings → Environment Variables, for Production and Preview. Choose **Config**, not Secret: every value is public (`NEXT_PUBLIC_`). The file to import is `.env.example` in the repo root. Next.js bakes these values in at build time, so redeploy after any change. Saving them does nothing until the next build.

The example file uses localhost. On the live project, set:

- `NEXT_PUBLIC_APP_URL` = `https://zeep-frontend.vercel.app` (or `https://zeep.app` once that domain is attached)
- `NEXT_PUBLIC_PASSKEY_RP_ID` = the hostname only, `zeep-frontend.vercel.app` (or `zeep.app`). A passkey registered for `localhost` will not work on the deployed origin.

**App and networks**

| Name | Example | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Zeep` | Titles |
| `NEXT_PUBLIC_APP_URL` | `https://zeep-frontend.vercel.app` | Canonical URL |
| `NEXT_PUBLIC_DEFAULT_NETWORK` | `testnet` | Network on first visit |
| `NEXT_PUBLIC_API_BASE_URL_TESTNET` | `https://api-test.zeep.app` | Testnet API |
| `NEXT_PUBLIC_API_BASE_URL_MAINNET` | `https://api.zeep.app` | Mainnet API |
| `NEXT_PUBLIC_ONION_API_URL_TESTNET` | empty | Optional Tor API |
| `NEXT_PUBLIC_ONION_API_URL_MAINNET` | empty | Optional Tor API |
| `NEXT_PUBLIC_ENABLE_FRONTIER_ON_TESTNET` | `false` | Hide frontier models on testnet |

**Spend circuit and wallet**

| Name | Example | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SPEND_WASM_URL` | `/circuits/zeep_spend.wasm` | Proving circuit |
| `NEXT_PUBLIC_SPEND_WASM_SHA256` | `7ae27bcd…3cbfba` | Refuse a tampered circuit |
| `NEXT_PUBLIC_SPEND_ZKEY_URL` | `/circuits/zeep_spend.zkey` | Proving key |
| `NEXT_PUBLIC_SPEND_ZKEY_SHA256` | `0ee27fd3…a4b98f` | Refuse a tampered proving key |
| `NEXT_PUBLIC_LIGHTWALLETD_URL_TESTNET` | empty until the gRPC-web proxy exists | In-app wallet, testnet |
| `NEXT_PUBLIC_LIGHTWALLETD_URL_MAINNET` | empty until the gRPC-web proxy exists | In-app wallet, mainnet |
| `NEXT_PUBLIC_AUTOSHIELD_MIN_ZATS` | `100000` | Shield transparent ZEC once it clears this |

**Unlock**

| Name | Example | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_PIN_LENGTH` | `6` | PIN length |
| `NEXT_PUBLIC_PIN_MAX_ATTEMPTS` | `5` | Wipe this device's vault after five wrong PINs |
| `NEXT_PUBLIC_ARGON2_MEMORY_KIB` | `65536` | 64 MiB per PIN guess |
| `NEXT_PUBLIC_ARGON2_PASSES` | `3` | Argon2id passes |
| `NEXT_PUBLIC_AUTOLOCK_SEC` | `300` | Lock after five idle minutes |
| `NEXT_PUBLIC_PASSKEY_RP_ID` | `zeep-frontend.vercel.app` | Passkey relying party. Hostname only |
| `NEXT_PUBLIC_RECOVERY_WORDS` | `24` | Phrase length |
| `NEXT_PUBLIC_CLIPBOARD_CLEAR_SEC` | `30` | Clear a copied phrase |

**Chat and content**

| Name | Example | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `20` | Attachment ceiling before prices load |
| `NEXT_PUBLIC_CHAT_AUTODELETE_DEFAULT` | `false` | 30-day chat deletion |
| `NEXT_PUBLIC_CHAT_SYNC_DEFAULT` | `false` | Sync ciphertext to the vault API |
| `NEXT_PUBLIC_LANDING_ANIMATION` | `true` | Landing canvas |
| `NEXT_PUBLIC_SOURCE_URL` | the frontend repo | Footer link |
| `NEXT_PUBLIC_DOCS_URL` | `https://zeep.app/docs` | Docs link |

Do not add `.env.local`. It is gitignored and exists only for `next dev`. Removed from this app: `NEXT_PUBLIC_RLN_*`, `NEXT_PUBLIC_PAY_ADDRESS_*`, `NEXT_PUBLIC_ACTIVATION_POLL_SEC`, and `NEXT_PUBLIC_PROOF_WORKERS`.

**Set by Vercel:** `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, shown in the footer. Turn on "Automatically expose System Environment Variables".

## Project layout

```text
Zeep-front/
  app/
    (marketing)/page.tsx            # landing
    (marketing)/privacy/page.tsx
    reserve/page.tsx
    get/  unlock/  restore/
    (app)/services/ ai/ search/ health/ chain/ inbox/ deposit/ credits/ agents/
    layout.tsx                      # fonts, metadata, providers
  components/
    SiteHeader.tsx                  # credit total, tooltip, network toggle, mobile menu
    chat/                           # sidebar, thread, composer, settings
    deposit/DepositPanel.tsx
    wallet/WalletCard.tsx
    screens/                        # one screen per service, plus balance and reserve
    flows/                          # get, unlock, restore, reauth
  lib/
    zeep/                           # copy of the backend sdk/, plus pay/prove helpers and fund()
    vault/                          # Argon2id, AES-GCM, passkey, IndexedDB, session
    zcash/                          # ZIP 321, address kinds, wallet-worker bridge
    chat/                           # local store, vault sync, file reading
    api/                            # public client, zod, SSE
  workers/spend.worker.ts
  workers/wallet.worker.ts
  public/circuits/                  # zeep_spend.wasm, zeep_spend.zkey
  public/webzjs/                    # vendored WebZjs wallet build, when present
  styles/tokens.css
  next.config.ts                    # CSP, COOP, COEP, circuit cache
  .env.example                      # the file imported into Vercel
```

`lib/zeep` is the backend `sdk/` copied in, not rewritten. `fund()` is the one addition: a zero-cost spend whose second output pays another Zeep key. The agent screen uses it for ZEC notes.

## Deployment

The Vercel project is `zeep-frontend`. Production is `https://zeep-frontend.vercel.app` until `zeep.app` is attached. Framework preset Next.js. Build command `next build`. Production and preview deploys both need the config vars above. Previews should keep `NEXT_PUBLIC_DEFAULT_NETWORK=testnet` and a passkey RP ID that matches the preview hostname.

Turn off Web Analytics and Speed Insights. Add the deployed origins to the backend `CORS_ALLOWED_ORIGINS` for the API that preview and production call. `COEP: require-corp` means those API responses must allow the browser to embed them, or the reserve page and paid calls fail in the browser even when `curl` succeeds.

**Deploy**

1. Import `.env.example` as Config variables. Fix `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_PASSKEY_RP_ID` for the real hostname. Confirm the two circuit hashes above.
2. Push `main`. Vercel builds from that push. `NEXT_PUBLIC_` values change only when a new build runs.
3. Open the site and confirm the landing sentence is visible. A blank near-black page means the production CSP is missing `'unsafe-inline'`.

**Check before calling it done**

- [ ] Landing animation runs on a phone and stops under reduced motion
- [ ] Phrase → PIN → deposit estimate → address → credited breakdown works on testnet
- [ ] A service payment spends dollar notes, and a low dollar balance refills from ZEC
- [ ] A withdrawal inside the ZEC balance is scheduled at once. One past it asks for confirmation and re-authentication, then shows converting
- [ ] Five wrong PINs wipe this device. The 24 words restore notes and chats
- [ ] The network switch locks the vault and does not show the other network's notes
- [ ] The network tab shows requests only to the configured API and lightwalletd origins
- [ ] Circuit hashes in Vercel match the files in `public/circuits/`
