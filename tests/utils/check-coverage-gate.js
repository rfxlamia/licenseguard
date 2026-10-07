const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { jest: productionConfig } = require('../../package.json')

// Run separately from the application suite so fixtures cannot inflate coverage.
const thresholds = productionConfig?.coverageThreshold?.global
const metrics = ['statements', 'branches', 'lines']
for (const metric of metrics) {
  assert.ok(Number.isFinite(thresholds?.[metric]) && thresholds[metric] > 0,
    `Missing positive global coverage threshold for ${metric}`)
}

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-coverage-gate-'))
try {
  fs.writeFileSync(path.join(fixtureDir, 'subject.js'), [
    'module.exports = function choose(flag) {',
    '  if (flag) {',
    '    return "yes"',
    '  }',
    '  return "no"',
    '}',
  ].join('\n'))

  const runFixture = (fullyCovered, coverageThreshold) => {
    fs.writeFileSync(path.join(fixtureDir, 'subject.test.js'), [
      'const choose = require("./subject")',
      'test("chooses the matching result", () => {',
      '  expect(choose(true)).toBe("yes")',
      fullyCovered ? '  expect(choose(false)).toBe("no")' : '',
      '})',
    ].join('\n'))

    const config = {
      ...productionConfig,
      rootDir: fixtureDir,
      testMatch: ['<rootDir>/subject.test.js'],
      collectCoverageFrom: ['subject.js'],
      coverageDirectory: path.join(fixtureDir, 'coverage'),
      coverageReporters: ['json-summary'],
      coverageThreshold: { global: coverageThreshold },
    }
    const result = spawnSync(process.execPath, [
      require.resolve('jest/bin/jest'), '--config', JSON.stringify(config),
      '--coverage', '--runInBand', '--no-cache',
    ], { cwd: fixtureDir, encoding: 'utf8', timeout: 60000 })
    if (result.error) throw result.error
    const output = result.stdout + result.stderr
    assert.match(output, /Tests:\s+1 passed/, output)
    const summary = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'coverage', 'coverage-summary.json'), 'utf8'))
    assert.ok(summary.total.statements.total > 0, `Fixture was not instrumented: ${JSON.stringify(summary)}`)
    return { ...result, output }
  }

  const passing = runFixture(true, thresholds)
  assert.equal(passing.status, 0, passing.output)
  console.log('PASS: fully covered code meets the production thresholds')

  for (const metric of metrics) {
    // Isolate each threshold so a failure in another metric cannot hide a bypass.
    const isolated = Object.fromEntries(metrics.map(name => [name, name === metric ? thresholds[name] : 0]))
    const failing = runFixture(false, isolated)
    assert.equal(failing.status, 1, failing.output)
    assert.match(failing.output, new RegExp(`Coverage for ${metric} .* does not meet .* threshold`), failing.output)
    console.log(`PASS: insufficient ${metric} coverage fails Jest`)
  }
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true })
}
