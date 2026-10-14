# Impeccable for MAX

Impeccable is installed for Codex in this repository under `.agents/skills/impeccable`.
Run design commands with this repository as the working directory so its skill,
context, and `.codex/hooks.json` are discovered together.

Product context is recorded in `PRODUCT.md`. The confirmed workflow preference
is visual mockups before coding for landing and showcase pages (`buildPath: comp`
in `.impeccable/config.json`). App screens and documents are built directly in code.

## Using it

The skill should be available on the next turn. If it is missing, reload Codex.
Select `$impeccable` in the chat and describe the command and target, for example:

- `$impeccable critique the student task screen`
- `$impeccable audit the student and staff screens`
- `$impeccable polish the student task screen`

Critique and audit produce findings. Ask for implementation when you want changes.

The design-check hook is installed in `.codex/hooks.json`. Open `/hooks` and approve
the project hook if Codex prompts; installation alone does not grant hook trust.
If automatic hooks are unavailable, the skill calls for one manual detector pass
after UI changes.

## Local visual iteration

Live-mode configuration targets the Next.js App Router shell in `app/layout.tsx`.
No Content Security Policy was detected at setup. Live mode needs the app running
locally with its dependencies and required environment configuration; a live
browser session has not been started or verified by installation.

## Maintenance

From this repository, update with:

```powershell
npx impeccable update --providers=codex --scope=project
```

Reload Codex and approve any changed hook definition if prompted.
Shared configuration and skill sources can be committed. Downloaded engines,
screenshots, and local session data are ignored. No app runtime dependency is added.

Source: https://github.com/pbakaus/impeccable
