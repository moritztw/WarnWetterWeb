import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skriptPfad = path.resolve(__dirname, '../scripts/proxmox-lxc.sh');

test('Proxmox-LXC-Skript: Bash-Syntax & Sicherheitsmerkmale', async (t) => {
  await t.test('besteht die strikte Bash-Syntaxprüfung inkl. eingebetteter Heredoc-Skripte', () => {
    assert.equal(fs.existsSync(skriptPfad), true, 'scripts/proxmox-lxc.sh muss existieren');
    execFileSync('bash', ['-n', skriptPfad], { stdio: 'pipe' });

    const inhalt = fs.readFileSync(skriptPfad, 'utf8');
    const gastMatch = inhalt.match(/<<'EOF_GUEST'[^\n]*\n([\s\S]*?)\nEOF_GUEST/);
    assert.ok(gastMatch, 'EOF_GUEST-Block muss vorhanden sein');
    execFileSync('bash', ['-n'], { input: gastMatch[1], stdio: 'pipe' });

    const updateMatch = inhalt.match(/<<'EOF_UPDATE'[^\n]*\n([\s\S]*?)\nEOF_UPDATE/);
    assert.ok(updateMatch, 'EOF_UPDATE-Block muss vorhanden sein');
    execFileSync('bash', ['-n'], { input: updateMatch[1], stdio: 'pipe' });
  });

  await t.test('nutzt unprivilegierten Modus, striktes Error-Handling, Non-Root-User und kein Docker', () => {
    const inhalt = fs.readFileSync(skriptPfad, 'utf8');

    assert.match(inhalt, /set -Eeuo pipefail/, 'muss strikten Bash-Modus aktivieren');
    assert.match(inhalt, /--unprivileged 1/, 'muss unprivilegierten LXC erstellen');
    assert.match(inhalt, /CT_HOSTNAME=/, 'darf nicht mit der eingebauten Bash-Variable HOSTNAME kollidieren');
    assert.match(inhalt, /User=warnwetter/, 'muss dedizierten System-User in systemd nutzen');
    assert.match(inhalt, /ProtectSystem=strict/, 'muss Dateisystem-Schutz in systemd aktivieren');
    assert.match(inhalt, /warnwetter-update/, 'muss Update-Hilfsskript bereitstellen');
    assert.doesNotMatch(inhalt, /docker\.io|docker-ce|docker compose/i, 'darf kein Docker im LXC installieren');
  });
});
