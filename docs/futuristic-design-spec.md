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
