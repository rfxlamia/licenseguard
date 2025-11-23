/**
 * Integration tests for C/C++ Conan scanning
 * Tests full init flow with Conan project detection
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

// Mock child_process for Conan commands
jest.mock('child_process')

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

describe('Integration: C/C++ Conan scanning', () => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-cpp-test-'))
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
  })

  describe('Conan project detection', () => {
    it('should detect Conan project with conanfile.txt', async () => {
      // Create conanfile.txt
      fs.writeFileSync(
        'conanfile.txt',
        '[requires]\nboost/1.81.0\nopenssl/3.0.7\n\n[generators]\ncmake'
      )

      // Mock Conan 2.x output
      execSync.mockReturnValue(JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile' },
            '1': { ref: 'boost/1.81.0', license: 'MIT', package_folder: '/path' },
            '2': { ref: 'openssl/3.0.7', license: 'Apache-2.0', package_folder: '/path' }
          }
        }
      }))

      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true,
        })
        .mockResolvedValueOnce({
          initGit: false,
        })

      try {
        await runInit({})
      } catch (error) {
        // Expected - process.exit throws
      }

      // Verify LICENSE was created
      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(0)

      // Verify Conan 2.x command was called
      expect(execSync).toHaveBeenCalledWith(
        'conan graph info . --format=json',
        expect.objectContaining({
          encoding: 'utf8',
          timeout: 30000
        })
      )
    })

    it('should detect Conan project with conanfile.py', async () => {
      // Create conanfile.py
      fs.writeFileSync(
        'conanfile.py',
        'from conan import ConanFile\n\nclass MyConan(ConanFile):\n    requires = "boost/1.81.0"\n'
      )

      // Mock Conan 2.x output
      execSync.mockReturnValue(JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile' },
            '1': { ref: 'boost/1.81.0', license: 'MIT', package_folder: '/path' }
          }
        }
      }))

      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true,
        })
        .mockResolvedValueOnce({
          initGit: false,
        })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      expect(fs.existsSync('LICENSE')).toBe(true)
    })
  })

  describe('GPL conflict detection with Conan', () => {
    beforeEach(() => {
      // Create conanfile.txt with GPL dependency
      fs.writeFileSync(
        'conanfile.txt',
        '[requires]\nmit-lib/1.0.0\ngpl-lib/2.0.0'
      )

      // Mock Conan 2.x output with GPL package
      execSync.mockReturnValue(JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile' },
            '1': { ref: 'mit-lib/1.0.0', license: 'MIT', package_folder: '/path' },
            '2': { ref: 'gpl-lib/2.0.0', license: 'GPL-3.0', package_folder: '/path' }
          }
        }
      }))
    })

    it('should block LICENSE creation when GPL conflict detected', async () => {
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

      // LICENSE should NOT be created
      expect(fs.existsSync('LICENSE')).toBe(false)
      expect(processExitSpy).toHaveBeenCalledWith(1)

      // Check error messages
      const allErrors = consoleErrorSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allErrors).toContain('LICENSE NOT created due to license conflicts')
    })

    it('should create LICENSE with --force despite GPL conflict', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: false,
        })
        .mockResolvedValueOnce({
          initGit: false,
        })

      try {
        await runInit({ force: true })
      } catch (error) {
        // Expected
      }

      expect(fs.existsSync('LICENSE')).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })
  })

  describe('Conan error handling', () => {
    beforeEach(() => {
      // Create conanfile.txt
      fs.writeFileSync(
        'conanfile.txt',
        '[requires]\nboost/1.81.0'
      )
    })

    it('should handle Conan not installed error', async () => {
      execSync.mockImplementation(() => {
        throw new Error('conan: command not found')
      })

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
        await runInit({})
      } catch (error) {
        // Expected - process.exit throws
      }

      // Process should exit (error occurred during scanning)
      expect(processExitSpy).toHaveBeenCalled()
      // Error should be logged
      const allOutput = [
        ...consoleLogSpy.mock.calls.map((call) => call.join(' ')),
        ...consoleErrorSpy.mock.calls.map((call) => call.join(' '))
      ].join(' ')
      expect(allOutput).toContain('Error')
    })

    it('should handle Conan dependencies not installed error', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Unable to find boost/1.81.0 in local cache')
      })

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
        await runInit({})
      } catch (error) {
        // Expected - process.exit throws
      }

      // Process should exit (error occurred during scanning)
      expect(processExitSpy).toHaveBeenCalled()
      // Error should be logged
      const allOutput = [
        ...consoleLogSpy.mock.calls.map((call) => call.join(' ')),
        ...consoleErrorSpy.mock.calls.map((call) => call.join(' '))
      ].join(' ')
      expect(allOutput).toContain('Error')
    })
  })

  describe('--noscan flag with Conan', () => {
    it('should skip Conan scanning when --noscan flag is used', async () => {
      // Create conanfile.txt with GPL (would conflict)
      fs.writeFileSync(
        'conanfile.txt',
        '[requires]\ngpl-lib/3.0.0'
      )

      // Mock would return GPL (conflict) but shouldn't be called - Conan 2.x format
      execSync.mockReturnValue(JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile' },
            '1': { ref: 'gpl-lib/3.0.0', license: 'GPL-3.0', package_folder: '/path' }
          }
        }
      }))

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
        await runInit({ noscan: true })
      } catch (error) {
        // Expected
      }

      // LICENSE should be created (no scan = no block)
      expect(fs.existsSync('LICENSE')).toBe(true)

      // execSync should NOT have been called (skipped scanning)
      expect(execSync).not.toHaveBeenCalled()
    })
  })

  describe('UNKNOWN license handling', () => {
    it('should create LICENSE when UNKNOWN license found (warnings dont block)', async () => {
      fs.writeFileSync(
        'conanfile.txt',
        '[requires]\nunknown-lib/1.0.0'
      )

      // Mock Conan 2.x output with no license
      execSync.mockReturnValue(JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile' },
            '1': { ref: 'unknown-lib/1.0.0', license: null, package_folder: 'conan-cache' }
          }
        }
      }))

      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true,
        })
        .mockResolvedValueOnce({
          initGit: false,
        })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      // LICENSE should be created (warnings don't block)
      expect(fs.existsSync('LICENSE')).toBe(true)

      // Should show warning
      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).toContain('UNKNOWN')
    })
  })

  describe('Mixed compatible dependencies', () => {
    it('should display success for all compatible Conan dependencies', async () => {
      fs.writeFileSync(
        'conanfile.txt',
        '[requires]\nboost/1.81.0\nzlib/1.2.13\nopenssl/3.0.7'
      )

      // All permissive licenses - Mock Conan 2.x output
      execSync.mockReturnValue(JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile' },
            '1': { ref: 'boost/1.81.0', license: 'MIT', package_folder: '/path' },
            '2': { ref: 'zlib/1.2.13', license: 'ISC', package_folder: '/path' },
            '3': { ref: 'openssl/3.0.7', license: 'Apache-2.0', package_folder: '/path' }
          }
        }
      }))

      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true,
        })
        .mockResolvedValueOnce({
          initGit: false,
        })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      expect(fs.existsSync('LICENSE')).toBe(true)

      const allLogs = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join(' ')
      expect(allLogs).toContain('All 3 dependencies compatible')
    })
  })

  describe('Priority: Node.js over C/C++', () => {
    it('should detect Node.js when both package.json and conanfile.txt exist', async () => {
      // Create both files (Node.js should take priority)
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'express': '^4.18.0'
          }
        })
      )
      fs.writeFileSync('conanfile.txt', '[requires]\nboost/1.81.0')

      // Create node_modules
      fs.mkdirSync('node_modules/express', { recursive: true })
      fs.writeFileSync(
        'node_modules/express/package.json',
        JSON.stringify({
          name: 'express',
          version: '4.18.0',
          license: 'MIT'
        })
      )

      inquirer.prompt
        .mockResolvedValueOnce({
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        })
        .mockResolvedValueOnce({
          saveScanResult: true,
        })
        .mockResolvedValueOnce({
          initGit: false,
        })

      try {
        await runInit({})
      } catch (error) {
        // Expected
      }

      // Conan should NOT be called (Node.js takes priority)
      expect(execSync).not.toHaveBeenCalled()

      // LICENSE should be created
      expect(fs.existsSync('LICENSE')).toBe(true)
    })
  })
})
