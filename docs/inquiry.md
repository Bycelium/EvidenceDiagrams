# Inquiry model

Inquiry evaluates a directed acyclic graph of claims joined by sourced evidence relationships. It is the model used by the standalone demo and the `@bycelium/evidence-diagrams` Inquiry API.

## Data model

```ts
type Inquiry = {
  rootClaimId: string;
  claims: Array<{
    id: string;
    title: string;
    description?: string;
    prior: { mean: number; standardDeviation: number };
  }>;
  contributions: Array<{
    id: string;
    title: string;
    url?: string;
    locator?: string;
  }>;
  evidence: Array<{
    id: string;
    contributionId: string;
    relayContributionIds?: readonly string[];
    premiseClaimId: string;
    targetClaimId: string;
    impact: { deltaMean: number; deltaStandardDeviation: number };
  }>;
};
```

The package requires a prior for every claim. Descriptions and source URLs remain optional in the general API. The demo applies stricter authoring rules: a new premise needs a description, and a new source needs an HTTP(S) URL. Its default prior is `{ mean: 0, standardDeviation: 5 }` dBan.

`contributionId` identifies the canonical source for an argument. `relayContributionIds` may identify declared press or reference sources that relay it. A relay adds provenance without adding another mathematical impact.

Validation rejects duplicate IDs, missing references, cycles, repeated relay IDs, a canonical source repeated as a relay, and duplicate premise-to-target relationships. One premise may feed several targets. Its evaluated posterior is cached and reused by every outgoing relationship.

## Gaussian replay

Claim distributions are Gaussian in decibans. For a premise posterior

$$D_P\sim\mathcal N(\mu_P,\sigma_P^2),$$

the evaluator uses the expected logistic probability

$$
q_P=\operatorname E\left[\frac{1}{1+\exp\left(-\frac{\ln 10}{10}D_P\right)}\right].
$$

For each relationship in the selected replay order, it applies the saved conditional impact to the target:

$$
\mu_{i+1}=\mu_i+q_P\,\Delta\mu_i,
\qquad
\sigma_{i+1}=\left|\sigma_i+q_P\,\Delta\sigma_i\right|.
$$

Premises are evaluated recursively before their probabilities are used. The displayed credibility interval is the exact Gaussian $\mu\pm3\sigma$ band. For the demo default prior, that band is $[-15,+15]$ dBan and the expected probability is exactly $0.5$.

The default API replay order is the evidence array order. The demo requests `weakest-first`, which sorts relationships by ascending `abs(qP * deltaMean)` after evaluating their premises. Ties keep array order. Since the standard-deviation update is sequential, replay order can affect the final width.

Editing a conditional force in the demo replaces `deltaMean` and preserves an existing `deltaStandardDeviation`. Newly added relationships start with `deltaStandardDeviation: 0`. Editing a prior or conditional force reevaluates its recursive dependants.

## Worked example

Give root $R$ and premise $P$ the default prior. A relationship $P\to R$ has $\Delta\mu=+10$ dBan and $\Delta\sigma=0$. Since $q_P=0.5$, the root moves from $(0,5)$ to $(5,5)$.

Now add a default-prior child $C$ to $P$ with $\Delta\mu=-10$ dBan. The child moves $P$ to $\mathcal N(-5,25)$, whose expected probability is $q_P=0.2857071794$. Replaying the root from its prior gives $\mu_R=10q_P=2.857071794$ and $\sigma_R=5$.

| State of $R$ | Mean | Standard deviation | Exact $\mu\pm3\sigma$ band | Expected probability |
|---|---:|---:|---:|---:|
| Prior | $0$ | $5$ | $[-15,15]$ | $50\%$ |
| Before adding $C$ | $5$ | $5$ | $[-10,20]$ | $71.429\%$ |
| After adding $C$ | $2.857071794$ | $5$ | $[-12.142928206,17.857071794]$ | $62.728\%$ |

## Interpretation and limits

The source observation, the credibility assigned to its premise, and the conditional premise-to-target impact are separate judgments. The demo's numeric priors and impacts are editable illustrations; publisher status does not set them automatically.

Shared claim IDs preserve a common evaluated premise across branches. Shared contribution IDs preserve source identity. Distinct arguments may use different facts or benchmarks from one source. The evaluator applies each adopted relationship and does not automatically estimate correlation, common-source dependence, press-relay dependence, or shared-method dependence.

See [Nuclear-demo source audit](nuclear-sources.md) for the scopes encoded in the preset and [Dependence proposals](proposals/evidence-dependence.md) for future design questions.

## Demo behavior

The demo can hold several in-memory root inquiries. Each retains its evidence, navigation, view state, and reset baseline while the page is open. Reset affects the active root only.

The graph shows prior and current Gaussian bands, premise-weighted evidence steps, accumulated support, opposition, and dissonance. Selecting a step opens its canonical source, conditional force, premise credibility, and current impact. The conditional and current-impact arrows share the same dBan scale.
