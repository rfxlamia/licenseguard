const fs = require('fs')
const os = require('os')
const path = require('path')
const childProcess = require('child_process')

describe('postinstall global hook setup', () => {
  let homeDirectory
  let hooksDirectory
  let logSpy
  let gitConfigSpy

  beforeEach(() => {
    homeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-postinstall-'))
    hooksDirectory = path.join(homeDirectory, '.git-templates', 'hooks')
    jest.spyOn(os, 'homedir').mockReturnValue(homeDirectory)
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    // Never change the developer's global Git configuration from a test.
    gitConfigSpy = jest.spyOn(childProcess, 'execSync').mockReturnValue('')
    jest.replaceProperty(process, 'env', { ...process.env, npm_config_global: 'true' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fs.rmSync(homeDirectory, { recursive: true, force: true })
  })

  function install() {
    jest.isolateModules(() => require('../../lib/postinstall'))
  }

  test('local installs do not create global hooks or alter Git configuration', () => {
    process.env.npm_config_global = 'false'
    install()
    expect(fs.existsSync(path.join(homeDirectory, '.git-templates'))).toBe(false)
    expect(gitConfigSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })

  test('global installs create both self-contained notification hooks', () => {
    install()
    for (const name of ['post-checkout', 'pre-commit']) {
      const script = fs.readFileSync(path.join(hooksDirectory, name), 'utf8')
      expect(script).toContain('.licenseguardrc')
      expect(script).toContain('import fs from \'fs\'')
      expect(script).toContain('process.exit(0)')
    }
    expect(gitConfigSpy).toHaveBeenCalledWith(
      `git config --global init.templateDir "${path.join(homeDirectory, '.git-templates')}"`,
      { stdio: 'pipe' })
    expect(logSpy).toHaveBeenCalledWith('✓ LicenseGuard global hooks installed')
  })

  test('preserves existing third-party hooks and creates LicenseGuard variants', () => {
    fs.mkdirSync(hooksDirectory, { recursive: true })
    fs.writeFileSync(path.join(hooksDirectory, 'post-checkout'), '#!/bin/sh\necho custom')
    install()
    expect(fs.readFileSync(path.join(hooksDirectory, 'post-checkout'), 'utf8')).toBe('#!/bin/sh\necho custom')
    expect(fs.readFileSync(path.join(hooksDirectory, 'licenseguard-post-checkout'), 'utf8')).toContain('.licenseguardrc')
    expect(logSpy).toHaveBeenCalledWith('⚠️  Existing post-checkout found, created licenseguard-post-checkout')
  })

  test('does not overwrite existing LicenseGuard hooks', () => {
    fs.mkdirSync(hooksDirectory, { recursive: true })
    const existing = '// .licenseguardrc custom notification'
    fs.writeFileSync(path.join(hooksDirectory, 'pre-commit'), existing)
    install()
    expect(fs.readFileSync(path.join(hooksDirectory, 'pre-commit'), 'utf8')).toBe(existing)
    expect(fs.existsSync(path.join(hooksDirectory, 'licenseguard-pre-commit'))).toBe(false)
  })

  test('hook setup errors do not fail installation', () => {
    gitConfigSpy.mockImplementation(() => { throw new Error('git unavailable') })
    expect(install).not.toThrow()
    expect(logSpy).toHaveBeenCalledWith('⚠️  Could not setup global hooks:', 'git unavailable')
    expect(logSpy).toHaveBeenCalledWith('  LicenseGuard still works, run licenseguard --setup manually')
  })
})
