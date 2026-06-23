# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file VSCode extension (`vscode-tmux-auto-reattach`, display name "tmux
Auto Reattach"). On window load it opens one integrated terminal per existing
tmux/zellij session and attaches to it. Terminal names mirror session names, so
re-running never duplicates terminals. Plain JavaScript, no dependencies, no
build step, no tests.

## Commands

- **Package a .vsix**: `vsce package --allow-missing-repository` (needs
  `npm install -g @vscode/vsce`).
- **Run / debug**: there is no test or lint setup. To exercise it, copy the
  folder into the VSCode extensions dir and reload the window:
  - Remote-SSH (the primary target): `cp -r vscode-tmux-auto-reattach ~/.vscode-server/extensions/`
  - Local: `~/.vscode/extensions/`
  - Then Command Palette → "Developer: Reload Window".

## Architecture

Two source files, both small:

- [extension.js](extension.js) — all logic. `listSessions(cmd)` runs the
  configured list command via `child_process.exec` and returns session names
  (any error → empty list → "open nothing"). `openAll()` reads config, lists
  sessions, and creates one terminal per *new* session name, deduping against
  already-open terminals by name. `activate()` registers the
  `tmuxAutoReattach.openAll` command and runs `openAll()` on startup unless
  disabled or terminals already exist.
- [package.json](package.json) — manifest. Defines the command, the four
  `tmuxAutoReattach.*` settings, and `activationEvents: onStartupFinished`.

### Key design points

- **`extensionKind: ["workspace"]`** is load-bearing: it forces the extension to
  run on the *workspace host*, so over Remote-SSH the list/attach commands hit
  the remote machine's tmux, not the local laptop's.
- **Numbered tmux sessions are not special** — an unnamed tmux session is named
  `0`/`1`/… and `#{session_name}` returns that, so `listCommand` and
  `attachCommand` must always use the *same* identifier (both default to
  `session_name`).
- **Dedup-by-name** (`vscode.window.terminals` names vs session names) is the
  whole anti-duplicate mechanism; the `skipIfTerminalsOpen` setting guards the
  startup run against VSCode reviving terminals after a reload.
- **Generality via config**: tmux vs zellij is purely a matter of the
  `listCommand` / `attachCommand` settings — there is no tmux-specific code.

## Naming convention

The package id (`vscode-tmux-auto-reattach`, matches the directory) and the
config/command namespace (`tmuxAutoReattach.*`) must stay in sync if renamed —
they appear in both [package.json](package.json) and [extension.js](extension.js).
The user-visible "nice name" is the `displayName` in the manifest.
