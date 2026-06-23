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

async function openAll() {
  const cfg = vscode.workspace.getConfiguration('tmuxAutoReattach');
  const listCommand = cfg.get('listCommand');
  const attachCommand = cfg.get('attachCommand');

  const sessions = await listSessions(listCommand);
  if (sessions.length === 0) {
    return;
  }

  // Track which session names already have a terminal so re-running the
  // command doesn't create duplicates.
  const existing = new Set(vscode.window.terminals.map((t) => t.name));

  let last;
  for (const name of sessions) {
    if (existing.has(name)) {
      continue;
    }
    const term = vscode.window.createTerminal({ name });
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
