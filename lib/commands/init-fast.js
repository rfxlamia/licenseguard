const { execSync } = require('child_process')
const os = require('os')
const fs = require('fs')
const chalk = require('chalk')
const { generateLicense, LICENSE_TEMPLATES } = require('../templates')
const { writeConfig } = require('../utils/file-ops')
const { isGitRepo, installHooks } = require('../utils/git-helpers')

function getGitConfig(key) {
  try {
    const value = execSync(`git config ${key}`, { encoding: 'utf8' })
    return value.trim()
  } catch (error) {
    return null
  }
}

async function runInitFast(options) {
  try {
    const flags = {
      license: options.license,
      owner: options.owner,
      year: options.year,
      url: options.url,
    }

    // Validate required flag: license
    if (!flags.license) {
      console.error(chalk.red('✗ Error: --license flag is required'))
      console.log(
        chalk.blue('Usage: licenseguard --init-fast --license TYPE [options]')
      )
      console.log(
        chalk.blue(
          `Available licenses: ${Object.keys(LICENSE_TEMPLATES).join(', ')}`
        )
      )
      process.exit(1)
    }

    // Validate license type
    const validLicenses = Object.keys(LICENSE_TEMPLATES)
    if (!validLicenses.includes(flags.license)) {
      console.error(
        chalk.red(`✗ Error: Invalid license type: ${flags.license}`)
      )
      console.log(
        chalk.blue(`ℹ️  Available licenses: ${validLicenses.join(', ')}`)
      )
      process.exit(1)
    }

    // Auto-detect values if not provided
    const year = flags.year || new Date().getFullYear().toString()
    const owner =
      flags.owner || getGitConfig('user.name') || os.userInfo().username
    const url = flags.url || getGitConfig('--get remote.origin.url') || ''

    console.log(chalk.blue('📜 LicenseGuard - Fast License Setup\n'))
    console.log(chalk.gray(`License: ${flags.license}`))
    console.log(chalk.gray(`Owner: ${owner}`))
    console.log(chalk.gray(`Year: ${year}`))
    if (url) console.log(chalk.gray(`URL: ${url}`))
    console.log()

    // Generate license text
    const licenseContent = generateLicense(flags.license, owner, year, url)

    // Write LICENSE file directly (no prompt in fast mode)
    fs.writeFileSync('LICENSE', licenseContent, 'utf8')

    // Write config file
    writeConfig({
      license: flags.license,
      owner: owner,
      year: year,
      url: url,
    })

    // Success messages
    console.log(chalk.green('✓ LICENSE file created'))
    console.log(chalk.green('✓ Configuration saved to .licenseguardrc'))

    // Git hooks installation (no prompts in fast mode)
    if (isGitRepo()) {
      installHooks()
    } else {
      console.log(chalk.yellow('⚠️  Skipping git hooks (not a git repo)'))
    }

    console.log(
      chalk.blue(
        `\n📄 Your project is now licensed under ${flags.license.toUpperCase()}`
      )
    )

    process.exit(0)
  } catch (error) {
    console.error(chalk.red('\n✗ Error during fast setup:'), error.message)
    process.exit(1)
  }
}

module.exports = { runInitFast }
