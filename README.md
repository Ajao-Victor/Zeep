# Zeep

Private, pay-per-request access to AI, search, health lookups and an anonymous inbox, paid for with shielded Zcash. You don't need an account or a login, and nothing on the server knows who you are.

Zeep is the browser frontend. Every secret stays on your device: the 24-word recovery phrase, the PIN and the spend key never leave it. Each paid request carries a Groth16 zero-knowledge proof that it was paid for. The proof hides which balance paid, so the backend sees the request but not the requester.

> **Status:** v2 design ("Vault, Obsidian edition"). Testnet is the default network. The frontend talks to a separate Zeep backend API, which is not part of this repository.

## Contents

- [How it works](#how-it-works)
- [Features](#features)
- [The three signature moments](#the-three-signature-moments)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Project layout](#project-layout)
- [Security model](#security-model)
- [Accessibility and performance](#accessibility-and-performance)
- [Contributing](#contributing)
- [Deployment](#deployment)
- [Documentation](#documentation)

## How it works

1. **Open a balance.** On `/get` the app creates a 24-word phrase. You write it down by hand (there is deliberately no copy button), confirm three of the words, and set a 6-digit PIN. A passkey is optional. The phrase is encrypted with a key derived from the PIN with Argon2id and stored in IndexedDB.
2. **Deposit ZEC.** `/deposit` shows a fresh shielded address as a ZIP 321 QR code, payable from any Zcash wallet or from the built-in wallet. Half of each deposit stays as shielded ZEC. The other half becomes fixed dollar notes, minus a 1.5% conversion fee.
3. **Use services.** Every paid request (chat, search, health lookups, inbox) spends dollar notes with a Groth16 proof built in a Web Worker. The server checks the proof and returns a change note. It never learns which notes were spent or whose they are.
4. **Withdraw.** `/credits` sends ZEC to any shielded address, or to a transparent one after you confirm it will be public. When the ZEC notes don't cover the amount, the app converts credits first, after asking for confirmation and re-authentication.

Your balance is shown as **credits** (1 credit = $1): the dollar notes plus the ZEC notes at the live price. When dollars run low, the client tops them up from your ZEC in stages, inside the payment itself.

## Features

| Area | What you get |
| --- | --- |
| Private AI (`/ai`) | Streamed chat with a model picker, image, text and PDF attachments, and history encrypted on the device with optional ciphertext sync |
| Search (`/search`) | One paid web search per request |
| Health (`/health`) | Drug and clinical-trial lookups |
| Inbox (`/inbox`) | Anonymous inboxes |
| Agents (`/agents`) | Move ZEC notes to another spend key |
| Wallet | An in-app Zcash wallet (ChainSafe WebZjs) that shields transparent funds automatically and can pay deposits |
| Reserve (`/reserve`) | Public books: what is owed, held and covered |
| Vault | PIN or passkey unlock, auto-lock when idle or when the tab is hidden, a device wipe after five wrong PINs, restore from the 24 words |
| Networks | Separate testnet and mainnet vaults, with an always-visible switch that locks the current vault |

## The three signature moments

Motion is kept for three moments, and each one reacts only to real cryptographic events, never to timers.

- **The Proof Gate** (landing page). A live three.js scene: requests arrive in six identity colours, pass through a rotating gold lattice (the proof) and leave as anonymous white points along four lanes to the services. The scene picks a quality tier per device: WebGL ultra or standard, a 2D canvas, or a still SVG poster. It drops a tier when the frame rate sags and pauses when off screen.
- **The floating landing page.** The home page floats in glass over a full-page 3D backdrop: a WebGL field of requests flowing toward the viewer over a gold grid floor, with drifting lattices (a CSS version on lighter devices, still under reduced motion). Cards bob, rise in on scroll and tilt toward the pointer.
- **The Forge** (every paid button). The button becomes a small gold forge driven by the real proof: preparing → proving → sending → settled, or failed.
- **The Vault Door** (create, unlock, lock, network switch). A CSS 3D door whose rings turn exactly while Argon2id derives the key. It then opens, seals, jolts on a wrong PIN, or swings shut on lock.

The Forge and the Vault Door are pure CSS (transforms and opacity, ticking ten times a second). Measured against the real workloads, they don't slow the prover or Argon2id.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 on design tokens (`styles/tokens.css`), Radix UI primitives |
| Fonts | Inter and JetBrains Mono, self-hosted with `next/font` |
| 3D | `three` 0.186.1 and `@react-three/fiber` 9.8.2 (landing page only, lazy-loaded) |
| Proofs | `snarkjs` Groth16 in a Web Worker, `poseidon-lite` |
| Key derivation | `hash-wasm` Argon2id in a Web Worker |
| Crypto | WebCrypto AES-GCM, `@noble/hashes`, `@scure/bip39` |
| Storage | IndexedDB via `idb` |
| Wallet | ChainSafe WebZjs (vendored under `public/webzjs` when built) |
| Data | TanStack Query, `zod`, OpenAI-style SSE |
| Tests | Vitest |

## Getting started

### Prerequisites

- Node.js 22.x
- npm 10.9.8 (pinned in `engines`)
- A reachable Zeep backend API for paid features. Without one, the public pages and the vault flows still work, and paid requests fail cleanly.

### Install and run

```bash
git clone https://github.com/Ajao-Victor/Zeep.git
cd Zeep
npm ci
cp .env.example .env.local   # then point the API URLs at your backend
npm run dev
```

Open http://localhost:3000.

For local development, set at least:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PASSKEY_RP_ID=localhost
NEXT_PUBLIC_API_BASE_URL_TESTNET=<your testnet API>
```

`.env.local` is gitignored. Every value is `NEXT_PUBLIC_` and baked in at build time, so restart `next dev` (or rebuild) after changing one.

### Production build

```bash
npm run build
npm start
```

## Configuration

All configuration is public environment variables, listed with defaults in [`.env.example`](.env.example). The main groups:

| Group | Variables |
| --- | --- |
| App and networks | `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEFAULT_NETWORK`, `NEXT_PUBLIC_API_BASE_URL_{TESTNET,MAINNET}`, `NEXT_PUBLIC_ONION_API_URL_{TESTNET,MAINNET}` |
| Spend circuit | `NEXT_PUBLIC_SPEND_{WASM,ZKEY}_URL` and `_SHA256`. The worker refuses to prove if a file doesn't match its hash |
| Wallet | `NEXT_PUBLIC_LIGHTWALLETD_URL_{TESTNET,MAINNET}` (a gRPC-web proxy), `NEXT_PUBLIC_AUTOSHIELD_MIN_ZATS` |
| Unlock | `NEXT_PUBLIC_PIN_LENGTH`, `NEXT_PUBLIC_PIN_MAX_ATTEMPTS`, `NEXT_PUBLIC_ARGON2_MEMORY_KIB`, `NEXT_PUBLIC_ARGON2_PASSES`, `NEXT_PUBLIC_AUTOLOCK_SEC`, `NEXT_PUBLIC_PASSKEY_RP_ID`, `NEXT_PUBLIC_RECOVERY_WORDS` |
| Chat | `NEXT_PUBLIC_MAX_UPLOAD_MB`, `NEXT_PUBLIC_CHAT_AUTODELETE_DEFAULT`, `NEXT_PUBLIC_CHAT_SYNC_DEFAULT` |
| Motion | `NEXT_PUBLIC_FX_LEVEL`: `auto` (tier per device), `lite` (2D canvas at most) or `off` (still poster, cross-fades only) |

The CSP's `connect-src` is built from the API, onion and lightwalletd URLs at build time. Empty values are left out, so a build with no API URLs can only connect to itself.

When the circuit changes, replace `public/circuits/zeep_spend.wasm` and `zeep_spend.zkey` together with both hash variables.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Run the Vitest suite: credits, deposit estimates, addresses, ZIP 321, the phrase quiz, motion-token drift, rendering tiers, and the Forge and Vault Door state machines |
| `npx tsc --noEmit` | Type-check |

## Project layout

```text
app/
  (marketing)/          landing page and /privacy
  (app)/                services, ai, search, health, inbox, deposit, credits, agents
  get/ unlock/ restore/ reserve/
components/
  flows/                create, unlock, restore and re-authentication flows
  screens/              one screen per service, plus balance and reserve
  chat/ deposit/ wallet/ landing/
  fx/                   Forge, VaultDoor, proof-gate/ (SceneFrame, Scene3D, LiteScene, Poster, ...)
  ui/                   Surface, ProofButton, IconButton, Toggle, Input, Menu
lib/
  zeep/                 the Zeep client (backend SDK copy), proof bridge (onProof)
  vault/                Argon2id (onKdf), AES-GCM, passkeys, IndexedDB, session
  fx/                   rendering tiers and the Forge and Vault Door reducers, with tests
  zcash/                ZIP 321, address kinds, wallet-worker bridge
  chat/ api/ motion/
workers/                spend (Groth16), kdf (Argon2id), wallet (WebZjs)
public/circuits/        zeep_spend.wasm, zeep_spend.zkey
styles/                 design tokens and the Vault Door stylesheet
docs/                   architecture and design specification
next.config.ts          security headers: CSP, COOP, COEP, CORP
```

## Security model

- **Secrets stay on the device.** The phrase, PIN and keys exist decrypted only in memory while unlocked. They are cleared on lock, tab close, idle timeout, or after the tab has been hidden for 60 seconds.
- **No accounts, no tracking.** No analytics, error trackers or third-party scripts. The server receives ciphertext only, and only if you turn on chat sync.
- **Strict headers.** Every route sends a CSP (`default-src 'self'`, `font-src 'self'`, `connect-src` limited to the configured API origins), HSTS, `no-referrer`, and cross-origin isolation (COOP `same-origin`, COEP `require-corp`).
- **Self-hosted everything.** Fonts, wasm, circuits and 3D assets are bundled or served from this origin. No CDN is used at runtime.
- **Verified circuits.** Circuit files are checked against pinned SHA-256 hashes before the worker will prove.
- **Hardened unlock.** Argon2id uses 64 MiB per guess, five wrong PINs wipe this device's vault, and the PIN pad gives identical feedback for every key.
- **No clipboard for the phrase.** The recovery phrase can't be copied, which protects it from clipboard hijacking and OS clipboard history.

## Accessibility and performance

- Colour contrast meets WCAG AA on every surface, including glass.
- Proof and vault states are announced through polite live regions and written out as text, not only shown in colour.
- `prefers-reduced-motion` and `NEXT_PUBLIC_FX_LEVEL=off` remove all spinning, swinging and shaking, and skip outcome holds.
- Landing first-load JS is about 114 kB. The 3D chunks are about 245 kB gzipped (budget 250 kB), fetched after first paint and never on app routes.
- Layout shift budget: at most 0.05.

## Contributing

Read the [contributor rules](docs/frontend-architecture.md#rules-for-contributors-thread-safety-and-csp) before changing anything near cryptography or motion. In short:

- Cryptography stays in workers. App routes animate with CSS only, and any loop that can run during a proof ticks at most 10 times a second.
- Motion follows real events (`onProof`, `onKdf`). Timers may only hold an outcome on screen.
- Clear the session before any ceremony. Auto-lock always wins.
- Add no new origins: no CDNs, font services or analytics. Pin new dependencies exactly.
- Commit in small, single-purpose commits with descriptive messages.

Before opening a pull request, run `npx tsc --noEmit`, `npm test` and `npm run build`.

## Deployment

The app deploys to Vercel as a standard Next.js project:

1. Import `.env.example` as environment variables and set `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_PASSKEY_RP_ID` for the real hostname.
2. Add the deployed origin to the backend's `CORS_ALLOWED_ORIGINS`. Because of COEP, API responses must allow the browser to embed them.
3. Push to `main`. Values are baked in at build time, so redeploy after any variable change.

Keep Web Analytics and Speed Insights turned off. The full checklist is in the [deployment section](docs/frontend-architecture.md#deployment) of the architecture doc.

## Documentation

- [`docs/frontend-architecture.md`](docs/frontend-architecture.md): architecture, balances, the proof engine, storage, security headers, configuration and contributor rules
- [`docs/futuristic-design-spec.md`](docs/futuristic-design-spec.md): the v2 design specification
- [`TODO.md`](TODO.md): known issues
