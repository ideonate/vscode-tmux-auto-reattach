# tmux Auto Reattach

When a VSCode window finishes loading, this opens one integrated terminal per
existing tmux session and attaches to it. Because the terminal names match the
session names, re-running it never creates duplicates.

It runs `tmux ls` on whatever host the workspace lives on. Over Remote-SSH that
is the remote box (the manifest sets `"extensionKind": ["workspace"]`), so it
sees your remote tmux sessions, not your laptop's.

## Install (simplest — drop the folder in, no packaging)

Over Remote-SSH the extension must live on the remote host. Copy this folder
into the remote VSCode-server extensions directory and reload:

    # on the remote machine
    cp -r vscode-tmux-auto-reattach ~/.vscode-server/extensions/

Then in VSCode: Command Palette -> "Developer: Reload Window".

(For a non-remote / local install, the directory is `~/.vscode/extensions/`.)

## Install (cleaner — build a .vsix)

    npm install -g @vscode/vsce
    cd vscode-tmux-auto-reattach
    vsce package --allow-missing-repository

Then, **while connected to the remote**, Command Palette ->
"Extensions: Install from VSIX..." and pick the generated file. Installing from
VSIX while connected installs it on the remote.

## Use

It runs automatically on window open. To trigger manually:
Command Palette -> "tmux Auto Reattach: Open One Terminal Per Session".

## Settings

- `tmuxAutoReattach.runOnStartup` (default true) — open terminals on load.
- `tmuxAutoReattach.skipIfTerminalsOpen` (default true) — skip startup run if
  any terminal already exists, so a window reload that revives terminals doesn't
  double up.
- `tmuxAutoReattach.listCommand` — command that prints one session name per
  line. Default: `tmux list-sessions -F "#{session_name}"`.
  For zellij: `zellij list-sessions -ns`
- `tmuxAutoReattach.attachCommand` — command run in each terminal;
  `{session}` is replaced with the name. Default: `tmux attach -t {session}`.
  Add `-d` (`tmux attach -d -t {session}`) to detach other clients first.
  For zellij: `zellij attach {session}`

## Making new terminals (the `+` button) open tmux too

This extension reattaches to *existing* sessions on window open. To also make
manually-opened terminals start inside tmux, use a VSCode terminal profile —
this is a built-in VSCode feature, separate from the extension. Add to your
settings (use the `linux` key for a Remote-SSH host, `osx` for local macOS):

    "terminal.integrated.profiles.linux": {
      "tmux": { "path": "tmux", "args": ["new-session"] }
    },
    "terminal.integrated.defaultProfile.linux": "tmux"

`new-session` with no `-s` creates a fresh, auto-numbered session (`0`, `1`, …)
for each `+`, which the extension will then reattach to on the next window load.
Don't pin a session name here (e.g. `-A -s main`) — every `+` would attach to
the *same* session and they'd all mirror each other. A named attach-or-create
profile only makes sense for a specific, intentional terminal you want to detach
from and rejoin.

Over Remote-SSH, set this in the Remote settings (the shell runs there) and make
sure `tmux` is on `PATH` — use an absolute path like `/usr/bin/tmux` if not.

## Scrollback & mouse scrolling in tmux

tmux runs on the terminal's *alternate screen*, so VSCode's own scrollbar and
its `terminal.integrated.scrollback` setting never see content that scrolls past
inside tmux — all scrolling goes through tmux itself. By default tmux ignores the
mouse wheel and keeps only 2000 lines of history, which is why scrolling seems
broken and history looks cut short.

Fix it in `~/.tmux.conf` (on the **remote** host if you use Remote-SSH):

    set -g mouse on
    set -g history-limit 50000

Two gotchas:

- `history-limit` only applies to panes created *after* it's set. Reload with
  `tmux source-file ~/.tmux.conf`, but you must start a new session (or
  `tmux kill-server`) for the larger history to take effect — sessions this
  extension reattaches to keep whatever limit they had when first created.
- With `mouse on`, click-drag selection goes to tmux instead of VSCode. Hold
  **Shift** while selecting or scrolling to use VSCode's native behaviour.

## Switching to zellij

Set the two commands above to the zellij variants. The `-ns` flags on
`list-sessions` ask for names only without formatting; if your zellij version
prints extra decoration, adjust the list command so it emits clean names.
