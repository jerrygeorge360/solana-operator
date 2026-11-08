# MLH Solana Hackathon — Submission Draft

## Name
Solana Operator

## One-line pitch
A policy-aware AI agent that translates natural-language wallet instructions into inspectable, human-approved Solana Devnet operations.

## Description
Solana Operator explores a safer interface for on-chain actions. Instead of manually navigating blockchain transaction flows, a user can describe an intention, such as checking their Devnet wallet balance or sending test SOL while keeping a minimum amount untouched.

The application includes an optional server-side LLM planning endpoint with tools for inspecting a live Solana Devnet wallet and proposing a transfer. Every actual transaction is prepared and validated separately by deterministic browser code: it checks the live balance, obtains the estimated Solana network fee, enforces the user's minimum-balance reserve, and requires approval through a connected wallet. No secret keys are requested or stored.

After a successful transfer, the app displays a Solana Explorer link to verify the on-chain result. If the AI gateway is unavailable, a clearly labeled rule-based fallback is used rather than pretending that an AI model was called.

The goal is to show how agentic interfaces and transparent on-chain execution can work together without giving a language model direct custody of funds.

## Technologies
JavaScript, HTML/CSS, Solana Web3.js, Solana Devnet RPC, Solana Explorer, Vercel Functions, Vercel AI Gateway (or OpenAI API when separately configured), GitHub, Vercel.

## Source code
https://github.com/jerrygeorge360/solana-operator

## Live demo
https://solana-operator-live.vercel.app

## Prize categories
### Top 3 Overall
An interactive Solana application that ties together real blockchain state, explicit on-chain transaction approval, deterministic spending constraints, and an inspectable AI planning flow.

### AI Track
An LLM-powered planning endpoint can select tools to inspect a Solana Devnet wallet and propose a transfer. The app separates model interpretation from enforceable policy checks and user-controlled signing. This makes AI-driven blockchain interactions auditable and safer.

### DeFi Track (optional, if appropriate to judges)
The project applies user-specified reserve limits and estimated network-fee accounting to SOL payment operations. These safeguards explore a foundation for policy-based on-chain financial automation.

## AI coding tools
Codex (select if actually used). For the underlying coding model, select only the actual model used, or "Not sure which model" when appropriate. APIs called by the product belong under technologies, not AI coding tools.

## Demo procedure
1. Open the live URL in a browser with Phantom wallet installed and set the wallet to Solana Devnet.
2. Connect the wallet and refresh the balance.
3. Ask: "Check my wallet balance." Inspect the trace.
4. With a funded Devnet account and a valid Devnet recipient address, ask: "Send 0.05 SOL to [recipient] but keep at least 0.2 SOL."
5. Observe the estimated fee and reserve policy. If sufficient, approve in the wallet and open the Solana Explorer receipt.
6. Optionally demonstrate a blocked transfer where the minimum balance would be violated.

## Verify before final submission
- [ ] New Git-backed live URL is publicly accessible
- [ ] Wallet connection succeeds with Phantom
- [ ] Live Devnet balance fetch succeeds
- [ ] AI planning endpoint actually returns an LLM tool-call trace (otherwise label fallback)
- [ ] One real Devnet transfer is approved and confirmed (otherwise do not claim transaction demonstration)
- [ ] Screenshots or demo video collected
- [ ] MLH submission saved and actually submitted

## Honest limitations
Devnet only; SOL transfers and balance inspection only. The agent proposes rather than autonomously signs. This is a hackathon prototype, not a DeFi product or audited wallet application.
