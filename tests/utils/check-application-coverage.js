const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function applicationFiles(root) {
  const files = []
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(filename)
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(filename)
    }
  }
  for (const directory of ['lib', 'bin']) visit(path.join(root, directory))
  return files
}

function validateApplicationCoverage(summary, root) {
  assert.ok(summary?.total?.statements?.total > 0, 'Application coverage report is empty')
  const reported = new Map(Object.entries(summary)
    .filter(([filename]) => filename !== 'total')
    .map(([filename, coverage]) => [path.resolve(root, filename), coverage]))
  const files = applicationFiles(root)
  assert.ok(files.length > 0, 'No application JavaScript files found')
  for (const filename of files) {
    const relative = path.relative(root, filename).split(path.sep).join('/')
    assert.ok(reported.has(filename), `Missing application coverage for ${relative}`)
    assert.ok(reported.get(filename)?.statements?.total > 0,
      `Application file was not instrumented: ${relative}`)
  }
}

function prepareCoverageReport(root) {
  // A removed reporter must not allow an old summary to satisfy validation.
  fs.rmSync(path.join(root, 'coverage', 'coverage-summary.json'), { force: true })
}

if (require.main === module) {
  const root = process.cwd()
  if (process.argv[2] === '--prepare') {
    prepareCoverageReport(root)
  } else {
    const summary = JSON.parse(fs.readFileSync(path.join(root, 'coverage', 'coverage-summary.json'), 'utf8'))
    validateApplicationCoverage(summary, root)
    console.log('PASS: all lib/**/*.js and bin/**/*.js files are instrumented in the application report')
  }
}

module.exports = { validateApplicationCoverage, prepareCoverageReport }
