# Solana Operator

A policy-aware on-chain assistant for Solana Devnet. Describe a wallet operation in natural language, see an explicit proposal and safety checks, then approve the transaction with your own wallet. No private key is ever collected by the application.

**Live prototype:** https://solana-operator.vercel.app

Built for the MLH Solana Hackathon (November 6–8, 2026).

## MVP

- Solana Devnet wallet connection and live balance lookup
- Plain-English SOL transfer planning
- Deterministic minimum-balance guardrail that includes estimated network fees
- Human approval through the user's wallet
- On-chain transaction confirmation with a Solana Explorer receipt
- Optional server-side AI interpretation via Vercel AI Gateway or OpenAI (requires configured provider; rule-based fallback is clearly labeled)

## Architecture

Static responsive frontend in `index.html`; Solana Web3.js in browser; Vercel serverless function in `api/agent.js` for optional AI intent parsing. Private keys never leave the wallet; policy validation takes place before wallet signing.

## Run

Serve the project using `npx vercel dev` (or any static server for the frontend). Configure an AI provider in the Vercel project environment for LLM-backed intent parsing. The app requires a browser wallet with **Solana Devnet enabled**, and Devnet test SOL from https://faucet.solana.com.

## Demo instruction

Connect a Devnet wallet, and enter: `Send 0.05 SOL to <DEVNET_RECIPIENT_ADDRESS> but keep at least 0.2 SOL.` Review the fee and projected remaining balance, approve the transaction in your wallet, then open its Solana Explorer link.

**Safety:** Devnet only. No mainnet or financial advisory functionality. Confirm every transaction in your wallet.

## Notes

This hackathon MVP is intentionally narrow. The AI component proposes an action, while deterministic code validates it and the user signs it. A parser fallback is not presented as an LLM-powered agent.
