# Contributing to LicenseGuard

First off, thank you for considering contributing to LicenseGuard. This project is built on the belief that license compliance should be **fast, free, and accessible** to every developer.

## The LicenseGuard Philosophy

Before you write a single line of code, please understand the core values that built this tool:

1.  **Zero Bloat Policy** 🚀
    *   We prefer native Node.js APIs (`fs`, `child_process`, `path`) over adding heavy dependencies.
    *   Current dependencies are minimal (chalk, commander, inquirer). Keep it that way.
    *   If you can write it in 20 lines of utility code, don't install a 5MB library.

2.  **Ecosystem Native** 🧠
    *   Don't force one logic on all languages.
    *   **Node.js** uses file parsing (`package.json`) because it's fast.
    *   **Python** uses IPC bridge (`python-license-scanner.py`) because pip is chaotic.
    *   **Go/Rust** uses CLI tools (`go list`, `cargo metadata`) because they are authoritative.
    *   *Rule:* Research the ecosystem's standard first. Don't guess.

3.  **Fail-Safe Architecture** 🛡️
    *   This is a polyglot tool. If the user doesn't have `conan` installed, the C++ scanner should fail silently with a warning. It MUST NOT crash the Node.js scan.
    *   Always wrap plugin execution in `try-catch`.

4.  **"Feel Code"** ✍️
    *   Understand what you are parsing. Don't just regex blindly.
    *   Read the lockfiles. Understand the graph.

## Development Setup

1.  **Clone and Install:**
    ```bash
    git clone https://github.com/rfxlamia/licenseguard.git
    cd licenseguard
    npm install
    ```

2.  **Run Tests:**
    We take testing seriously.
    ```bash
    npm test
    ```
    *Current Benchmark:* 635+ tests passing in ~3 seconds. Do not make it slower.

3.  **Manual Testing:**
    Automated tests are not enough. Verify your changes against real projects.
    See `manual-test/` directory for reference projects (Node, C++, Python).

## Pull Request Guidelines

*   **Branch Naming:** `feat/feature-name` or `fix/bug-name`.
*   **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: add ruby support`, `fix: handle corrupt lockfile`).
*   **Tests:** Every PR **MUST** include unit tests. Code coverage should not drop below 90%.
*   **Documentation:** Update `README.md` if you add a new feature or flag.

## Adding a New Ecosystem Plugin

Want to add support for Ruby, PHP, or Java?
1.  Create `lib/scanner/plugins/language.js`.
2.  Implement the standard interface:
    *   `detect()`: Boolean
    *   `scanDependencies(projectLicense)`: Promise<Result>
3.  Register it in `lib/scanner/index.js`.
4.  Add comprehensive unit tests in `tests/unit/scanner-language.test.js`.

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
