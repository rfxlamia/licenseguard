const fs = require('fs')
const path = require('path')
const os = require('os')
const mockFs = require('mock-fs')

// Mock inquirer before requiring modules
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}))

// Mock chalk to avoid ANSI codes
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

describe('Integration: init with scanner', () => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-scan-test-'))
    process.chdir(tempDir)

    // Mock console output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // Mock process.exit
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

    // Restore mock-fs if it was used
    mockFs.restore()
  })

  describe('Clean scan (no conflicts)', () => {
    beforeEach(() => {
      // Create package.json with MIT-compatible dependencies
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'mit-package': '^1.0.0',
            'isc-package': '^2.0.0',
          },
        })
      )

      // Create mock node_modules
      fs.mkdirSync('node_modules/mit-package', { recursive: true })
      fs.writeFileSync(
        'node_modules/mit-package/package.json',
        JSON.stringify({
          name: 'mit-package',
          version: '1.0.0',
          license: 'MIT',
        })
      )

      fs.mkdirSync('node_modules/isc-package', { recursive: true })
      fs.writeFileSync(
        'node_modules/isc-package/package.json',
        JSON.stringify({
          name: 'isc-package',
          version: '2.0.0',
          license: 'ISC',
        })
      )
    })

    it('should create LICENSE when all dependencies are compatible', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true, // Story 2.4: Save prompt
        })
        .mockResolvedValueOnce({
          initGit: false, // Skip git init in test
        })

      try {
        await runInit({})
      } catch (error) {
        // Expected - process.exit throws
      }

      // Verify LICENSE file was created
      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('should display success message for compatible dependencies', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true, // Story 2.4: Save prompt
        })
        .mockResolvedValueOnce({ initGit: false })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      // Check for success message in console output
      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).toContain('All 2 dependencies compatible')
    })
  })

  describe('GPL conflict detection', () => {
    beforeEach(() => {
      // Create package.json with GPL dependency
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'mit-package': '^1.0.0',
            'gpl-package': '^3.0.0',
          },
        })
      )

      // MIT-compatible package
      fs.mkdirSync('node_modules/mit-package', { recursive: true })
      fs.writeFileSync(
        'node_modules/mit-package/package.json',
        JSON.stringify({
          name: 'mit-package',
          version: '1.0.0',
          license: 'MIT',
        })
      )

      // GPL package (conflict with MIT)
      fs.mkdirSync('node_modules/gpl-package', { recursive: true })
      fs.writeFileSync(
        'node_modules/gpl-package/package.json',
        JSON.stringify({
          name: 'gpl-package',
          version: '3.0.0',
          license: 'GPL-3.0',
        })
      )
    })

    it('should block LICENSE creation when GPL conflict detected (no --force)', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })

      try {
        await runInit({}) // No --force flag
      } catch (error) {
        // Expected - process.exit(1) throws
      }

      // Verify LICENSE was NOT created
      expect(fs.existsSync('LICENSE')).toBe(false)

      // Verify exit 1 was called (conflict blocking)
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should display error message with guidance when blocked', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      // Check error messages
      const allErrors = consoleErrorSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allErrors).toContain('LICENSE NOT created due to license conflicts')

      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).toContain('Fix conflicts or use --force')
      expect(allLogs).toContain('licenseguard init --force')
    })

    it('should create LICENSE when GPL conflict detected with --force', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: false, // Story 2.4: Don't save conflicts by default
        })
        .mockResolvedValueOnce({ initGit: false })

      try {
        await runInit({ force: true }) // WITH --force flag
      } catch (error) {
        // Expected - process.exit(0) throws
      }

      // Verify LICENSE WAS created despite conflict
      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('should display warning when using --force with conflicts', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: false, // Story 2.4: Don't save conflicts by default
        })
        .mockResolvedValueOnce({ initGit: false })

      try {
        await runInit({ force: true })
      } catch (error) {
        // Expected
      }

      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).toContain('Creating LICENSE despite conflicts')
      expect(allLogs).toContain('--force mode')
    })
  })

  describe('--noscan flag', () => {
    beforeEach(() => {
      // Create package.json with GPL dependency (conflict)
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'gpl-package': '^3.0.0',
          },
        })
      )

      fs.mkdirSync('node_modules/gpl-package', { recursive: true })
      fs.writeFileSync(
        'node_modules/gpl-package/package.json',
        JSON.stringify({
          name: 'gpl-package',
          version: '3.0.0',
          license: 'GPL-3.0',
        })
      )
    })

    it('should skip scanning when --noscan flag is used', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({ initGit: false })

      try {
        await runInit({ noscan: true }) // WITH --noscan
      } catch (error) {
        // Expected
      }

      // LICENSE should be created (no scan, no block)
      expect(fs.existsSync('LICENSE')).toBe(true)

      // Should NOT see scanning messages
      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).not.toContain('Scanning dependencies')
    })

    it('should create LICENSE with --noscan even when conflicts exist', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({ initGit: false })

      try {
        await runInit({ noscan: true })
      } catch (error) {
        // Expected
      }

      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })
  })

  describe('UNKNOWN license warning', () => {
    beforeEach(() => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'unknown-package': '^1.0.0',
          },
        })
      )

      // Package with no license field
      fs.mkdirSync('node_modules/unknown-package', { recursive: true })
      fs.writeFileSync(
        'node_modules/unknown-package/package.json',
        JSON.stringify({
          name: 'unknown-package',
          version: '1.0.0',
          // No license field
        })
      )
    })

    it('should create LICENSE when UNKNOWN license found (warnings dont block)', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true, // Story 2.4: Save prompt
        })
        .mockResolvedValueOnce({ initGit: false })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      // LICENSE should be created (warnings don't block)
      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('should display warning for UNKNOWN license', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true, // Story 2.4: Save prompt
        })
        .mockResolvedValueOnce({ initGit: false })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).toContain('UNKNOWN')
      expect(allLogs).toContain('unknown-package')
    })
  })

  describe('Fast mode with scanning', () => {
    beforeEach(() => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'mit-package': '^1.0.0',
          },
        })
      )

      fs.mkdirSync('node_modules/mit-package', { recursive: true })
      fs.writeFileSync(
        'node_modules/mit-package/package.json',
        JSON.stringify({
          name: 'mit-package',
          version: '1.0.0',
          license: 'MIT',
        })
      )
    })

    it('should scan dependencies in fast mode', async () => {
      try {
        await runInitFast({ license: 'mit', fast: true })
      } catch (error) {
        // Expected
      }

      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).toContain('Scanning dependencies')

      // LICENSE should be created
      expect(fs.existsSync('LICENSE')).toBe(true)
    })

    it('should block in fast mode when conflicts found', async () => {
      // Add GPL package
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'gpl-package': '^3.0.0',
          },
        })
      )

      fs.mkdirSync('node_modules/gpl-package', { recursive: true })
      fs.writeFileSync(
        'node_modules/gpl-package/package.json',
        JSON.stringify({
          name: 'gpl-package',
          version: '3.0.0',
          license: 'GPL-3.0',
        })
      )

      try {
        await runInitFast({ license: 'mit', fast: true })
      } catch (error) {
        // Expected
      }

      expect(fs.existsSync('LICENSE')).toBe(false)
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should respect --noscan in fast mode', async () => {
      try {
        await runInitFast({ license: 'mit', fast: true, noscan: true })
      } catch (error) {
        // Expected
      }

      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).not.toContain('Scanning dependencies')

      expect(fs.existsSync('LICENSE')).toBe(true)
    })
  })

  describe('No dependencies', () => {
    beforeEach(() => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {},
        })
      )
    })

    it('should handle empty dependencies gracefully', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({ initGit: false })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      expect(fs.existsSync('LICENSE')).toBe(true)

      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).toContain('All 0 dependencies compatible')
    })
  })
})
