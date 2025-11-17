const inquirer = require('inquirer')
const chalk = require('chalk')
const { generateLicense } = require('../templates')
const { writeLicenseFile, writeConfig } = require('../utils/file-ops')
const { isGitRepo, initGitRepo, installHooks } = require('../utils/git-helpers')

async function runInit() {
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
          { name: 'WTDPL', value: 'wtdpl' },
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

    // Write config file
    writeConfig({
      license: answers.license,
      owner: answers.owner,
      year: answers.year,
      url: answers.url,
    })

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
