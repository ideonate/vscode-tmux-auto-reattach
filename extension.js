const vscode = require('vscode');
const { exec } = require('child_process');

/**
 * Run the configured list command and return session names.
 * On any error (e.g. "no server running on ...") we return an empty list,
 * which simply means "open nothing".
 */
function listSessions(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }
      const names = stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      resolve(names);
    });
  });
}

// Sessions we've opened a terminal for, by name. Only needed in liveTitles
// mode: there the tab name no longer mirrors the session, so we can't dedup by
// reading terminal names — we remember what we opened instead. Pruned by the
// onDidCloseTerminal listener in activate().
const openSessions = new Map();

async function openAll() {
  const cfg = vscode.workspace.getConfiguration('tmuxAutoReattach');
  const listCommand = cfg.get('listCommand');
  const attachCommand = cfg.get('attachCommand');
  const liveTitles = cfg.get('liveTitles');
  const titleCommand = cfg.get('titleCommand');

  const sessions = await listSessions(listCommand);
  if (sessions.length === 0) {
    return;
  }

  // Track which sessions already have a terminal so re-running the command
  // doesn't create duplicates. Static-name terminals can be matched by tab name
  // (which survives a window reload); live-title terminals can't, so we also
  // consult the sessions we opened ourselves this session.
  const existing = new Set(vscode.window.terminals.map((t) => t.name));
  for (const name of openSessions.keys()) {
    existing.add(name);
  }

  let last;
  for (const name of sessions) {
    if (existing.has(name)) {
      continue;
    }
    // With an explicit name VSCode pins the tab label and ignores title escape
    // sequences. For live titles we omit the name so tmux's set-titles can win.
    const term = liveTitles
      ? vscode.window.createTerminal()
      : vscode.window.createTerminal({ name });
    if (liveTitles) {
      openSessions.set(name, term);
      // Run before attaching, while still at the outer shell, so we configure
      // the tmux server rather than typing into whatever the pane is running.
      if (titleCommand) {
        term.sendText(titleCommand, true);
      }
    }
    term.sendText(attachCommand.replace(/\{session\}/g, name), true);
    last = term;
  }
  if (last) {
    last.show();
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('tmuxAutoReattach.openAll', openAll)
  );

  // Keep the live-titles dedup map honest when a tab is closed by hand.
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((closed) => {
      for (const [name, term] of openSessions) {
        if (term === closed) {
          openSessions.delete(name);
        }
      }
    })
  );

  const cfg = vscode.workspace.getConfiguration('tmuxAutoReattach');
  if (!cfg.get('runOnStartup')) {
    return;
  }
  if (cfg.get('skipIfTerminalsOpen') && vscode.window.terminals.length > 0) {
    return;
  }
  openAll();
}

function deactivate() {}

module.exports = { activate, deactivate };
