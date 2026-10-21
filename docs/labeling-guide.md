# Labeling guide: rule types

For hand-labeling the sample policies (Shane and the classmate labeler use this same text). Label each rule with exactly one of five values. Examples are from other domains on purpose; do not look at Tenet's output for a policy before your labels for it are committed. The short definitions are the card in `docs/plan/agents-and-prompts.md` §0; this guide adds a test question for each.

| Label | In one line | The test | Signal words | Example |
|---|---|---|---|---|
| `constraint` | A bright line: a specific act is forbidden or required regardless of outcome | "Could a good enough reason justify breaking it?" If the rule says no → constraint | never, always, must, do not … without …, only if | "Never share a customer's order history with anyone but the account holder." |
| `tradeoff` | A dial: two or more named values are weighed and the right action shifts with the stakes | "Does the right answer change as the stakes change?" Yes → tradeoff | weigh, balance, X against Y, proportionate to | "Balance the cost of a replacement shipment against the likelihood the original was lost." |
| `disposition` | A manner: how the agent should be across everything it does, not one act | "Can I check this on one action, or only by watching many conversations?" Many → disposition | be …, act like …, keep it … | "Act like a thoughtful mentor, not a rule-reciting clerk." |
| `ordering` | A tiebreaker: a rank of values or rules for when they conflict | "Does this only matter when two goals collide, and does it name the winner?" Yes → ordering | takes precedence over, A over B, A first, A before B | "Safety recalls take precedence over sales targets, which take precedence over response time." |
| `ambiguous` | The rule's own words don't settle which of the four it is | A bare goal with no specific act, no named values to weigh, and no rank | (often a short goal statement) | "Do right by the customer." |

## How to decide

1. Ask the tests in order (constraint, tradeoff, disposition, ordering) and stop at the first one that fits. If none fits, use `ambiguous`.
2. Label the words on the page, not what the authors probably meant or how you would test it.
3. A condition or exception does not change the type: "never X unless Y" is still a constraint, and a numeric trigger for a required act ("refunds above $500 need a manager") is still a constraint.
4. A "never" inside a manner rule is still a disposition ("Be patient with frustrated customers and never match their tone").
5. `ambiguous` is a legitimate answer, not a failure: it is a finding about the policy.

## Close calls

Give your lean as the label and add the runner-up:

```json
{ "n": 4, "quote": "…", "label": "tradeoff", "lowConfidence": true, "alternatives": ["ordering"] }
```

When finished, set `"labeledAt": "YYYY-MM-DD"` at the top of the file.
