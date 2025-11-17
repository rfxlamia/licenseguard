const licenses = [
  {
    name: 'MIT',
    description: 'MIT License (permissive, widely used)',
  },
  {
    name: 'Apache 2.0',
    description: 'Apache License 2.0 (permissive with patent grant)',
  },
  {
    name: 'GPL 3.0',
    description: 'GNU General Public License 3.0 (copyleft)',
  },
  {
    name: 'BSD 3-Clause',
    description: 'BSD 3-Clause License (permissive with attribution)',
  },
  {
    name: 'ISC',
    description: 'ISC License (simpler MIT alternative)',
  },
  {
    name: 'WTFPL',
    description:
      'Do What The F*ck You Want To Public License (ultra-permissive)',
  },
]

async function runList() {
  // Dynamic import for chalk v5 (ESM-only)
  const chalk = (await import('chalk')).default

  console.log(chalk.bold('\nAvailable License Templates:\n'))

  licenses.forEach((license) => {
    console.log(
      chalk.green('✓') +
        ' ' +
        chalk.bold(license.name) +
        ' - ' +
        license.description
    )
  })

  console.log('')
  process.exit(0)
}

module.exports = { runList }
