# Fruti Squad runtime policy

This repository uses a context-efficient execution model for coding agents (Claude Code, Codex, Kiro). Claude Code loads this file through `CLAUDE.md`. The user's natural language is the interface; never require the user to name phases, reference files, loading rules, or internal state.

## Core rule: route first, read second

Do not preload agent/skill reference directories. Do not recursively read `references/`, `reference/`, `examples/`, `templates/`, `assets/`, or long standards merely because they are linked from an AGENT/SKILL file.

For every request:
1. Identify the active artifact/surface and requested operation from natural language.
2. Read `.fruti/state/current.json` when present, then the active Lima project profile and relevant registry entry.
3. Select the owning agent and phase using `.fruti/runtime/<agent>.yaml`; do not open the full AGENT/SKILL manual unless the compact runtime contract cannot resolve the operation.
4. Read ONLY the references listed for that operation by the runtime contract. A filename mentioned in an AGENT/SKILL document is not an instruction to load it unless the current phase requires its rules.
5. Prefer machine-readable contracts/manifests and targeted searches over rereading prose standards.
6. Execute the work.
7. Persist a compact handoff/state delta so the next request starts from current truth rather than reconstructing history.

Deep AGENT/SKILL/reference prose remains normative when a rule is ambiguous, disputed, changed, or cannot be evaluated from the compact contract. Runtime contracts are indexes, not replacement sources of truth.

## Approved Sources Only

All agents MUST distinguish between normative authority and implementation evidence. Agents may inspect the code required to execute or verify a change (see Code inspection boundary), but MUST NOT use anything else as a source of design rules.

### Normative authority order

Use the narrowest approved source that owns the decision:
1. Active user instruction for the current request.
2. Approved structural lock / current handoff for frozen architecture, anatomy, geometry, states, and adaptive behavior.
3. Component or pattern contract for component semantics, variants, API, accessibility obligations, and allowed behavior.
4. `.fruti/tokens.json` (when present) for visual-system values and semantic design tokens; generated token outputs are derivatives, not independent authority.
5. Active project profile for implementation target, framework/language, styling strategy, breakpoints, and project configuration.
6. Registry for lifecycle, ownership, canonical identity, reuse/extend/new/local disposition, and promotion status.
7. Audit manifest and verified compliance evidence for QA criteria/results.
8. Deep AGENT/SKILL/reference prose only when the compact approved sources explicitly require it or a rule remains unresolved/ambiguous.

When two approved sources conflict, do not silently choose whichever is convenient. Prefer the source that canonically owns that decision; if ownership itself is ambiguous, mark the decision `unresolved` and route it to the owning agent.

### Forbidden inference

Agents MUST NOT:
- infer a design rule from unrelated or neighboring components, or by scanning the repository broadly when the relevant approved contract/token already exists;
- copy raw colors, font sizes, spacing, radii, shadows, motion values, breakpoints, or other visual values from existing code when an approved token/contract owns that decision;
- treat an implementation accident, legacy value, screenshot, demo, example, or historical artifact as design-system truth;
- reinterpret a frozen lock without routing the structural change back to Kiwi/Lima as appropriate.

### Code inspection boundary

Existing code is implementation evidence, not design authority. An agent MAY inspect:
- the exact files it must modify;
- direct dependencies/imports needed to understand or safely edit those files;
- generated outputs that must be regenerated or verified;
- targeted implementation/API evidence required by the current contract or audit rule.

### Missing decisions

If an approved source does not define a required decision:
1. Do not infer it from unrelated code, and do not invent a value merely to keep execution moving.
2. Record it as `unresolved` in the active handoff/state delta.
3. Route it to the agent that owns the decision (Kiwi for structure/UX geometry, Lima for governance/contracts/tokens ownership, Coco for implementation-only choices inside an approved contract, Mora only for documentation gaps).
4. Ask the user only when the missing decision is genuinely a product/identity choice that cannot be derived from an approved default.

### Token discipline

Typography: semantic roles and sizes come from `.fruti/contracts/typography.yaml` (`recommended_scale`) unless the profile persists `typography.scale_mode: custom`; a free-text scale line in `type_law` is descriptive only (see the contract's `authority` block).

When `.fruti/tokens.json` exists, it is the canonical editable source for global visual tokens. Components consume semantic tokens rather than owning duplicated raw values.

A request such as `cambia la fuente principal`, `cambia el color de acción`, or `haz los radios menos redondeados` should update the owning semantic token/configuration and regenerate affected derivatives. It should not trigger component-by-component visual reinterpretation.


## Redesign mode: understand before changing

Fruti Squad supports both greenfield design and redesign of an existing product. A redesign is NOT permission to rewrite the application or treat legacy styling as target truth.

When redesign intent is detected, Kiwi runs `understand → inventory → scope (user approval) → redesign_plan` (operations and rules in `.fruti/runtime/kiwi.yaml`), persisting to `.fruti/redesign/scope.yaml`, `.fruti/design/design-direction.yaml` and `.fruti/redesign/plan.yaml`. Only then the normal Kiwi → Lima → Coco → Mora handoffs run, per approved item. References are inspiration (qualities, not specifications).

### Redesign statuses

Use: `not-reviewed`, `proposed`, `approved`, `excluded`, `preserve`, `completed`.

- `excluded`: agents MUST ignore the surface for direct redesign. Do not modify it as a redesign side effect. Approved global-token propagation is tracked separately and must not be misrepresented as a direct redesign.
- `preserve`: current structure/behavior is intentionally frozen. Visual work may only touch what the approved scope explicitly allows.
- `approved`: eligible for the redesign plan and downstream execution.

### Existing-product boundary

In redesign mode, existing code is an authorized source for understanding current functionality, data requirements, routes, interactions and implementation constraints. It is NOT an authorized source for deciding the target visual identity unless the user explicitly marks a current rule as preserved.

Do not copy legacy colors, spacing, typography, radii, shadows, component styling or layout conventions merely because they exist. The target design direction, approved contracts and tokens own the redesigned visual system.

### Design direction

`.fruti/design/design-direction.yaml` is the approved compact source for experiential intent (perception, quality level, composition, device emphasis, anti-patterns). It guides Kiwi's structure and Lima's checks; `.fruti/tokens.json` remains the canonical materialization of visual values.

## Round isolation and repair ownership

Every `fruti test` run is an immutable round under `.fruti/tests/rNN/`. A failed round may reference earlier evidence but MUST NOT present an earlier F3 or Mora page as if generated by the current round. Missing downstream artifacts are reported as NOT GENERATED.

When Lima rejects Kiwi F2, Lima may specify failed rule IDs, constraints to preserve, and the required reconsideration. Lima MUST NOT rewrite geometry, move actions, regroup regions, or otherwise redesign F2. Ownership returns to Kiwi, which creates the next structural revision.

## NEW foundations

When the active profile has `design_system: NEW`, run `fruti foundations` before expecting a valid F3 visual PASS. The command creates a proposal, not canonical truth. Lima materializes tokens/foundations and updates the profile only after explicit user approval. Coco must not use an unapproved proposal as design-system truth.

## Full-squad design test

`fruti test` is the acceptance harness for the design pipeline. It does not replace the agents; it creates `.fruti/tests/<round>/request.md` (and a `current/request.md` pointer to the latest one), which the active coding agent executes through Kiwi → Lima → Coco → Lima gate → Mora.

The test is successful only when it produces a multidimensional verdict (technical, structural, visual, accessibility, design_system, documentation) and every mandatory dimension passes. Build/type/runtime success alone is never design approval.

If `design_system: NEW` and minimum approved foundations are missing, stop before final F3 visual approval: initialize/approve foundations first or report design_system BLOCKED.

The test is successful only when it produces:
- Kiwi neutral F2 + decision/geometry evidence;
- Lima approved or rejected contract with explicit reasons;
- Coco real F3/implementation + compliance report;
- Mora canonical Design Hub page whose Preview renders the verified component;
- `.fruti/tests/<round>/result.md` with PASS/PARTIAL/FAIL for every stage.

When `--file` is supplied, the file is current-state evidence. It is not target visual authority.

A missing configured normative reference (including a project-specific interface guideline) is reported as missing evidence. Never silently reconstruct a missing standard from memory.

## Runtime contracts

- `.fruti/runtime/kiwi.yaml`: route structural work, define minimum inputs and handoff output.
- `.fruti/runtime/lima.yaml`: route governance operations and registry/lifecycle reads.
- `.fruti/runtime/coco.yaml`: route F3/R3/R0 and audit-manifest execution.
- `.fruti/runtime/mora.yaml`: route documentation work from verified deltas.

Read one runtime contract for the active owner. Do not read all four just because a full squad pipeline may eventually run; each stage reads its own contract when control reaches it.

## Squad routing

- Kiwi: structure and UX, brief/flow/wireframes F0-F2. Read only structural references needed for the selected fidelity. Kiwi defines functional geometry and adaptive composition but does not invent visual styling.
- Lima: governance, classification, reuse, registry, contracts, token ownership and lifecycle. Read only the reference for the current governance operation/gate.
- Coco: F3 construction, implementation and canonical UI audit. Consume approved locks/contracts/tokens. For audits, use `.fruti/audit-manifest.yaml` plus automated evidence first; open prose standards only for failed/ambiguous/non-deterministic checks.
- Mora: documentation of implemented/verified truth. Work from registry + approved contracts/tokens + Coco compliance report + targeted code/diff; document the delta. Do not reconstruct the whole design history or infer rules from the implementation.

## Handoff contract

Each stage passes a compact handoff at `.fruti/handoffs/current.json` (or an artifact-specific equivalent) containing only:
- artifact id and round
- source agent and next owner
- decisions frozen in this stage
- pieces and their reuse/extend/new/local disposition when known
- required states and adaptive behavior
- unresolved questions/blockers
- evidence paths produced
- changed fields since the previous handoff

Never copy whole reference documents into a handoff. The receiving agent treats the handoff as an index to canonical artifacts, not as permission to reopen every upstream document.

## Round-scoped outputs

`<round>` in any `.fruti/tests/<round>/...` path is the round named by the request being executed (fallbacks in order: `.fruti/state/current.json` `round` — which `fruti test` sets — then the highest-numbered `.fruti/tests/rNN/` directory; never a literal `<round>` and never `current`). `.fruti/tests/current/` holds only a pointer to the latest request/input and is never an output location.

`.fruti/handoffs/current.json` and `.fruti/reports/compliance-current.json` are latest-pointers and MUST carry a `round` field. During a test round each stage also writes a round copy (`.fruti/tests/<round>/handoff-<stage>.json`, `.fruti/tests/<round>/compliance.json`). A stage must not consume a `current` file whose `round` differs from the active round.

`<stage>` is one of exactly five ids, in pipeline order: `kiwi`, `lima` (contract, after Kiwi), `coco`, `lima-gate` (gate, after Coco), `mora`. Every stage that writes `handoffs/current.json` also updates `.fruti/state/current.json` (`round`, `phase`, `owner`, `next_owner`) and writes its round copy `.fruti/tests/<round>/handoff-<stage>.json`; only Coco writes `compliance.json`.

## Breakpoint semantics

Two different things share the word "breakpoint":
- **Layout modes** — fixed by the adaptive contract: compact `<600`, medium `600–1023`, expanded `>=1024`. Kiwi and Coco design with these.
- **Verification viewports** — the profile's `breakpoints` / `runtime_qa.viewports`: the widths every piece is verified at (default `[1440, 1024, 768, 390]`). They are not layout thresholds.

A viewport set must cover every mode (at least one `<600`, one in `600–1023`, one `>=1024`); `lima init` warns otherwise. The generated Playwright config derives its projects from the profile viewports.

## Persistent state

`.fruti/state/current.json` is an operational cache, not a second source of truth. Canonical ownership remains: project profile for configuration, registry for lifecycle/status, real code/types for implementation/API evidence, approved locks/contracts/tokens for design decisions, and audit evidence for QA.

Update state with pointers + compact decisions. If cached state conflicts with a canonical source, canonical truth wins and state is repaired.

## Audit policy

Coco owns the canonical audit and writes `.fruti/reports/compliance-current.json` (or artifact-specific equivalent). Lima consumes it for gates and Mora as QA evidence; neither reruns Coco's audit merely to understand the result. Deterministic checks run in scripts first; model reasoning is for non-deterministic review (details in `.fruti/runtime/coco.yaml` → `r0_audit`).

## Documentation policy

`.fruti/contracts/documentation.yaml` is the single normative source for Design Hub page anatomy, section order and the neutral documentation shell. `skills/lima/reference/component-documentation.md` and `design-hub.md` contribute only guidance that does not conflict with it (golden rule, lifecycle-gated API, isolated previews); on any conflict the contract wins. Mora's read scope is in `.fruti/runtime/mora.yaml`.

## User experience

The user should be able to say things like `rediseña este formulario`, `ahora haz el de registro`, `audítalo`, `promuévelo`, `cambia la fuente principal`, or `cambia el color de acción` without internal flags. Infer routing from current state and the request. Ask only for product decisions that materially change the experience.


## Path resolution

Runtime contracts cite package-relative paths (`skills/lima/...`, `agentes/kiwi/...`). In an installed project, resolve them through `.fruti/paths.yaml` (written by the installer); when absent (this repo itself), the paths are literal.
