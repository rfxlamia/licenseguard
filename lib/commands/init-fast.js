const { execSync } = require('child_process')
const os = require('os')
const fs = require('fs')
const chalk = require('chalk')
const { generateLicense, LICENSE_TEMPLATES } = require('../templates')
const { writeConfig } = require('../utils/file-ops')
const { isGitRepo, installHooks } = require('../utils/git-helpers')
const { scanDependencies, displayConflictReport } = require('../scanner')
const { toSPDX } = require('../utils/license-mapper')

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

    // Scanner integration (Story 2.3) - Fast mode
    let scanResult = null
    if (!options.noscan) {
      const spdxLicense = toSPDX(flags.license)

      try {
        console.log(chalk.blue('🔍 Scanning dependencies for license conflicts...\n'))

        scanResult = await scanDependencies(spdxLicense)
        const hasConflicts = await displayConflictReport(scanResult, spdxLicense)

        if (hasConflicts && !options.force) {
          // Block LICENSE creation due to conflicts
          console.error(chalk.red('\n✗ LICENSE NOT created due to license conflicts.'))
          console.log(chalk.yellow('\nFix conflicts or use --force to proceed anyway:'))
          console.log(chalk.blue('  licenseguard init --fast --force --license ' + flags.license + '\n'))
          process.exit(1)
        }

        if (hasConflicts && options.force) {
          console.log(chalk.yellow('\n⚠️  Creating LICENSE despite conflicts (--force mode)\n'))
        }
      } catch (scanError) {
        // If scanning fails (not process.exit), warn but don't block
        if (scanError.message !== 'process.exit called') {
          console.log(chalk.yellow(`\n⚠️  Dependency scanning failed: ${scanError.message}`))
          console.log(chalk.yellow('Continuing with LICENSE creation...\n'))
        } else {
          // Re-throw process.exit errors
          throw scanError
        }
      }
    }

    // Generate license text
    const licenseContent = generateLicense(flags.license, owner, year, url)

    // Write LICENSE file directly (no prompt in fast mode)
    fs.writeFileSync('LICENSE', licenseContent, 'utf8')

    // Auto-save scan results in fast mode (Story 2.4: AC #1, #2)
    // Default: YES for clean scans, NO for conflicts
    const configData = {
      license: flags.license,
      owner: owner,
      year: year,
      url: url,
    }

    if (scanResult) {
      const hasConflicts = scanResult.incompatible > 0
      const shouldSave = !hasConflicts // Auto-save if clean

      if (shouldSave) {
        configData.scanResult = scanResult
      }
    }

    // Write config file
    writeConfig(configData)

    // Feedback for scan result save
    if (scanResult) {
      const hasConflicts = scanResult.incompatible > 0
      if (!hasConflicts) {
        console.log(chalk.green('✓ Scan results saved to .licenseguardrc'))
      } else {
        console.log(chalk.gray('Scan results not saved (conflicts detected)'))
      }
    }

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
