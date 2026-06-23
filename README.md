# tmux Auto Reattach

When a VSCode window finishes loading, this opens one integrated terminal per
existing tmux session and attaches to it. Because the terminal names match the
session names, re-running it never creates duplicates.

It runs `tmux ls` on whatever host the workspace lives on. Over Remote-SSH that
is the remote box (the manifest sets `"extensionKind": ["workspace"]`), so it
sees your remote tmux sessions, not your laptop's.

## Install (recommended — from the Marketplace)

Search **"tmux Auto Reattach"** in the Extensions view, or install directly:

- Marketplace page: https://marketplace.visualstudio.com/items?itemName=ideonate.vscode-tmux-auto-reattach
- Command Palette -> "Extensions: Install Extensions", then search the name, or
- from a terminal: `code --install-extension ideonate.vscode-tmux-auto-reattach`

Over Remote-SSH, install it **while connected to the remote** (the Extensions
view's "Install in SSH: host" button, or run the `code` command on the remote)
so it lands on the remote host where your tmux sessions live.

## Install (from source — drop the folder in, no packaging)

Over Remote-SSH the extension must live on the remote host. Copy this folder
into the remote VSCode-server extensions directory and reload:

    # on the remote machine
    cp -r vscode-tmux-auto-reattach ~/.vscode-server/extensions/

Then in VSCode: Command Palette -> "Developer: Reload Window".

(For a non-remote / local install, the directory is `~/.vscode/extensions/`.)

## Install (from source — build a .vsix)

    npm install -g @vscode/vsce
    cd vscode-tmux-auto-reattach
    vsce package

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
- `tmuxAutoReattach.liveTitles` (default false) — see below.
- `tmuxAutoReattach.titleCommand` — the tmux command `liveTitles` runs to turn
  titles on (see below).

## Live tab titles (show the running program)

By default each tab gets a fixed label — the session name — and never changes.
A normal VSCode terminal instead shows what's running (`bash`, `python`, …)
because shell integration follows the foreground process. We can't get that for
free here: we attach to tmux, so from VSCode's point of view the process is
always `tmux`, and your program runs under the tmux *server*, in a different
process tree VSCode can't see.

The one thing that *can* see inside the session is tmux itself. Turn on
`tmuxAutoReattach.liveTitles` and the extension opens terminals without a pinned
name, then runs `titleCommand` to make tmux push the tab title:

    tmux set -g set-titles on \; set -g set-titles-string '#{session_name}: #{pane_current_command}'

You'll get live labels like `mywork: python` that update as the pane's command
changes. Notes:

- This is **tmux-only**; leave it off for zellij.
- `set-titles` is a *global* tmux option, so it affects every session on the
  server, not just the ones VSCode opened. If you already set it in
  `~/.tmux.conf`, clear `titleCommand` so the extension doesn't re-set it.
- With no pinned tab name, before tmux emits a title (or if `titleCommand` is
  empty and you haven't configured `set-titles`) the tab just shows the default
  shell name.

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
- With `mouse on`, mouse selection goes to tmux instead of VSCode. Click-drag
  and double-click-to-select-a-word both get intercepted — a double-click
  highlights the word, then tmux copies it, leaves copy-mode, and snaps back to
  the bottom, so the selection appears to flash and vanish. To get VSCode's
  native selection (and its clipboard) instead:
  - **On macOS, hold Option (⌥)** while clicking/dragging/double-clicking, and
    make sure `terminal.integrated.macOptionClickForcesSelection` is enabled
    (it's the default, but worth checking — if it's off, Option does nothing).
    Shift often works too, but for double-click word-select VSCode tends to read
    Shift+click as "extend selection," so Option is more reliable.
  - **Elsewhere, hold Shift** while selecting or scrolling.

If you switch between selecting and wheel-scrolling a lot, bind a toggle so you
can flip mouse mode off (native VSCode mouse) and on (tmux wheel scroll) on
demand:

    bind m set -g mouse \; display "mouse #{?mouse,on,off}"

Then `prefix` + `m` (prefix is `Ctrl-b` by default, so **Ctrl-b** then **m**)
flips it. Unlike the settings above this binding works in existing sessions —
but you must load it first: it won't take effect until you reload the config
with `tmux source-file ~/.tmux.conf`. Check it registered with
`tmux list-keys -T prefix m`, and confirm the toggle with
`tmux show-options -g mouse` before and after pressing it (the on-screen
`mouse on`/`mouse off` flash is easy to miss if your status line is hidden).

## Cursor keys & backspace in tmux

Inside tmux the `TERM` value comes from tmux's `default-terminal` setting, not
from the VSCode terminal you launched it in. If that points at a terminfo entry
the host doesn't actually have — or the old `screen` default — the shell's line
editor can't map the keys: the up/down arrows stop recalling history and
backspace prints `^H` instead of erasing.

Fix it in `~/.tmux.conf` (on the **remote** host if you use Remote-SSH):

    set -g default-terminal "tmux-256color"

Three gotchas:

- The entry must exist on that host. Check with `infocmp tmux-256color` — it
  should print a definition. If it errors, use `set -g default-terminal
  "screen-256color"` (always present) or update ncurses on the remote.
- Like `history-limit`, this only takes effect for sessions started *after* it's
  set. Start a new session (or `tmux kill-server`) — the sessions this extension
  reattaches to keep whatever `TERM` they were born with.
- For *modified* arrows (Ctrl/Shift+Up, etc.) on tmux older than 3.2, also add
  `set -g xterm-keys on`; newer tmux does this automatically.

## Switching to zellij

Set the two commands above to the zellij variants. The `-ns` flags on
`list-sessions` ask for names only without formatting; if your zellij version
prints extra decoration, adjust the list command so it emits clean names.
