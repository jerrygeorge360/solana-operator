# Solana Operator — Product Experience Redesign
Status: PROPOSED · review preview before promotion
Date: 2026-11-08
Branch: design/experience-overhaul

## Product promise
"Say what you need. Know what happens next."

A policy-aware assistant that helps a person inspect a Solana wallet and safely prepare an on-chain action without hiding decisions or taking custody. This is an agentic *task workspace*, not a trader terminal and not a marketing landing page.

## Source references consulted
- MIRA frontend (Rail, Topbar, ChatView, trace and workspace architecture): a persistent workspace with inspectable agent behavior.
- Petgyro approved DECISIONS and public UI context: customer-led journey, readable information architecture, clear state/feedback, warm but restrained design, Newsreader + Inter, accessible progressive disclosure, and no generic glassmorphism or heavy shadows.
- Do NOT copy Petgyro's logo or present its brand as Solana Operator's. Translate the design discipline, not the branding.

## Primary job to be done
"Check my Solana Devnet wallet, understand whether this transfer is safe, and submit it only if I explicitly approve it."

## Flow contract (never rearrange)
1. **Describe** — show relevant sample prompts, a composer, and a direct path to connecting a wallet.
2. **Review** — agent presents a readable proposal: what, to whom, for how much, wallet balance, fee and remaining balance.
3. **Approve** — deterministic policies gate the signing action; no model may override them.
4. **Verify** — confirm on-chain, offer a real Explorer receipt, and show activity.

A balance inspection ends at Review with no approval needed. A blocked transfer never reaches signing.

## Information hierarchy
1. Human job: what can I ask?
2. Input: a generous instruction composer.
3. Result: agent's actual proposal in plain English.
4. Risk: policy, fee and remaining balance.
5. Action: wallet signature only after validated.
6. Evidence: trace on demand and on-chain receipt.

Wallet/network context sits alongside the task, not as a competing primary dashboard.

## Visual direction
Calm, editorial, product-first. Dark ink navigation rail, warm paper canvas and structured white work surfaces. Restrained sage/deep-green actions and terracotta context accents. Newsreader for editorial display, Inter for dense utility. No glassmorphism, fake data, gradient ornaments, gratuitous icon tiles or excessive shadows.

These are project-specific provisional tokens for this design preview, NOT a modification to Petgyro's approved palette.

## Accessibility / responsive acceptance
- 320px mobile, 768px tablet, 1440px desktop: no horizontal overflow.
- Actual button labels; inputs accessible; keyboard focus visible.
- Action disabled while awaiting server/wallet; no fake success state.
- Errors alongside the relevant field/action, not transient toasts only.
- Full recipient address visible on Review, not only truncated wallet chip.
- Trace is inspectable but collapsed by default.
- Network and test token limitations communicated upfront.

## Backend and wallet invariants
- Preserve existing `/api/agent` contract and DeepSeek API integration.
- Wallet's private keys never enter app source, persistence, or model context.
- Always use Solana Devnet.
- Independently re-read balance and estimated fee before wallet signing.
- Enforce user-specified minimum balance even if LLM outputs a weaker reserve.
- Reject model proposals with recipient not present in user's instruction or with an amount contradicted by user text.
- Show links only for confirmed blockchain transactions.
- Distinguish successful AI tool calls from local deterministic fallback.

## Review gates
- [x] Journey + screen architecture specified.
- [x] Frontend implementation verified with static syntax and HTML checks.
- [ ] Responsive visual review at mobile/tablet/desktop.
- [ ] End-to-end connected-wallet / transfer test in browser.
- [ ] Human design approval.
- [ ] Production promotion (only after approval).
