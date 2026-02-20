const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const os = require('os')

// Mock chalk to avoid ANSI codes in test output
jest.mock('chalk', () => ({
  yellow: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  gray: jest.fn((str) => str),
}))

const { installHooks } = require('../../lib/utils/git-helpers')

describe('ESM project hooks integration', () => {
  let tempDir
  let originalCwd
  let consoleLogSpy

  beforeEach(() => {
    jest.clearAllMocks()

    // Save original working directory
    originalCwd = process.cwd()

    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-esm-test-'))

    // Create ESM project structure
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-esm-project',
        type: 'module',
        scripts: {
          prepare: 'licenseguard --setup || true'
        }
      })
    )

    fs.writeFileSync(
      path.join(tempDir, '.licenseguardrc'),
      JSON.stringify({ license: 'MIT', owner: 'Test' })
    )

    // Create git hooks directory
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, '.git', 'hooks'), { recursive: true })

    // Change to temp directory
    process.chdir(tempDir)

    // Mock console output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original directory
    process.chdir(originalCwd)

    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }

    // Restore spies
    consoleLogSpy.mockRestore()
  })

  test('hooks work when project has type: module', () => {
    // Run installHooks in ESM project context
    const result = installHooks()

    expect(result).toBe(true)

    // Verify hook files exist
    const postCheckoutPath = path.join(tempDir, '.git', 'hooks', 'post-checkout')
    const preCommitPath = path.join(tempDir, '.git', 'hooks', 'pre-commit')

    expect(fs.existsSync(postCheckoutPath)).toBe(true)
    expect(fs.existsSync(preCommitPath)).toBe(true)

    // Verify hooks use ESM syntax
    const postCheckoutContent = fs.readFileSync(postCheckoutPath, 'utf8')
    const preCommitContent = fs.readFileSync(preCommitPath, 'utf8')

    expect(postCheckoutContent).toContain('import fs from')
    expect(postCheckoutContent).toContain('import path from')
    expect(postCheckoutContent).toContain('fileURLToPath')
    expect(postCheckoutContent).not.toContain('require(')

    expect(preCommitContent).toContain('import fs from')
    expect(preCommitContent).toContain('import path from')
    expect(preCommitContent).toContain('fileURLToPath')
    expect(preCommitContent).not.toContain('require(')
  })

  test('generated ESM hooks can execute without errors', () => {
    // Install hooks
    installHooks()

    const postCheckoutPath = path.join(tempDir, '.git', 'hooks', 'post-checkout')
    const preCommitPath = path.join(tempDir, '.git', 'hooks', 'pre-commit')

    // Verify hooks can run without error
    // Using stdio: 'pipe' to capture any error output
    expect(() => {
      execSync(postCheckoutPath, { cwd: tempDir, stdio: 'pipe' })
    }).not.toThrow()

    expect(() => {
      execSync(preCommitPath, { cwd: tempDir, stdio: 'pipe' })
    }).not.toThrow()
  })

  test('ESM hooks output correct license notification', () => {
    // Install hooks
    installHooks()

    const postCheckoutPath = path.join(tempDir, '.git', 'hooks', 'post-checkout')

    // Run hook and capture output
    const output = execSync(postCheckoutPath, { cwd: tempDir, encoding: 'utf8' })

    // Verify output contains expected license notification
    expect(output).toContain('MIT')
    expect(output).toContain('Test')
  })

  test('ESM hooks handle missing config gracefully', () => {
    // Remove config file
    fs.unlinkSync(path.join(tempDir, '.licenseguardrc'))

    // Install hooks
    installHooks()

    const postCheckoutPath = path.join(tempDir, '.git', 'hooks', 'post-checkout')

    // Hook should exit silently (exit code 0) when no config
    expect(() => {
      execSync(postCheckoutPath, { cwd: tempDir, stdio: 'pipe' })
    }).not.toThrow()

    // No output expected when config is missing
    const output = execSync(postCheckoutPath, { cwd: tempDir, encoding: 'utf8' })
    expect(output).toBe('')
  })

  test('ESM hooks are executable on Unix', () => {
    // Skip on Windows
    if (process.platform === 'win32') {
      return
    }

    // Install hooks
    installHooks()

    const postCheckoutPath = path.join(tempDir, '.git', 'hooks', 'post-checkout')
    const preCommitPath = path.join(tempDir, '.git', 'hooks', 'pre-commit')

    const postCheckoutStat = fs.statSync(postCheckoutPath)
    const preCommitStat = fs.statSync(preCommitPath)

    // Check executable bit (0o755)
    // eslint-disable-next-line no-bitwise
    expect(postCheckoutStat.mode & 0o755).toBe(0o755)
    // eslint-disable-next-line no-bitwise
    expect(preCommitStat.mode & 0o755).toBe(0o755)
  })
})
