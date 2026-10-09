# Payments go through Polar, a merchant of record

**Status: proposed.** Researched from the providers' public pricing pages (October 2026) rather than a live grilling session; confirm with the maintainer before ticket 81 signs up. The one open check is below.

## Context

Ticket 84 needs a payment processor for the paid plan (ADR 0014's hosted phase; first paid feature is ticket 85's hosted-link QR). Constraints: customers worldwide, a free tier plus one paid subscription, a solo maintainer who can't register for VAT/sales tax in every jurisdiction, a self-hosted backend (ADR 0022) that should only need to receive webhooks and read a plan status, and no fixed monthly cost while revenue is near zero.

The deciding axis is **who is the seller of record**. With a plain processor the maintainer owns tax collection, filing and remittance everywhere; with a merchant of record (MoR) the provider is the legal seller and handles it.

## Decision

Use **Polar** (Starter plan).

| Provider | Model | Fee | Notes |
| --- | --- | --- | --- |
| Polar | MoR | 5% + 50¢ (Starter, no monthly fee); +1.5% international cards | Built for software subscriptions, API and webhooks, open source, payouts via Stripe Connect |
| Paddle | MoR | 5% + 50¢, no monthly fee | Mature MoR; products under $10 need special pricing consultation, which a small hobby plan may hit |
| Lemon Squeezy | MoR | 5% + 50¢; +1.5% international, +0.5% subscriptions | Owned by Stripe; future direction less certain; extra fees stack |
| Stripe (Billing + Tax) | Processor | ~1.5-3.25% + fixed, +0.7% Billing, +0.5% Tax | Cheapest per charge, but the maintainer is the seller and owns tax registration and filing; Stripe's own MoR option adds 3.5% on top |

Polar wins over Paddle and Lemon Squeezy on fit rather than headline fee (all three MoRs charge about the same): no minimum-price friction, an API shaped for entitlement checks, and no dependence on one acquirer's roadmap. Stripe is rejected because tax compliance would cost the maintainer more than the fee difference saves.

## Consequences

- Ticket 81 creates a Polar organisation, defines the plan, and produces an access token and webhook secret for ticket 84.
- **Open check for ticket 81:** confirm the maintainer's country is supported for Polar payouts (Stripe Connect). If not, fall back to Paddle, which has the same fee and an equivalent MoR model.
- Plan gating (ticket 84) stays provider-agnostic: the backend stores a plan status per account, updated from webhooks, so switching provider changes only the webhook adapter.
- Fees are ~5% + 50¢ plus 1.5% on international cards; pricing must absorb that. Payouts add Stripe payout fees.

## Considered options

- Stripe with Stripe Tax: rejected, see above.
- Staying on the free tier forever / donations only: out of scope for this ticket; the paid plan is already decided.
