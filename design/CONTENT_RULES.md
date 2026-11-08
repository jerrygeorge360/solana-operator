# Solana Operator — Interface Voice & Content Rules

Status: Preview review standard · 2026-11-08
This guide governs visible copy in the operator workspace and AI-generated summaries.

## Voice

**Specific, calm, plain English.** Write as a practical wallet utility. No manufactured personality, self-congratulation, or financial hype.

The user should be able to tell, within seconds:
- What the application can do right now.
- Whether the agent actually called a tool or used a parser.
- Whether the transaction is only proposed, awaiting a wallet signature, submitted, or confirmed.
- What to do when a request cannot continue.

## Rules
1. **Name the action, not the technology.** "Check balance" rather than "Leverage on-chain intelligence".
2. **Use observable claims only.** "Fee estimated from Devnet RPC" is acceptable after a real RPC result. "Safe and secure" is not.
3. **Never pretend to be an official Solana service.** Say "Solana Devnet · Unofficial" and don't use "by Solana".
4. **Say what will happen before asking for a signature.** "Continue to wallet" is clear; "Unlock your potential" isn't.
5. **Prefer a sentence to a slogan.** The home page can say "Check your balance. Plan a transfer."
6. **Never mask a fallback.** Distinguish "DeepSeek responded" from "Built-in parser used."
7. **Don't dump unverified AI prose into critical UI.** Render transaction details and status from validated state. Put actual tool events in an inspectable trace.
8. **Don't imply completion prematurely.** "Transfer submitted" and "Transfer confirmed" must be distinct.
9. **Failure copy gives the next step.** "Connect your wallet first. Your request will stay here" or "Lower the amount or change your limit."
10. **No invented testimonials, activity, network stats or wallet balances.**
11. **Use Devnet consistently.** Test SOL does not have monetary value.
12. **Buttons should be verbs.** Check request; Connect wallet; Continue to wallet; View on Explorer.

## Phrases to avoid

"Revolutionize", "unlock", "seamless", "intelligent experience", "empower", "your journey", "AI-powered magic", "the chain confirms it", "trust is the feature", "take full control", "next-generation", "cutting-edge", "agentic future", "effortlessly", "elevate", "transparent intelligence".

Do not overcorrect into sterile protocol language. Use human wording for users and full technical names only in the optional activity trace.

## Example copy

| Event | Preferred text |
|---|---|
| No wallet | Connect your wallet first. Your request will stay here. |
| Balance checked | This balance was read from Solana Devnet. |
| Parsed fallback | DeepSeek didn't respond. A built-in parser read this request. |
| Fee check passed | The amount fits your limit, including the estimated fee. |
| Policy blocked | Sending this amount would leave less SOL than you asked to keep. |
| Wallet approval pending | Review and approve the transfer in your wallet. |
| Submitted | Transfer submitted. Checking its status on Devnet… |
| Confirmed | Transfer confirmed. Receipt available below. |
| No supported request | Try "check my balance" or "send 0.05 SOL to …". |

## Release copy gate
- Review every hardcoded UI string plus default sample text and generated status.
- Confirm no model-composed text is used as an authority for risk, balances, or execution success.
- Preview on phone and desktop so labels do not truncate or collapse.
- Show failures, not only successful paths.
- Verify that fallback, proposed, submitted, confirmed, and failed are visually distinct.
