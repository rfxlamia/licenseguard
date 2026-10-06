const fs = require('fs')
const os = require('os')
const path = require('path')
const { scanDependencies, displayConflictReport } = require('../../lib/scanner')
const { runScan } = require('../../lib/commands/scan')

// Dependency-path discovery shells out to npm; compatibility evaluation stays real.
jest.mock('../../lib/scanner/path-tracer', () => ({
  traceDependencyPath: jest.fn(() => null)
}))

describe('Directional compatibility policy', () => {
  let tempDir
  let originalCwd
  let logSpy

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-policy-'))
    process.chdir(tempDir)
    fs.writeFileSync('package.json', JSON.stringify({
      name: 'apache-project', license: 'Apache-2.0', dependencies: { 'gpl-library': '1.0.0' }
    }))
    fs.mkdirSync('node_modules/gpl-library', { recursive: true })
    fs.writeFileSync('node_modules/gpl-library/package.json', JSON.stringify({
      name: 'gpl-library', version: '1.0.0', license: 'GPL-3.0-only'
    }))
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
  })

  afterEach(() => {
    process.chdir(originalCwd)
    fs.rmSync(tempDir, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  it('reports a blocking GPLv3 conflict with the matching directional citation', async () => {
    const result = await scanDependencies('Apache-2.0')
    expect(result.incompatible).toBe(1)
    expect(result.compatible).toBe(0)
    expect(result.issues[0]).toMatchObject({
      package: 'gpl-library@1.0.0', type: 'conflict', license: 'GPL-3.0-only'
    })

    expect(await displayConflictReport(result, 'Apache-2.0', { explain: true })).toBe(true)
    const output = logSpy.mock.calls.map(args => args.join(' ')).join('\n')
    expect(output).toContain(result.issues[0].reason)
    expect(output).toContain('GPLv3 software cannot be included in Apache-2.0 projects')
    expect(output).toContain('https://www.apache.org/licenses/GPL-compatibility.html')
  })

  it('exits with a failure status when scan encounters the conflict', async () => {
    // Capture the requested CLI exit without terminating Jest.
    jest.spyOn(process, 'exit').mockImplementation(() => {})
    await runScan({ license: 'Apache-2.0', explain: true })
    expect(process.exit).toHaveBeenCalledWith(1)
    expect(logSpy.mock.calls.flat().join('\n')).toContain('GPLv3 software cannot be included in Apache-2.0 projects')
  })
})
