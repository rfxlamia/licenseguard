# LicenseGuard

[![npm version](https://badge.fury.io/js/licenseguard-cli.svg)](https://www.npmjs.com/package/licenseguard-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> License setup & compliance guard for developers

LicenseGuard helps you set up open source licenses and protects your project from license conflicts. It scans your dependencies for incompatible licenses and automatically notifies developers about licensing requirements - works with any language (Node.js, Python, Rust, Go, etc.).

## Key Features

- **Multi-Ecosystem Scanning** - Scans dependencies across 5 ecosystems (Node.js, C++, Rust, Python, Go)
- **Conflict Detection** - Detects incompatible licenses (e.g., GPL vs MIT) and blocks creation
- **SPDX Compatibility** - Industry-standard license compatibility checking
- **Scan Results** - Save scan results to `.licenseguardrc` for transparency
- **Automatic Notifications** - See license info immediately after `git clone`
- **Zero Effort** - Global hooks install once, work forever
- **Language Agnostic** - Works for Python, Rust, Go, Ruby, any project
- **Offline** - All license templates bundled, no internet required

---

## Supported Ecosystems

LicenseGuard scans dependencies across multiple languages and package managers:

- **Node.js** - npm packages (`package.json`)
- **C/C++** - Conan packages (`conanfile.txt`, `conanfile.py`)
- **Rust** - Cargo crates (`Cargo.toml`)
- **Python** - pip/pipenv/poetry packages (`requirements.txt`, `Pipfile`, `pyproject.toml`)
- **Go** - Go modules (`go.mod`)

Each ecosystem uses optimized detection strategies for maximum accuracy.

---

## Quick Start

### For Developers (One-time Setup)

```bash
npm install -g licenseguard-cli
```

That's it! Now every time you clone a repo with `.licenseguardrc`, you'll see:

```bash
git clone https://github.com/some/project
# 📜 This project uses MIT License by ProjectOwner
```

### For Project Owners

```bash
cd your-project
licenseguard init
```

Follow the prompts, then commit:

```bash
git add LICENSE .licenseguardrc
git commit -m "Add license"
git push
```

Anyone who has LicenseGuard installed globally will now see your license info when they clone.

---

## How It Works

### Automatic Global Hooks

When you install LicenseGuard globally, it automatically:

1. Creates git template directory at `~/.git-templates/hooks/`
2. Installs self-contained hooks (only needs Node.js, not LicenseGuard)
3. Configures git: `git config --global init.templateDir ~/.git-templates`

Now **every** `git clone` or `git init` copies these hooks automatically.

The hooks check for `.licenseguardrc` and display license info if found:

```bash
git clone <any-repo>
# If .licenseguardrc exists:
# 📜 This project uses MIT License by OwnerName

git checkout feature-branch
# 📜 This project uses MIT License by OwnerName

git commit -m "changes"
# ℹ️  Reminder: This project is licensed under MIT
```

---

## Installation Options

### Global (Recommended)

```bash
npm install -g licenseguard-cli
```

Enables automatic license notifications for all git operations.

### Using npx (No install)

```bash
npx licenseguard-cli init
```

One-time use without global install (no automatic notifications).

### Local Development Dependency

```bash
npm install --save-dev licenseguard-cli
```

For use in npm scripts (see Advanced Usage).

---

## Commands

### `init` - Interactive Setup

```bash
licenseguard init
```

Guides you through:
1. Selecting license type (MIT, Apache 2.0, GPL 3.0, etc.)
2. Copyright owner name
3. Copyright year (defaults to current)
4. Project URL (optional)
5. Dependency scanning for license conflicts
6. Option to save scan results
7. Git initialization (if needed)
8. Git hooks installation

Example (with clean dependencies):
```
📜 LicenseGuard - Interactive License Setup

? Select license type: MIT License
? Copyright owner name: Your Name
? Copyright year: 2025
? Project URL (optional): https://github.com/you/project

🔍 Scanning dependencies for license conflicts...

✓ Scan complete - 150 dependencies checked
  ✓ 150 compatible
  ✓ 0 incompatible
  ✓ 0 unknown

? Save scan results to .licenseguardrc? Yes

✓ LICENSE file created
✓ Scan results saved to .licenseguardrc
✓ Configuration saved to .licenseguardrc
✓ Git hooks installed

📄 Your project is now licensed under MIT
```

Example (with conflicts):
```
🔍 Scanning dependencies for license conflicts...

✗ Scan complete - 150 dependencies checked
  ✓ 147 compatible
  ❌ 2 incompatible
  ⚠️ 1 unknown

⚠️ CONFLICTS DETECTED:

❌ some-gpl-lib@2.0.0 (GPL-3.0)
   Conflict: Copyleft incompatible with MIT
   Location: node_modules/some-gpl-lib/package.json

✗ LICENSE NOT created due to license conflicts.

Fix conflicts or use --force to proceed anyway:
  licenseguard init --force
```

**With Explanation (`--explain`):**
```bash
licenseguard init --explain
# ...
# ❌ libdwarf@0.9.1 (LGPL-2.1-only)
#    Conflict: Copyleft incompatible with MIT
#    ────────────────────────
#    📚 FSF: MIT license is permissive and GPL-compatible
#    🔗 https://www.gnu.org/licenses/license-list.html#Expat
```

**Flags:**
- `--force` - Create LICENSE despite conflicts (shows warnings)
- `--noscan` - Skip dependency scanning
- `--explain` - Show authoritative source citations (FSF/OSI links) for conflicts

### `init --fast` - Non-Interactive Setup

```bash
licenseguard init --fast --license mit --owner "Your Name"
```

Perfect for CI/CD or scripting. Automatically scans dependencies and auto-saves clean results.

**Flags:**
- `--fast` - Enable non-interactive mode
- `--license <type>` (required) - License type
- `--owner <name>` (optional) - Auto-detects from git config
- `--year <year>` (optional) - Defaults to current year
- `--url <url>` (optional) - Auto-detects from git remote
- `--force` - Create LICENSE despite conflicts
- `--noscan` - Skip dependency scanning

**Auto-save behavior in fast mode:**
- Clean scan (no conflicts) → Automatically saves `scanResult`
- Conflicts detected → Does not save `scanResult`

Examples:
```bash
# Minimal
licenseguard init --fast --license mit

# Skip scanning
licenseguard init --fast --license mit --noscan

# Force creation despite conflicts
licenseguard init --fast --license mit --force

# Full specification
licenseguard init --fast --license apache2_0 --owner "Apache Corp" --year 2025
```

### `ls` - List Available Licenses

```bash
licenseguard ls
```

Output:
```
Available License Templates:

✓ MIT - MIT License (permissive, widely used)
✓ Apache 2.0 - Apache License 2.0 (permissive with patent grant)
✓ GPL 3.0 - GNU General Public License 3.0 (copyleft)
✓ BSD 3-Clause - BSD 3-Clause License (permissive with attribution)
✓ ISC - ISC License (simpler MIT alternative)
✓ WTFPL - Do What The F*ck You Want To Public License (ultra-permissive)
```

### `setup` - Setup Hooks Only

```bash
licenseguard setup
```

Reads existing `.licenseguardrc` and installs hooks. Used in npm prepare scripts.

---

## Color-coded Output

LicenseGuard uses visual safety hierarchy with color-coding to help you quickly identify dangerous licenses:

### Safety Level Legend

| Color | Emoji | License Type | Examples |
|-------|-------|--------------|----------|
| 🟢 **Green** | Safe | Permissive licenses | MIT, Apache-2.0, BSD-*, ISC, 0BSD, Unlicense |
| ⚠️ **Yellow** | Caution | Weak copyleft | MPL-2.0, LGPL-*, EPL-* |
| ❌ **Red** | Dangerous | Strong copyleft | GPL-*, AGPL-* |
| ❔ **Gray** | Unknown | Requires manual review | UNKNOWN, unrecognized licenses |

### How It Works

Licenses are automatically color-coded in all commands (`init`, `scan`) based on their safety level:

- **Green licenses** (🟢) are permissive and safe to use - they allow you to do almost anything
- **Yellow licenses** (⚠️) require caution - they have some copyleft restrictions
- **Red licenses** (❌) are strong copyleft - they may require your project to use the same license
- **Gray licenses** (❔) are unknown or unrecognized - manual review required

**Example Output:**
```bash
licenseguard scan

❌ 2 issue(s) found:

❌ some-gpl-lib@2.0.0 (❌ GPL-3.0)
   Conflict: Copyleft incompatible with MIT
   Location: node_modules/some-gpl-lib/package.json

⚠️  unknown-lib@1.0.0 (❔ UNKNOWN)
   No license field found
   Location: node_modules/unknown-lib/package.json
```

### Accessibility

Colors work in both light and dark terminal themes, and emojis are used as secondary indicators for colorblind users:
- Green = 🟢 (green circle)
- Yellow = ⚠️ (warning triangle)
- Red = ❌ (red X)
- Gray = ❔ (question mark)

---

## Update Notifications

LicenseGuard automatically checks for updates once per day (cached for 24 hours). When a new version is available, you'll see:

```bash
╔═══════════════════════════════════════════════╗
║  Update available: 2.1.0 → 2.1.1              ║
║  Run: npm install -g licenseguard-cli@latest  ║
╚═══════════════════════════════════════════════╝
```

**Update check behavior:**
- Checks npm registry once per 24 hours
- Non-blocking (doesn't slow down CLI startup)
- Fails silently if network unavailable
- Result cached in OS temp directory

---

## Supported Licenses

| Key | Name | Description |
|-----|------|-------------|
| `mit` | MIT | Permissive, widely used |
| `apache2_0` | Apache 2.0 | Permissive with patent grant |
| `gpl3_0` | GPL 3.0 | Copyleft |
| `bsd3clause` | BSD 3-Clause | Permissive with attribution |
| `isc` | ISC | Simpler MIT alternative |
| `wtfpl` | WTFPL | Ultra-permissive |

Not sure which to choose? Visit [choosealicense.com](https://choosealicense.com).

---

## Configuration

LicenseGuard creates `.licenseguardrc` in your project root.

**Basic format:**
```json
{
  "license": "mit",
  "owner": "Your Name",
  "year": "2025",
  "url": "https://github.com/you/project"
}
```

**With scan results (optional):**
```json
{
  "license": "mit",
  "owner": "Your Name",
  "year": "2025",
  "url": "https://github.com/you/project",
  "scanResult": {
    "timestamp": "2025-11-18T10:30:00.000Z",
    "totalDependencies": 150,
    "compatible": 150,
    "incompatible": 0,
    "unknown": 0,
    "issues": []
  }
}
```

**Why save scan results?**
- **Transparency badge** - Shows your project has validated license compliance
- **Trust signal** - Like CI badges or test coverage badges
- **Audit trail** - Documents when dependencies were last checked
- **Open source best practice** - Demonstrates license awareness

This file **must be committed** to your repository so others can see your license info.

---

## Advanced Usage

### For npm Projects (Alternative to Global Install)

If you can't rely on developers having LicenseGuard installed globally, use npm prepare script:

```json
{
  "devDependencies": {
    "licenseguard-cli": "^2.0.0"
  },
  "scripts": {
    "prepare": "licenseguard setup || true"
  }
}
```

When developers run `npm install`, hooks are set up automatically.

### Existing Git Hooks

LicenseGuard **never overwrites** existing hooks. If conflicts exist:

- Creates `licenseguard-post-checkout` and `licenseguard-pre-commit`
- Shows warning with merge instructions

### Non-Git Projects

LicenseGuard works without git:
- `init` offers to run `git init`
- `init --fast` creates LICENSE file only
- Hooks are skipped with warning

---

## FAQ

### What licenses are checked during scanning?

LicenseGuard **auto-detects your project type** and scans the appropriate ecosystem:
- **Node.js**: Reads `package.json` and `node_modules/*/package.json`
- **C/C++**: Reads Conan metadata via `conan graph info`
- **Rust**: Reads `cargo metadata` JSON output
- **Python**: Uses native Python `importlib.metadata` (98.6% detection rate)
- **Go**: Reads `go.mod` and scans `GOMODCACHE` with streaming NDJSON

All ecosystems check:
- SPDX license identifiers (MIT, Apache-2.0, GPL-3.0, BSD-3-Clause, ISC, etc.)
- License compatibility using industry-standard rules
- Copyleft vs permissive conflicts (e.g., GPL incompatible with MIT)
- Multi-strategy detection including Jaccard Index similarity matching

Mixed-language projects are not yet supported. Use `--noscan` flag if detection is incorrect.

### How does SPDX compatibility work?

LicenseGuard uses [spdx-satisfies](https://www.npmjs.com/package/spdx-satisfies) for compatibility checking:
- **Permissive licenses** (MIT, Apache, BSD, ISC) - Compatible with most licenses
- **Copyleft licenses** (GPL-3.0) - Incompatible with permissive project licenses
- **Unknown licenses** - Generates warnings but doesn't block
- **Custom rules** - Fallback for non-SPDX licenses (WTFPL, proprietary)

### What is the scanResult for?

`scanResult` is optional transparency data you can commit to show:
1. Your project has validated license compliance
2. When dependencies were last scanned
3. What conflicts (if any) were detected
4. Trust signal for users and contributors (like CI badges)

You choose whether to save it after each scan. Clean scans default to YES, conflicts default to NO.

### Can I skip dependency scanning?

Yes! Use the `--noscan` flag:
```bash
licenseguard init --noscan
```

This is useful for:
- Non-JavaScript projects
- Projects without dependencies
- When you want manual license management

### Does this work for non-JavaScript projects?

**Yes!** LicenseGuard natively supports 5 ecosystems:
- **Node.js** - Full dependency scanning
- **C/C++** - Conan package scanning (requires Conan 2.x or 1.x installed)
- **Rust** - Cargo crate scanning (requires Cargo installed)
- **Python** - Native package scanning with 98.6% accuracy (requires Python 3.7+)
- **Go** - Go module scanning (requires Go installed)

For other languages (Ruby, PHP, etc.), the LICENSE file and git hooks still work, but dependency scanning is not yet available. Use `--noscan` flag for those projects.

The hooks only need Node.js installed (which most developers have).

### Do my contributors need to install LicenseGuard?

For automatic notifications: **Yes**, they need `npm install -g licenseguard-cli` once.

Alternative: Use npm prepare script (see Advanced Usage) - then only project owner installs.

### Does this work offline?

Yes! All license templates are bundled. No internet required.

### Can I disable notifications?

Delete hooks from `.git/hooks/`:
```bash
rm .git/hooks/post-checkout .git/hooks/pre-commit
```

Or remove global hooks:
```bash
rm -rf ~/.git-templates/hooks/
git config --global --unset init.templateDir
```

### What Node.js versions work?

Node.js 18.x or 20.x (LTS versions).

### Does it work on Windows?

Yes! Fully cross-platform (Linux, macOS, Windows).

---

## Why LicenseGuard?

- **Not enforcing** - Unlike license scanners, we inform and educate
- **Zero friction** - One global install, automatic forever
- **Universal** - Works with any language/framework
- **Educational** - Raises awareness without blocking workflows
- **Open source** - MIT licensed, free forever

---

## Contributing

Contributions welcome!

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Commit changes: `git commit -m 'Add feature'`
4. Push: `git push origin feature/amazing`
5. Open Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Links

- [npm Package](https://www.npmjs.com/package/licenseguard-cli)
- [Choose a License](https://choosealicense.com)
- [Open Source Initiative](https://opensource.org/licenses)
