const inquirer = require('inquirer')
const chalk = require('chalk')
const { generateLicense } = require('../templates')
const { writeLicenseFile, writeConfig } = require('../utils/file-ops')
const { isGitRepo, initGitRepo, installHooks } = require('../utils/git-helpers')
const { scanDependencies, displayConflictReport } = require('../scanner')
const { toSPDX } = require('../utils/license-mapper')

async function runInit(options = {}) {
  try {
    console.log(chalk.blue('📜 LicenseGuard - Interactive License Setup\n'))

    // Prompt for license type
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'license',
        message: 'Select license type:',
        choices: [
          { name: 'MIT License', value: 'mit' },
          { name: 'Apache License 2.0', value: 'apache2_0' },
          { name: 'GNU GPL 3.0', value: 'gpl3_0' },
          { name: 'BSD 3-Clause License', value: 'bsd3clause' },
          { name: 'ISC License', value: 'isc' },
          { name: 'WTFPL', value: 'wtfpl' },
        ],
      },
      {
        type: 'input',
        name: 'owner',
        message: 'Copyright owner name:',
        validate: (input) => {
          if (!input || input.trim() === '') {
            return 'Owner name is required'
          }
          return true
        },
      },
      {
        type: 'input',
        name: 'year',
        message: 'Copyright year:',
        default: new Date().getFullYear().toString(),
      },
      {
        type: 'input',
        name: 'url',
        message: 'Project URL (optional):',
        default: '',
      },
    ])

    // Scanner integration (Story 2.3)
    let scanResult = null
    if (!options.noscan) {
      const spdxLicense = toSPDX(answers.license)

      try {
        console.log(chalk.blue('\n🔍 Scanning dependencies for license conflicts...\n'))

        scanResult = await scanDependencies(spdxLicense)
        const hasConflicts = displayConflictReport(scanResult, spdxLicense, { explain: options.explain })

        if (hasConflicts && !options.force) {
          // Block LICENSE creation due to conflicts
          console.error(chalk.red('\n✗ LICENSE NOT created due to license conflicts.'))
          console.log(chalk.yellow('\nFix conflicts or use --force to proceed anyway:'))
          console.log(chalk.blue('  licenseguard init --force\n'))
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
    const licenseContent = generateLicense(
      answers.license,
      answers.owner,
      answers.year,
      answers.url
    )

    // Write LICENSE file
    const licenseWritten = await writeLicenseFile(licenseContent)

    if (!licenseWritten) {
      // User cancelled overwrite
      process.exit(0)
    }

    // Prompt to save scan results (Story 2.4: AC #1, #2)
    let saveScanResult = false
    if (scanResult) {
      // Determine default: YES for clean scans, NO for conflicts
      const hasConflicts = scanResult.incompatible > 0
      const defaultSave = !hasConflicts

      const saveAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saveScanResult',
          message: 'Save scan results to .licenseguardrc?',
          default: defaultSave,
        },
      ])

      saveScanResult = saveAnswer.saveScanResult
    }

    // Write config file (Story 2.4: AC #3)
    const configData = {
      license: answers.license,
      owner: answers.owner,
      year: answers.year,
      url: answers.url,
    }

    if (saveScanResult && scanResult) {
      configData.scanResult = scanResult
    }

    writeConfig(configData)

    // Feedback for scan result save choice
    if (scanResult) {
      if (saveScanResult) {
        console.log(chalk.green('✓ Scan results saved to .licenseguardrc'))
      } else {
        console.log(chalk.gray('Scan results not saved'))
      }
    }

    // Success messages
    console.log(chalk.green('\n✓ LICENSE file created'))
    console.log(chalk.green('✓ Configuration saved to .licenseguardrc'))

    // Git hooks installation
    let skipHooks = false

    if (!isGitRepo()) {
      const gitAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'initGit',
          message: 'Not a git repository. Initialize git?',
          default: true,
        },
      ])

      if (gitAnswer.initGit) {
        const gitInitSuccess = initGitRepo()
        if (!gitInitSuccess) {
          skipHooks = true
        }
      } else {
        console.log(chalk.yellow('⚠️  Skipping git hooks (not a git repo)'))
        skipHooks = true
      }
    }

    if (!skipHooks && isGitRepo()) {
      installHooks()
    }

    console.log(
      chalk.blue(
        `\n📄 Your project is now licensed under ${answers.license.toUpperCase()}`
      )
    )

    process.exit(0)
  } catch (error) {
    console.error(chalk.red('\n✗ Error during initialization:'), error.message)
    process.exit(1)
  }
}

module.exports = { runInit }
