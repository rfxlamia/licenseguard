const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

// Mock inquirer before requiring modules that use it
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}))

// Mock chalk to avoid ANSI codes in test output
jest.mock('chalk', () => ({
  yellow: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  gray: jest.fn((str) => str),
}))

const inquirer = require('inquirer')
const { runInit } = require('../../lib/commands/init')
const { runInitFast } = require('../../lib/commands/init-fast')

describe('Integration: init workflow', () => {
  let tempDir
  let originalCwd
  let consoleLogSpy
  let consoleErrorSpy
  let processExitSpy

  beforeEach(() => {
    jest.clearAllMocks()

    // Save original working directory
    originalCwd = process.cwd()

    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-test-'))

    // Change to temp directory
    process.chdir(tempDir)

    // Mock console output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // Mock process.exit to prevent test from exiting
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
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
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  describe('runInit with git repository', () => {
    beforeEach(() => {
      // Initialize git repo in temp directory
      execSync('git init', { cwd: tempDir, stdio: 'ignore' })
    })

    it('should create LICENSE file with correct content', async () => {
      // Mock user prompts
      inquirer.prompt.mockResolvedValueOnce({
        license: 'mit',
        owner: 'Test User',
        year: '2025',
        url: 'https://github.com/test/repo',
      })

      try {
        await runInit()
      } catch (error) {
        // Expected - process.exit throws
      }

      // Verify LICENSE file created
      expect(fs.existsSync('LICENSE')).toBe(true)

      const licenseContent = fs.readFileSync('LICENSE', 'utf8')
      expect(licenseContent).toContain('MIT License')
      expect(licenseContent).toContain('Copyright (c) 2025 Test User')
    })

    it('should create .licenseguardrc with correct JSON', async () => {
      inquirer.prompt.mockResolvedValueOnce({
        license: 'mit',
        owner: 'Test User',
        year: '2025',
        url: 'https://github.com/test/repo',
      })

      try {
        await runInit()
      } catch (error) {
        // Expected - process.exit throws
      }

      // Verify config file created
      expect(fs.existsSync('.licenseguardrc')).toBe(true)

      const configContent = fs.readFileSync('.licenseguardrc', 'utf8')
      const config = JSON.parse(configContent)

      expect(config).toEqual({
        license: 'mit',
        owner: 'Test User',
        year: '2025',
        url: 'https://github.com/test/repo',
      })
    })

    it('should install git hooks in .git/hooks directory', async () => {
      inquirer.prompt.mockResolvedValueOnce({
        license: 'mit',
        owner: 'Test User',
        year: '2025',
        url: '',
      })

      try {
        await runInit()
      } catch (error) {
        // Expected - process.exit throws
      }

      // Verify hooks created
      const postCheckoutPath = path.join('.git', 'hooks', 'post-checkout')
      const preCommitPath = path.join('.git', 'hooks', 'pre-commit')

      expect(fs.existsSync(postCheckoutPath)).toBe(true)
      expect(fs.existsSync(preCommitPath)).toBe(true)
    })

    it('should make hooks executable on Unix', async () => {
      // Skip on Windows
      if (process.platform === 'win32') {
        return
      }

      inquirer.prompt.mockResolvedValueOnce({
        license: 'mit',
        owner: 'Test User',
        year: '2025',
        url: '',
      })

      try {
        await runInit()
      } catch (error) {
        // Expected - process.exit throws
      }

      const postCheckoutPath = path.join('.git', 'hooks', 'post-checkout')
      const preCommitPath = path.join('.git', 'hooks', 'pre-commit')

      const postCheckoutStat = fs.statSync(postCheckoutPath)
      const preCommitStat = fs.statSync(preCommitPath)

      // Check executable bit (0o755 = 493 in decimal)
      // eslint-disable-next-line no-bitwise
      expect(postCheckoutStat.mode & 0o755).toBe(0o755)
      // eslint-disable-next-line no-bitwise
      expect(preCommitStat.mode & 0o755).toBe(0o755)
    })

    it('should include Node.js shebang in hook scripts', async () => {
      inquirer.prompt.mockResolvedValueOnce({
        license: 'mit',
        owner: 'Test User',
        year: '2025',
        url: '',
      })

      try {
        await runInit()
      } catch (error) {
        // Expected - process.exit throws
      }

      const postCheckoutPath = path.join('.git', 'hooks', 'post-checkout')
      const preCommitPath = path.join('.git', 'hooks', 'pre-commit')

      const postCheckoutContent = fs.readFileSync(postCheckoutPath, 'utf8')
      const preCommitContent = fs.readFileSync(preCommitPath, 'utf8')

      expect(postCheckoutContent).toMatch(/^#!\/usr\/bin\/env node/)
      expect(preCommitContent).toMatch(/^#!\/usr\/bin\/env node/)
    })

    it('should handle existing hooks by creating variants', async () => {
      // Create existing hooks
      const hooksDir = path.join('.git', 'hooks')
      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true })
      }
      fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\necho "existing"', 'utf8')

      inquirer.prompt.mockResolvedValueOnce({
        license: 'mit',
        owner: 'Test User',
        year: '2025',
        url: '',
      })

      try {
        await runInit()
      } catch (error) {
        // Expected - process.exit throws
      }

      // Original hook should be unchanged
      const originalContent = fs.readFileSync(path.join(hooksDir, 'pre-commit'), 'utf8')
      expect(originalContent).toContain('existing')

      // Variant should be created
      const variantPath = path.join(hooksDir, 'licenseguard-pre-commit')
      expect(fs.existsSync(variantPath)).toBe(true)

      const variantContent = fs.readFileSync(variantPath, 'utf8')
      expect(variantContent).toContain('#!/usr/bin/env node')
    })
  })

  describe('runInit without git repository', () => {
    it('should prompt to initialize git and skip hooks if user declines', async () => {
      // First prompt: license selection
      // Second prompt: git init confirmation
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          initGit: false,
        })

      try {
        await runInit()
      } catch (error) {
        // Expected - process.exit throws
      }

      // LICENSE file should still be created
      expect(fs.existsSync('LICENSE')).toBe(true)

      // .licenseguardrc should still be created
      expect(fs.existsSync('.licenseguardrc')).toBe(true)

      // Git hooks should NOT be created (no .git directory)
      expect(fs.existsSync('.git/hooks/pre-commit')).toBe(false)
      expect(fs.existsSync('.git/hooks/post-checkout')).toBe(false)

      // Should have warned about skipping hooks
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping git hooks'))
    })

    it('should initialize git and install hooks if user accepts', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          initGit: true,
        })

      try {
        await runInit()
      } catch (error) {
        // Expected - process.exit throws
      }

      // Git should be initialized
      expect(fs.existsSync('.git')).toBe(true)

      // LICENSE and config should be created
      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(fs.existsSync('.licenseguardrc')).toBe(true)

      // Git hooks should be installed
      expect(fs.existsSync('.git/hooks/pre-commit')).toBe(true)
      expect(fs.existsSync('.git/hooks/post-checkout')).toBe(true)
    })
  })

  describe('runInitFast with git repository', () => {
    beforeEach(() => {
      execSync('git init', { cwd: tempDir, stdio: 'ignore' })
    })

    it('should create LICENSE, config, and hooks without prompts', async () => {
      const options = {
        license: 'apache2_0',
        owner: 'Apache Corp',
        year: '2025',
        url: 'https://apache.org',
      }

      try {
        await runInitFast(options)
      } catch (error) {
        // Expected - process.exit throws
      }

      // Verify all files created
      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(fs.existsSync('.licenseguardrc')).toBe(true)
      expect(fs.existsSync('.git/hooks/pre-commit')).toBe(true)
      expect(fs.existsSync('.git/hooks/post-checkout')).toBe(true)

      // Verify LICENSE content
      const licenseContent = fs.readFileSync('LICENSE', 'utf8')
      expect(licenseContent).toContain('Apache')
    })
  })

  describe('runInitFast without git repository', () => {
    it('should skip hooks and warn user', async () => {
      const options = {
        license: 'mit',
        owner: 'Test',
        year: '2025',
        url: '',
      }

      try {
        await runInitFast(options)
      } catch (error) {
        // Expected - process.exit throws
      }

      // LICENSE and config should be created
      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(fs.existsSync('.licenseguardrc')).toBe(true)

      // No hooks (no git repo)
      expect(fs.existsSync('.git')).toBe(false)

      // Should warn about skipping hooks
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping git hooks'))
    })
  })
})
