const fs = require('fs')
const inquirer = require('inquirer')
const chalk = require('chalk')

async function writeLicenseFile(content) {
  // Check if LICENSE file already exists
  if (fs.existsSync('LICENSE')) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: chalk.yellow('LICENSE file already exists. Overwrite?'),
        default: false,
      },
    ])

    if (!overwrite) {
      console.log(
        chalk.blue('ℹ️  Keeping existing LICENSE file. Operation cancelled.')
      )
      return false
    }
  }

  // Write LICENSE file
  try {
    fs.writeFileSync('LICENSE', content, 'utf8')
    return true
  } catch (error) {
    console.error(chalk.red('✗ Error writing LICENSE file:'), error.message)
    throw error
  }
}

function writeConfig(config) {
  try {
    let finalConfig = config

    // If .licenseguardrc exists, preserve existing fields when updating
    if (fs.existsSync('.licenseguardrc')) {
      try {
        const existingContent = fs.readFileSync('.licenseguardrc', 'utf8')
        const existingConfig = JSON.parse(existingContent)

        // Merge: new config overwrites matching fields (including scanResult)
        // But existing fields not in new config are preserved
        finalConfig = { ...existingConfig, ...config }
      } catch (parseError) {
        // If existing file is malformed, just use new config
        console.log(chalk.yellow('⚠️  Existing .licenseguardrc malformed, overwriting'))
      }
    }

    const configContent = JSON.stringify(finalConfig, null, 2)
    fs.writeFileSync('.licenseguardrc', configContent, 'utf8')
    return true
  } catch (error) {
    console.error(chalk.red('✗ Error writing .licenseguardrc:'), error.message)
    throw error
  }
}

module.exports = { writeLicenseFile, writeConfig }
