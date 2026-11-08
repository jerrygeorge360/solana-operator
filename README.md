# Solana Operator

A conversational DeepSeek agent for Solana Devnet. Ask about your wallet balance, prepare a SOL transfer, or plan an atomic bulk payment to multiple wallets, then review the details and approve in Phantom.

**Live app:** https://solana-operator-live.vercel.app

**MLH hackathon submission notes:** [SUBMISSION.md](./SUBMISSION.md)

## What it does

- Conversational DeepSeek agent with follow-up questions and multi-turn context.
- Live Solana Devnet balance inspection via RPC.
- Single-recipient SOL transfers and atomic **bulk transfers to 2–10 recipients**.
- Transaction review showing all recipient addresses, per-recipient amounts, total SOL, fees, minimum wallet balance, and projected balance.
- Deterministic validation of addresses, duplicate recipients, total amount, transaction size, current balance, and estimated fee.
- Explicit wallet signature: **DeepSeek cannot sign or submit transfers independently**.
- Live Devnet confirmation, Solana Explorer receipts, pending-transaction status recovery.
- Wallet-free guided demo and Phantom mobile browser guidance.

## Stack

JavaScript, HTML, CSS, **DeepSeek API** (`deepseek-flash`), Solana Web3.js, Solana Devnet RPC, Phantom wallet, Vercel Functions, GitHub/Vercel deployments.

## Local development

Clone this repository, install the Vercel CLI, and run `vercel dev`. Configure `DEEPSEEK_API_KEY` as a **server-side environment variable** to enable the conversational AI service; never commit a key to GitHub. A separate DeepSeek API account with credits may be needed.

Use Phantom configured for **Solana Devnet**, and only Devnet test SOL from the official faucet: https://faucet.solana.com/.

## Demo walkthrough

1. Connect Phantom on Devnet.
2. Ask: "I want to send SOL to multiple wallets. Can you help?"
3. Supply recipient addresses, amounts, and optionally a balance to keep in follow-up messages.
4. Review the proposed batch, fees and balance remaining.
5. Only if you agree, sign in Phantom.
6. Check the real on-chain transaction in Solana Explorer.

### Limitations

**Devnet only.** Test SOL has no monetary value. The batch is deliberately capped at ten recipients and must fit in a single legacy Solana transaction. More complex transfer types, token swaps, recurring automation and mainnet support are not implemented. A bulk proposal and DeepSeek tool selection were tested live; an end-to-end wallet-signed bulk transaction should not be claimed as verified until it is actually recorded.

## Safety

This app never asks for or stores seed phrases or private keys. The agent proposes actions, while deterministic client-side checks and the user's own wallet authorize transactions. **Do not use real funds.**
