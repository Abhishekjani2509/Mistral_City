# SWE 2 → SWE 1 contract

`city-model.schema.json` is the frozen machine-readable form of `mistral.city-model/v1` from the shared team brief.

- The renderer consumes only `repository`, `city`, `systems`, and `connections` beneath the schema discriminator.
- Scanner facts, quality grades, model metadata, warnings, and building hints remain private to the intelligence layer.
- Connection endpoints must reference an emitted system ID; the runtime validator enforces this cross-reference rule.
- `fixtures/demo-repo-snapshot.json` is the canonical stable sample and includes the `auth` ID used by Repair Cat dispatch.
