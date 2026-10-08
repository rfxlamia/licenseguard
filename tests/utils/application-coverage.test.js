const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { validateApplicationCoverage, prepareCoverageReport } = require('./check-application-coverage')

describe('application coverage report validation', () => {
  let root
  let summary

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-report-test-'))
    fs.mkdirSync(path.join(root, 'lib', 'commands'), { recursive: true })
    fs.mkdirSync(path.join(root, 'bin'))
    fs.writeFileSync(path.join(root, 'lib', 'commands', 'scan.js'), 'module.exports = 1')
    fs.writeFileSync(path.join(root, 'bin', 'cli.js'), 'module.exports = 2')
    summary = {
      total: { statements: { total: 2, covered: 1, pct: 50 } },
      [path.join(root, 'lib', 'commands', 'scan.js')]: { statements: { total: 1, covered: 1, pct: 100 } },
      [path.join(root, 'bin', 'cli.js')]: { statements: { total: 1, covered: 0, pct: 0 } },
    }
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  test('accepts all application files, including files with zero coverage', () => {
    expect(() => validateApplicationCoverage(summary, root)).not.toThrow()
  })

  test('rejects an empty report even when Jest exits successfully', () => {
    expect(() => validateApplicationCoverage({ total: { statements: { total: 0, pct: 'Unknown' } } }, root))
      .toThrow('Application coverage report is empty')
  })

  test.each(['lib/commands/scan.js', 'bin/cli.js'])('rejects omitted application file %s', relativePath => {
    delete summary[path.join(root, relativePath)]
    expect(() => validateApplicationCoverage(summary, root)).toThrow('Missing application coverage')
  })

  test('rejects a newly added module without coverage', () => {
    fs.writeFileSync(path.join(root, 'lib', 'new-module.js'), 'module.exports = 3')
    expect(() => validateApplicationCoverage(summary, root)).toThrow('lib/new-module.js')
  })

  test('rejects a file present in the report without instrumentation', () => {
    summary[path.join(root, 'bin', 'cli.js')].statements.total = 0
    expect(() => validateApplicationCoverage(summary, root)).toThrow('Application file was not instrumented')
  })

  test('removes a stale summary before a run without deleting other reports', () => {
    fs.mkdirSync(path.join(root, 'coverage'))
    fs.writeFileSync(path.join(root, 'coverage', 'coverage-summary.json'), JSON.stringify(summary))
    fs.writeFileSync(path.join(root, 'coverage', 'lcov.info'), 'existing lcov')
    prepareCoverageReport(root)
    expect(fs.existsSync(path.join(root, 'coverage', 'coverage-summary.json'))).toBe(false)
    expect(fs.readFileSync(path.join(root, 'coverage', 'lcov.info'), 'utf8')).toBe('existing lcov')
  })

  test('preparation works on a clean checkout without a coverage directory', () => {
    expect(() => prepareCoverageReport(root)).not.toThrow()
  })
})
