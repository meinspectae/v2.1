# Local QA ledger — 2026-11-11

Shared project database: created 0, edited 0, deleted 0. Everything below is isolated in-memory SQLite, discarded when tests finish. No SQL DELETE of orders/payments was executed.

## Safety harness

| Table | ID | Explicitly deleted |
|---|---|---|
| users | qa-normal | no; isolated database discarded |
| users | qa-tester | no; isolated database discarded |
| users | qa-flag-admin | no; isolated database discarded |
| users | qa-allowlisted | no; isolated database discarded |
| users | qa-credit-different-reports | yes |
| inspections | qa-credit-different-reports-a | no; isolated database discarded |
| inspections | qa-credit-different-reports-b | no; isolated database discarded |
| orders | 1 | no; isolated database discarded |
| users | qa-credit-same-report | yes |
| inspections | qa-credit-same-report-a | no; isolated database discarded |
| inspections | qa-credit-same-report-b | no; isolated database discarded |
| orders | 2 | no; isolated database discarded |
| users | qa-credit-same-report-two-credits | yes |
| inspections | qa-credit-same-report-two-credits-a | no; isolated database discarded |
| inspections | qa-credit-same-report-two-credits-b | no; isolated database discarded |
| orders | 3 | no; isolated database discarded |
| users | qa-credit-rollback | no; isolated database discarded |
| inspections | qa-credit-rollback-report | no; isolated database discarded |
| inspections | webhook-paid | no; isolated database discarded |
| orders | 4 | no; isolated database discarded |
| inspections | webhook-no_payment_required | no; isolated database discarded |
| orders | 5 | no; isolated database discarded |
| inspections | webhook-parallel | no; isolated database discarded |
| orders | 6 | no; isolated database discarded |
| inspections | webhook-delayed | no; isolated database discarded |
| orders | 7 | no; isolated database discarded |
| inspections | webhook-failed | no; isolated database discarded |
| orders | 8 | no; isolated database discarded |

## Compatibility harness

Inspection fixtures: paid, completed, finalised, report, timestamp, registered, payment, order, draft, owned, account-draft. Draft explicitly deleted through inspection endpoint; owned and account-draft deleted through account endpoint. Other protected rows retained until isolated database discarded.

Report verification: reg. Payment: locally generated id 1. Order: locally generated id 1. Orders/payments not deleted. No user rows created.

Email quota rows were created only in isolated local SQLite. The reset removes exactly the successful earlier fixture events; the boundary and winner are aged for expiry testing.

| Event ID | Outcome |
|---|---|
| 42119182-a731-4420-96d1-7c61f8a392c2 | created then explicitly deleted |
| 8f7a3561-4f90-4bfe-b554-7876191a1d7e | created then explicitly deleted |
| 2cd17e85-50c0-490e-be97-c651a22b1328 | created then explicitly deleted |
| d8458d24-07a3-40d9-8348-9a896ae2b10c | created then explicitly deleted |
| 82d7a2eb-21ba-466b-9269-a8e4135dedc0 | created then explicitly deleted |
| cfc67e67-cf44-44eb-b232-724fea10d8d3 | created; local DB discarded |
| 41418e7e-e96f-434a-875e-321026e7fff7 | not created; conditional INSERT rejected |
| 14a2d894-43dd-4911-b4ea-1bcb8d20b577 | not created; conditional INSERT rejected |
| e59a086a-004d-4338-a75b-78bc78d8b735 | created; local DB discarded |
| boundary | direct fixture created; local DB discarded |

All successful IDs are enumerated above. No shared email events were created.
