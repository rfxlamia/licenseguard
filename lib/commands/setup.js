const fs = require('fs')
const chalk = require('chalk')
const { isGitRepo, installHooks } = require('../utils/git-helpers')

/**
 * Setup command - Install git hooks and show license notification
 * Used in npm prepare script for auto-setup on clone
 *
 * This command is designed for use in package.json prepare scripts:
 * {
 *   "scripts": {
 *     "prepare": "licenseguard --setup || true"
 *   }
 * }
 *
 * @returns {Promise<void>}
 */
async function setupCommand() {
  try {
    // Check for .licenseguardrc
    if (!fs.existsSync('.licenseguardrc')) {
      console.log(
        chalk.yellow(
          'No .licenseguardrc found. Run \'licenseguard --init\' first.'
        )
      )
      return // Exit 0 implicitly
    }

    // Read config
    const configContent = fs.readFileSync('.licenseguardrc', 'utf-8')
    const config = JSON.parse(configContent)

    // Display license notification (MAIN PURPOSE)
    // This is what developers see when they run npm install
    console.log(
      chalk.blue(
        `📜 This project uses ${config.license.toUpperCase()} License by ${config.owner}`
      )
    )

    // Install hooks if git repo
    if (isGitRepo()) {
      installHooks()
      // Note: installHooks() already prints success/warning messages
    } else {
      console.log(chalk.yellow('⚠️ Skipping git hooks (not a git repo)'))
    }
  } catch (error) {
    // Always exit 0 - never break npm install
    // This is CRITICAL for npm prepare script compatibility
    console.log(chalk.yellow(`⚠️ Setup warning: ${error.message}`))
  }
}

module.exports = { setupCommand }
