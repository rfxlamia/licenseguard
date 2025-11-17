# LicenseGuard

[![npm version](https://badge.fury.io/js/licenseguard-cli.svg)](https://badge.fury.io/js/licenseguard-cli)
[![Build Status](https://github.com/rfxlamia/licenseguard/workflows/Test/badge.svg)](https://github.com/rfxlamia/licenseguard/actions)
[![Coverage Status](https://codecov.io/gh/rfxlamia/licenseguard/branch/main/graph/badge.svg)](https://codecov.io/gh/rfxlamia/licenseguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**License setup & compliance helper for developers**

LicenseGuard is a CLI tool that helps you quickly set up open source licenses for your projects with automatic git hooks that notify your team about licensing requirements.

## Quick Start

```bash
# Step 1: Run the interactive setup
npx licenseguard-cli --init

# Step 2: Answer the prompts (license type, owner name, year)

# Step 3: Done! Your LICENSE file and git hooks are ready
```

That's it! Your project now has:
- A properly formatted LICENSE file
- A `.licenseguardrc` configuration file
- Git hooks that display license reminders (optional)

## Installation

### Using npx (Recommended)
```bash
npx licenseguard-cli --init
```

### Global Installation
```bash
npm install -g licenseguard-cli
licenseguard --init
```

### Local Installation
```bash
npm install --save-dev licenseguard-cli
npx licenseguard-cli --init
```

## Usage

### Interactive Setup (`--init`)

```bash
licenseguard --init
```

This command guides you through:
1. Selecting a license type
2. Entering your copyright owner name
3. Setting the copyright year (defaults to current year)
4. Adding a project URL (optional)
5. Optionally initializing git if not already a repo
6. Installing git hooks for license notifications

**Example Output:**
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

### Fast Setup (`--init-fast`)

```bash
licenseguard --init-fast --license mit --owner "Your Name"
```

Non-interactive setup with flags. Perfect for CI/CD or scripting.

**Available Flags:**
- `--license <type>` (required) - License type to use
- `--owner <name>` (optional) - Copyright owner (auto-detects from git config)
- `--year <year>` (optional) - Copyright year (defaults to current year)
- `--url <url>` (optional) - Project URL (auto-detects from git remote)

**Examples:**
```bash
# Minimal (auto-detects owner from git config)
licenseguard --init-fast --license mit

# Full specification
licenseguard --init-fast --license apache2_0 --owner "Apache Corp" --year 2025 --url "https://apache.org"

# GPL license
licenseguard --init-fast --license gpl3_0 --owner "Free Software Foundation"
```

### List Available Licenses (`--ls`)

```bash
licenseguard --ls
```

Displays all available license types:
```
Available License Templates:

✓ MIT - MIT License (permissive, widely used)
✓ Apache 2.0 - Apache License 2.0 (permissive with patent grant)
✓ GPL 3.0 - GNU General Public License 3.0 (copyleft)
✓ BSD 3-Clause - BSD 3-Clause License (permissive with attribution)
✓ ISC - ISC License (simpler MIT alternative)
✓ WTFPL - Do What The F*ck You Want To Public License (ultra-permissive)
```

## Available Licenses

| License Key | Display Name | Description |
|-------------|--------------|-------------|
| `mit` | MIT | MIT License (permissive, widely used) |
| `apache2_0` | Apache 2.0 | Apache License 2.0 (permissive with patent grant) |
| `gpl3_0` | GPL 3.0 | GNU General Public License 3.0 (copyleft) |
| `bsd3clause` | BSD 3-Clause | BSD 3-Clause License (permissive with attribution) |
| `isc` | ISC | ISC License (simpler MIT alternative) |
| `wtdpl` | WTFPL | Do What The F*ck You Want To Public License (ultra-permissive) |

Not sure which license to choose? Visit [choosealicense.com](https://choosealicense.com) for guidance.

## Configuration

LicenseGuard creates a `.licenseguardrc` file in your project root:

```json
{
  "license": "mit",
  "owner": "Your Name",
  "year": "2025",
  "url": "https://github.com/you/project"
}
```

This configuration is used by the git hooks to display license information.

## Git Hooks

LicenseGuard installs two informational git hooks:

### Post-Checkout Hook
Displays a notification after `git clone` or `git checkout`:
```
📜 This project uses MIT License by Your Name
```

### Pre-Commit Hook
Displays a reminder before each commit:
```
ℹ️ Reminder: This project is licensed under MIT
```

**Important:**
- Hooks are **educational only** - they never block git operations
- Hooks always exit with code 0 (success)
- If `.licenseguardrc` is missing, hooks silently exit

### Existing Hooks

If you already have git hooks, LicenseGuard will NOT overwrite them. Instead, it creates variants:
- `.git/hooks/licenseguard-pre-commit`
- `.git/hooks/licenseguard-post-checkout`

You can manually merge these with your existing hooks if desired.

### Without Git

If your project is not a git repository:
- Interactive mode (`--init`) will offer to run `git init`
- Fast mode (`--init-fast`) will skip hooks and warn you
- LICENSE file is always created regardless of git status

## FAQ

### Does this work offline?
Yes! LicenseGuard is completely offline. All license templates are bundled with the package.

### Can I use custom licenses?
Currently, LicenseGuard supports the 6 most common open source licenses. Custom license support may be added in future versions.

### Does it work on Windows?
Yes! LicenseGuard is fully cross-platform and works on Linux, macOS, and Windows.

### What if I already have a LICENSE file?
Interactive mode will ask if you want to overwrite it. Fast mode will overwrite without asking.

### How do I update my license?
Run `licenseguard --init` again and it will regenerate your LICENSE file.

### Can I disable the git hooks?
The hooks are informational only and don't block anything. If you don't want them, simply delete the hook files from `.git/hooks/`.

### What Node.js versions are supported?
LicenseGuard requires Node.js 18.x or 20.x (LTS versions).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development

```bash
# Clone the repository
git clone https://github.com/rfxlamia/licenseguard.git
cd licenseguard

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Test locally
npm link
cd /tmp && mkdir test-project && cd test-project
licenseguard --init
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Links:**
- [Choose a License](https://choosealicense.com) - Help choosing the right license
- [Open Source Initiative](https://opensource.org/licenses) - OSI-approved licenses
- [GitHub Repository](https://github.com/rfxlamia/licenseguard) - Source code
- [npm Package](https://www.npmjs.com/package/licenseguard-cli) - npm registry
