const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')

/**
 * Check if current directory is a git repository
 * @returns {boolean} true if .git directory exists
 */
function isGitRepo() {
  try {
    return fs.existsSync('.git')
  } catch (error) {
    return false
  }
}

/**
 * Initialize a git repository in the current directory
 * @returns {boolean} true if git init succeeded
 */
function initGitRepo() {
  try {
    execSync('git init', { stdio: 'inherit' })
    return true
  } catch (error) {
    console.error(chalk.red('✗ Failed to initialize git repository'))
    return false
  }
}

/**
 * Install git hooks for license notifications
 * @returns {boolean} true if hooks were installed successfully
 */
function installHooks() {
  try {
    const hooksDir = path.join('.git', 'hooks')

    // Ensure hooks directory exists
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true })
    }

    const hooks = [
      { name: 'post-checkout', script: generatePostCheckoutScript() },
      { name: 'pre-commit', script: generatePreCommitScript() },
    ]

    let hasConflicts = false

    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, hook.name)

      if (fs.existsSync(hookPath)) {
        // Existing hook detected - create variant
        const variantPath = path.join(hooksDir, `licenseguard-${hook.name}`)
        fs.writeFileSync(variantPath, hook.script, 'utf8')
        makeExecutable(variantPath)

        console.log(chalk.yellow(`⚠️  Existing ${hook.name} hook detected.`))
        console.log(chalk.blue(`📝 Installed as: licenseguard-${hook.name}`))
        console.log(
          chalk.gray(
            '💡 To use: merge with your existing hook or rename.'
          )
        )
        hasConflicts = true
      } else {
        // No conflict - install directly
        fs.writeFileSync(hookPath, hook.script, 'utf8')
        makeExecutable(hookPath)
      }
    }

    if (!hasConflicts) {
      console.log(chalk.green('✓ Git hooks installed'))
    }

    return true
  } catch (error) {
    console.error(chalk.red('✗ Failed to install git hooks:'), error.message)
    return false
  }
}

/**
 * Make a file executable (Unix only)
 * @param {string} filePath - Path to the file
 */
function makeExecutable(filePath) {
  try {
    // chmod 755 on Unix systems
    fs.chmodSync(filePath, 0o755)
  } catch (error) {
    // Ignore errors on Windows where chmod is not supported
  }
}

/**
 * Generate post-checkout hook script
 * @returns {string} Hook script content
 */
function generatePostCheckoutScript() {
  return `#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

try {
  // Read .licenseguardrc from project root (relative to .git/hooks/)
  const configPath = path.resolve(__dirname, '..', '..', '.licenseguardrc')

  if (!fs.existsSync(configPath)) {
    // No config file, silently exit
    process.exit(0)
  }

  const configContent = fs.readFileSync(configPath, 'utf8')
  const config = JSON.parse(configContent)

  // Display license notification with color
  const blue = '\\x1b[34m'
  const reset = '\\x1b[0m'

  console.log(\`\${blue}📜 This project uses \${config.license.toUpperCase()} License by \${config.owner}\${reset}\`)

  process.exit(0)
} catch (error) {
  // Errors should not block git operations
  process.exit(0)
}
`
}

/**
 * Generate pre-commit hook script
 * @returns {string} Hook script content
 */
function generatePreCommitScript() {
  return `#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

try {
  // Read .licenseguardrc from project root (relative to .git/hooks/)
  const configPath = path.resolve(__dirname, '..', '..', '.licenseguardrc')

  if (!fs.existsSync(configPath)) {
    // No config file, silently exit
    process.exit(0)
  }

  const configContent = fs.readFileSync(configPath, 'utf8')
  const config = JSON.parse(configContent)

  // Display license reminder with color
  const blue = '\\x1b[34m'
  const reset = '\\x1b[0m'

  console.log(\`\${blue}ℹ️  Reminder: This project is licensed under \${config.license.toUpperCase()}\${reset}\`)

  process.exit(0)
} catch (error) {
  // Errors should not block git operations
  process.exit(0)
}
`
}

module.exports = {
  isGitRepo,
  initGitRepo,
  installHooks,
}
