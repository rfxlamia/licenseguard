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
    const configContent = JSON.stringify(config, null, 2)
    fs.writeFileSync('.licenseguardrc', configContent, 'utf8')
    return true
  } catch (error) {
    console.error(chalk.red('✗ Error writing .licenseguardrc:'), error.message)
    throw error
  }
}

module.exports = { writeLicenseFile, writeConfig }
