# Working in dff-sim

A Chinese-language teaching app for a rising-edge D flip-flop. Its scope is ideal binary logic, guided experiments, and a logic analyzer drawn by one OffscreenCanvas / Canvas2D worker.

## Commands

Use Node.js 24+ and pnpm. Run commands from the repository root.

- `pnpm install --frozen-lockfile` installs the locked dependencies.
- `pnpm dev` starts the development server.
- `pnpm fmt` formats source and documentation.
- `pnpm check` runs TypeScript, Oxlint, Stylelint, and format checks.
- `pnpm build` runs all checks, then builds to `dist/`.
- `pnpm preview` serves the built app locally.

## Code map

| Location                     | Responsibility                                         |
| ---------------------------- | ------------------------------------------------------ |
| `src/model.ts`               | Pure signal transitions and explanations               |
| `src/state.ts`               | Pure application updates, history, and lesson progress |
| `src/lesson.ts`              | Guided questions and their signal actions              |
| `src/view.ts`                | DOM bindings and rendering                             |
| `src/main.ts`                | State ownership, clock, and effect coordination        |
| `src/scope.ts`, `src/scope/` | Canvas transfer, worker protocol, and Canvas2D drawing |
| `index.html`, `src/styles/`  | Semantic markup and layered, scoped styles             |

## Invariants

- RST is active-high and asynchronous: it forces Q to 0. With RST low, Q samples D on rising edges and holds between them, including after reset release.
- Signals start at zero as a teaching convention. The horizontal axis counts sequential operations.
- Retain at most 64 records including the current frame. History selection affects the inspected frame; controls show live signals. Setting an input to its existing value preserves state identity.
- Pause automatic clocking when inspecting history or hiding the page. Resuming requires user action.
- Transfer the canvas once and draw on data, size, or context changes. Keep text feedback usable if drawing fails.

## Change conventions

- Keep model and state updates pure. Use readonly data, discriminated unions, small functions, and explicit branches. Keep effects at DOM, timer, and canvas boundaries.
- Use semantic HTML and native controls. Verify Newly Baseline support in official documentation before adopting features. Preserve keyboard access, narrow layouts, color schemes, and reduced-motion behavior.
- Keep visible text in Chinese. Write concise comments explaining design reasons and non-obvious constraints. Describe supported behavior and actionable conventions directly.
- Prefer tool defaults, retain strict checks, and keep DOM and Worker type environments separate. Update `pnpm-lock.yaml` with pnpm when dependencies change.
- Maintain documentation in the root Markdown files, with README focused on learning and running the app.

## Verification

Validation uses static analysis, code review, and manual browser checks. Review changed logic and its callers, then run `pnpm build` for code changes. For documentation-only changes, run `pnpm fmt:check` and verify commands, links, and claims against the repository.

For behavior changes, manually verify the six-step lesson, sampling and holding, reset release while CLK is high, clock speed and pause behavior, and the 64-record history boundary. For UI or renderer changes, also check resizing, keyboard operation, light/dark appearance, and browser errors. Report what was checked and any remaining gaps.
