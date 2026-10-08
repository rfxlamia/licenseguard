const fs = require('fs')
const os = require('os')
const path = require('path')
const { runScan } = require('../../lib/commands/scan')
const { LICENSE_TEMPLATES } = require('../../lib/templates')

describe('scan project license detection', () => {
  let originalCwd
  let tempDir
  let logSpy
  let warnSpy

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-license-detection-'))
    process.chdir(tempDir)
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    fs.writeFileSync('.licenseguardrc', '{}')
    fs.writeFileSync('package.json', JSON.stringify({ name: 'fixture', license: 'ISC', dependencies: {} }))
  })

  afterEach(() => {
    process.chdir(originalCwd)
    fs.rmSync(tempDir, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  async function expectDetectedLicense(license) {
    await expect(runScan({})).resolves.toBeUndefined()
    const output = logSpy.mock.calls.map(args => args.join(' ')).join('\n')
    expect(output).toContain(`Detected project license: ${license}`)
  }

  test('configuration takes precedence over LICENSE and package metadata', async () => {
    fs.writeFileSync('.licenseguardrc', JSON.stringify({ license: 'Apache-2.0' }))
    fs.writeFileSync('LICENSE', LICENSE_TEMPLATES.mit)
    await expectDetectedLicense('Apache-2.0')
  })

  test.each(['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING'])(
    '%s takes precedence over package metadata when configuration is empty', async filename => {
      fs.writeFileSync(filename, LICENSE_TEMPLATES.mit)
      await expectDetectedLicense('MIT')
    })

  test('malformed configuration falls back to LICENSE', async () => {
    fs.writeFileSync('.licenseguardrc', '{broken')
    fs.writeFileSync('LICENSE', LICENSE_TEMPLATES.mit)
    await expectDetectedLicense('MIT')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not read .licenseguardrc'))
  })

  test('unrecognized LICENSE falls back to package metadata', async () => {
    fs.writeFileSync('LICENSE', 'An unrecognized custom license')
    await expectDetectedLicense('ISC')
  })

  test('malformed configuration falls back to package metadata when LICENSE is absent', async () => {
    fs.writeFileSync('.licenseguardrc', '{broken')
    await expectDetectedLicense('ISC')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not read .licenseguardrc'))
  })

  test.each(['{broken', JSON.stringify({ name: 'fixture' })])(
    'rejects a project with no detectable license and package contents %s', async contents => {
      fs.writeFileSync('package.json', contents)
      await expect(runScan({})).rejects.toThrow('Could not determine project license')
    })

  test('rejects a project without package metadata or license files', async () => {
    fs.unlinkSync('package.json')
    await expect(runScan({})).rejects.toThrow('Could not determine project license')
  })
})
