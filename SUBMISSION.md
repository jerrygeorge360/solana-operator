# MLH Solana Hackathon — Submission (November 8, 2026)

**STATUS: READY TO ENTER — NOT YET SUBMITTED.** The official MLH submission form shows a close time of November 8, 1:00 PM EST (7:00 PM WAT). Do not rely on a draft: click **Submit Project**.

## Project name
Solana Operator

## Short description / one-line pitch
A conversational AI agent for Solana that understands requests, prepares single or bulk Devnet transfers, and lets users approve every transaction.

## Project description (paste in MLH)

Solana Operator makes on-chain transfers feel like a conversation. You can ask the agent to check a Solana Devnet balance, send test SOL to a wallet, or set up a bulk transfer to multiple recipients. If you leave something out, the agent asks a follow-up question and remembers your earlier answers.

Behind the conversation, the AI agent uses tools to inspect real Devnet wallet data and propose transfers. Bulk transfer requests support 2–10 recipients. A proposed batch is constructed as one atomic Solana transaction, so the transfers either succeed together or fail together.

Before any signature, the interface presents every recipient, individual amount, total SOL, estimated network fee, minimum balance to retain, and projected balance remaining. Deterministic checks verify wallet addresses, positive amounts, duplicates, transaction size and affordability. The app refreshes balance and fee information before requesting the user's wallet signature.

The agent can plan, but it cannot sign or move funds by itself. Phantom handles signing, while Solana RPC provides transaction confirmation and an Explorer receipt. If a submitted transaction's confirmation is delayed, the interface retains its signature and lets the user check its status without blindly submitting again.

The project uses Solana Devnet and test SOL only. The goal is to demonstrate how natural-language agents can help people initiate real on-chain actions without surrendering wallet control.

The public app includes a wallet-free walkthrough. A live two-turn agent test successfully asked for a missing recipient and prepared a transfer proposal. A separate live test verified a two-recipient bulk proposal. **A wallet-signed bulk transaction has not yet been independently verified end-to-end; do not claim it as completed unless the recording confirms it.**

## Technologies / Built with
Solana Devnet, Solana Web3.js, Solana JSON-RPC, Phantom wallet, DeepSeek API (deepseek-flash), JavaScript, HTML, CSS, Vercel Functions, Vercel, GitHub, Solana Explorer.

## Links
- Live demo: https://solana-operator-live.vercel.app
- Source code: https://github.com/jerrygeorge360/solana-operator
- Video draft link: https://youtu.be/AyH7a3-cSl8 — **must verify video is uploaded and playable before adding to the form**.

## Recommended categories and sponsor usage responses

### Top 3 Overall
Solana Operator combines a real conversational tool-using agent with Solana Devnet wallet operations. The agent gathers missing details through conversation and creates single or atomic bulk-transfer proposals; deterministic policy validation and explicit Phantom signatures retain user control over every transfer.

### AI Track Top Prize
The conversational agent interprets natural-language requests, asks follow-up questions, retains context and selects tools to inspect wallets or propose single and bulk transfers. The agent never directly signs or submits blockchain transactions, and every proposed action is separately validated before wallet approval.

### DeFi Track Top Prize
The app demonstrates guarded Solana payment operations with multi-recipient atomic SOL transfers, minimum-balance reserves, fee estimates and independent approval. Its prototype shows how policy-aware interfaces can make future on-chain payment and treasury workflows easier to use.

**Do not enter Best Beginner Hack unless this is genuinely your first hackathon. Do not enter Gaming Track.**

## Experience questions (edit to reflect your own assessment)

### What did you like, what challenged you, and what would improve Solana?
I liked that Solana lets a browser-connected wallet sign low-fee on-chain transactions with quick feedback from Devnet RPC. The most challenging part was making the agent's conversational instructions translate into safe transaction proposals, especially validating multiple recipients and amounts, estimating fees and distinguishing a submitted transaction from a confirmed one. More complete end-to-end wallet and mobile testing examples would help hackathon teams ship reliable demonstrations faster.

### Most interesting thing learned
A single Solana transaction can bundle multiple SOL transfer instructions atomically. That makes a useful foundation for bulk payments, provided the app checks transaction size, fees and each recipient before signing.

### Required personal/subjective questions — choose YOUR actual answers
- Overall building experience (1–5): [choose]
- Likelihood of recommending Solana (1–10): [choose]
- Better understanding of web3 (Likert): [choose]
- Had the resources needed (Yes/No): [choose]
- Likelihood of using Solana again: [choose]
- Interested in future Midnight Hackathons (Yes/No): [choose]

### AI coding tools and models
Mark only the coding tools you actually used (for example Codex if used). Do **not** mark DeepSeek as a coding model solely because the finished app calls DeepSeek API; it belongs under Technologies. Select "Not sure which model" where the exact coding-assistant model is uncertain.

## Last-minute submission checklist
- [ ] Make YouTube draft URL publicly playable (Unlisted is fine).
- [ ] Paste project name, short pitch, description and technologies.
- [ ] Add website, GitHub and video links (video only if playable).
- [ ] Choose Top 3 Overall, AI Track and DeFi Track and paste their category explanations.
- [ ] Answer all required personal experience questions.
- [ ] Select actual AI coding tools used.
- [ ] Click **Submit Project**, not Save draft.
- [ ] Record confirmation URL and screenshot.
