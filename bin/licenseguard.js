#!/usr/bin/env node

const { program } = require('commander')
const chalk = require('chalk')
const { version } = require('../package.json')
const { runList } = require('../lib/commands/list')
const { runInit } = require('../lib/commands/init')
const { runInitFast } = require('../lib/commands/init-fast')
const { runScan } = require('../lib/commands/scan')
const { setupCommand } = require('../lib/commands/setup')
const { checkForUpdates } = require('../lib/utils/update-notifier')

// Check for updates (non-blocking, silent failure)
checkForUpdates(version).catch(() => {
  // Silent failure - don't block user
})

program
  .version(version)
  .description('License setup & compliance guard for developers')

// Init command with subcommand-specific options
program
  .command('init')
  .description('Interactive license setup with dependency scanning')
  .option('--force', 'Create LICENSE despite conflicts')
  .option('--noscan', 'Skip dependency scanning')
  .option('--explain', 'Show authoritative source citations for license compatibility decisions')
  .option('--fast', 'Non-interactive mode with auto-detection')
  .option('--license <type>', 'License type (for --fast mode)')
  .option('--owner <name>', 'Copyright owner name (for --fast mode)')
  .option('--year <year>', 'Copyright year (for --fast mode)')
  .option('--url <url>', 'Project URL (for --fast mode)')
  .action(async (options) => {
    try {
      if (options.fast) {
        await runInitFast(options)
      } else {
        await runInit(options)
      }
    } catch (error) {
      console.error(chalk.red('✗ Error:'), error.message)
      process.exit(1)
    }
  })

// Scan command
program
  .command('scan')
  .description('Scan dependencies for license conflicts')
  .option('--license <type>', 'Specify project license (if not auto-detected)')
  .option('--allow', 'Allow conflicts (exit 0 even if conflicts found)')
  .option('--fail-on-unknown', 'Fail if unknown licenses detected')
  .option('--explain', 'Show authoritative source citations for license compatibility decisions')
  .option('--cwd <path>', 'Working directory to scan')
  .action(async (options) => {
    try {
      await runScan(options)
    } catch (error) {
      console.error(chalk.red('✗ Error:'), error.message)
      process.exit(1)
    }
  })

// List command
program
  .command('ls')
  .description('List available license templates')
  .action(async () => {
    try {
      await runList()
    } catch (error) {
      console.error(chalk.red('✗ Error:'), error.message)
      process.exit(1)
    }
  })

// Setup command (kept for npm prepare script compatibility)
program
  .command('setup')
  .description('Setup license notification and install git hooks (for npm prepare script)')
  .action(async () => {
    try {
      await setupCommand()
    } catch (error) {
      // Even on error, don't exit 1 - npm prepare compatibility
      console.error(chalk.yellow('⚠️  Setup warning:'), error.message)
    }
  })

program.parse(process.argv)

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.help()
}
