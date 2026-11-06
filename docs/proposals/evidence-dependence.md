# Evidence-dependence proposals

This note records future design questions. The current evaluator and its implemented identity rules are described in [Inquiry model](../inquiry.md). Joint-likelihood inference and automatic dependence correction remain unimplemented.

## Problem

One source may relay another, several arguments may reuse one factual premise, and different studies may share data or methods. Source identity alone does not determine statistical dependence. Two arguments from one paper may use distinct information, while papers with different titles may reanalyse the same dataset.

The current graph preserves canonical and relay source IDs, shared claim IDs, and shared ancestry. It then applies each adopted premise-to-target relationship directly. It does not calculate an automatic discount for common sources, reconvergent ancestry, shared datasets, or press relays.

## Current editorial rule

- An exact restatement remains one argument with one canonical source and optional relay references.
- New factual content becomes an explicit premise with its own target relationship.
- Different estimates of the same implication remain competing assessments until the inquiry adopts an impact.
- A shared premise uses one claim ID. Study-specific premises remain separate.
- Press coverage supplies provenance or a new bounded fact; publication count alone adds no weight.

These rules improve inspectability without claiming a solved dependence calculus.

## Possible joint model

When an outcome model is available, an evidence item can be expressed as a likelihood ratio:

$$
L(E;H)=\frac{P(E\mid H)}{P(E\mid\neg H)},
\qquad
w(E;H)=10\log_{10}L(E;H)\ \mathrm{dBan}.
$$

Dependent evidence requires a joint likelihood:

$$
w(E_1,E_2;H)=10\log_{10}\frac{P(E_1,E_2\mid H)}{P(E_1,E_2\mid\neg H)}.
$$

The incremental value of $E_2$ after $E_1$ is the joint weight minus the weight of $E_1$. Under a correct joint model, an exact copy contributes zero. Real inquiries often lack the distributions needed to make that calculation defensible.

## Example of shared components

Suppose source $A$ contains premises $P$ and $Q$, while source $B$ contains $P$ and $R$. If an assessor justifies conditional independence of $P,Q,R$ and assigns $+6,+4,+2$ dBan, the union is $P+Q+R=12$ dBan. Adding the two source totals would count $P$ twice.

Signed totals cannot reveal this decomposition themselves. Extraction must identify the shared component and its scope. Similar wording does not prove that two findings are the same component.

## Open decisions

- how to record dataset, method, and citation ancestry without turning source metadata into weight;
- how to represent same-data reanalysis and partially shared populations;
- when a joint likelihood is available and when to show a sensitivity range;
- how to handle reconvergent graph paths efficiently;
- how to version extractions and assessments while retaining review history;
- how to expose unresolved dependence without an opaque overlap score.

Magnitude averaging, generic copy probabilities, and fixed overlap discounts remain poor defaults because they hide the assumptions that determine the result. A future workflow should record the model, assessor, conditions, before/after values, and unresolved frontier explicitly.
