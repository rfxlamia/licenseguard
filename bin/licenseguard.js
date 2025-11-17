#!/usr/bin/env node

const { program } = require('commander')
const { runList } = require('../lib/commands/list')
const { runInit } = require('../lib/commands/init')
const { runInitFast } = require('../lib/commands/init-fast')
const { setupCommand } = require('../lib/commands/setup')

program
  .version('1.1.0')
  .description('License setup & compliance helper for developers')

program
  .option('--init', 'Interactive license setup wizard')
  .option('--init-fast', 'Non-interactive fast setup')
  .option('--license <type>', 'License type (for --init-fast)')
  .option('--owner <name>', 'Copyright owner name (for --init-fast)')
  .option('--year <year>', 'Copyright year (for --init-fast)')
  .option('--url <url>', 'Project URL (for --init-fast)')
  .option('--ls', 'List available license templates')
  .option(
    '--setup',
    'Setup license notification and install git hooks (for npm prepare script)'
  )
  .parse(process.argv)

const options = program.opts()

if (options.init) {
  runInit().catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
} else if (options.initFast) {
  runInitFast(options).catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
} else if (options.ls) {
  runList().catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
} else if (options.setup) {
  setupCommand().catch((err) => {
    // Even on error, don't exit 1 - npm prepare compatibility
    console.error('Setup warning:', err.message)
  })
} else {
  program.help()
}
