# LicenseGuard

[![npm version](https://badge.fury.io/js/licenseguard-cli.svg)](https://www.npmjs.com/package/licenseguard-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> License setup & compliance helper for developers

LicenseGuard helps you set up open source licenses and automatically notifies developers about licensing requirements when they clone any repository - **works with any language** (Node.js, Python, Rust, Go, etc.).

## Key Features

- **Automatic notifications** - See license info immediately after `git clone`
- **Zero effort** - Global hooks install once, work forever
- **Language agnostic** - Works for Python, Rust, Go, Ruby, any project
- **Non-blocking** - Informational only, never blocks git operations
- **Offline** - All license templates bundled, no internet required

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
licenseguard --init
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
npx licenseguard-cli --init
```

One-time use without global install (no automatic notifications).

### Local Development Dependency

```bash
npm install --save-dev licenseguard-cli
```

For use in npm scripts (see Advanced Usage).

---

## Commands

### `--init` - Interactive Setup

```bash
licenseguard --init
```

Guides you through:
1. Selecting license type (MIT, Apache 2.0, GPL 3.0, etc.)
2. Copyright owner name
3. Copyright year (defaults to current)
4. Project URL (optional)
5. Git initialization (if needed)
6. Git hooks installation

Example:
```
📜 LicenseGuard - Interactive License Setup

? Select license type: MIT License
? Copyright owner name: Your Name
? Copyright year: 2025
? Project URL (optional): https://github.com/you/project

✓ LICENSE file created
✓ Configuration saved to .licenseguardrc
✓ Git hooks installed

📄 Your project is now licensed under MIT
```

### `--init-fast` - Non-Interactive Setup

```bash
licenseguard --init-fast --license mit --owner "Your Name"
```

Perfect for CI/CD or scripting. Flags:

- `--license <type>` (required) - License type
- `--owner <name>` (optional) - Auto-detects from git config
- `--year <year>` (optional) - Defaults to current year
- `--url <url>` (optional) - Auto-detects from git remote

Examples:
```bash
# Minimal
licenseguard --init-fast --license mit

# Full specification
licenseguard --init-fast --license apache2_0 --owner "Apache Corp" --year 2025

# GPL license
licenseguard --init-fast --license gpl3_0 --owner "Free Software Foundation"
```

### `--ls` - List Available Licenses

```bash
licenseguard --ls
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

### `--setup` - Setup Hooks Only

```bash
licenseguard --setup
```

Reads existing `.licenseguardrc` and installs hooks. Used in npm prepare scripts.

---

## Supported Licenses

| Key | Name | Description |
|-----|------|-------------|
| `mit` | MIT | Permissive, widely used |
| `apache2_0` | Apache 2.0 | Permissive with patent grant |
| `gpl3_0` | GPL 3.0 | Copyleft |
| `bsd3clause` | BSD 3-Clause | Permissive with attribution |
| `isc` | ISC | Simpler MIT alternative |
| `wtdpl` | WTFPL | Ultra-permissive |

Not sure which to choose? Visit [choosealicense.com](https://choosealicense.com).

---

## Configuration

LicenseGuard creates `.licenseguardrc` in your project root:

```json
{
  "license": "mit",
  "owner": "Your Name",
  "year": "2025",
  "url": "https://github.com/you/project"
}
```

This file **must be committed** to your repository so others can see your license info.

---

## Advanced Usage

### For npm Projects (Alternative to Global Install)

If you can't rely on developers having LicenseGuard installed globally, use npm prepare script:

```json
{
  "devDependencies": {
    "licenseguard-cli": "^1.2.0"
  },
  "scripts": {
    "prepare": "licenseguard --setup || true"
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
- `--init` offers to run `git init`
- `--init-fast` creates LICENSE file only
- Hooks are skipped with warning

---

## FAQ

### Does this work for non-JavaScript projects?

**Yes!** LicenseGuard works for any project:
- Python projects
- Rust/Cargo projects
- Go modules
- Ruby gems
- Any language

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
