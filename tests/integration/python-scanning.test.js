/**
 * Integration tests for Python scanning (pip/pipenv/poetry)
 * Tests the full Python scanning flow with mocked Python script
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// Must mock child_process at module level for python.js to use the mock
jest.mock('child_process')
const { execSync } = require('child_process')

// Mock chalk
jest.mock('chalk', () => ({
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  gray: jest.fn((str) => str)
}))

// Mock progress
jest.mock('../../lib/scanner/progress', () => ({
  showProgress: jest.fn()
}))

// Import scanner components
const { detect, scanDependencies, resetPythonCommandCache } = require('../../lib/scanner/plugins/python')

describe('Python Scanning Integration', () => {
  let testDir
  let originalCwd

  beforeEach(() => {
    // Create a temp directory for test projects
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-python-test-'))
    originalCwd = process.cwd()
    execSync.mockReset()
    resetPythonCommandCache() // Reset cache between tests
  })

  afterEach(() => {
    // Restore original directory
    process.chdir(originalCwd)

    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Python project detection', () => {
    it('should detect requirements.txt as Python pip project', () => {
      // Create requirements.txt in test directory
      const reqPath = path.join(testDir, 'requirements.txt')
      fs.writeFileSync(reqPath, 'requests==2.31.0\nnumpy>=1.24.0')

      // Change to test directory
      process.chdir(testDir)

      // Test detection
      expect(detect()).toBe('pip')
    })

    it('should detect Pipfile as Python pipenv project', () => {
      const pipfilePath = path.join(testDir, 'Pipfile')
      fs.writeFileSync(pipfilePath, '[packages]\nrequests = "==2.31.0"')

      process.chdir(testDir)

      expect(detect()).toBe('pipenv')
    })

    it('should detect pyproject.toml as Python poetry project', () => {
      const pyprojectPath = path.join(testDir, 'pyproject.toml')
      fs.writeFileSync(pyprojectPath, '[tool.poetry.dependencies]\nrequests = "^2.31.0"')

      process.chdir(testDir)

      expect(detect()).toBe('poetry')
    })

    it('should not detect Python project without manifest files', () => {
      // Create only package.json (Node.js project)
      const packagePath = path.join(testDir, 'package.json')
      fs.writeFileSync(packagePath, JSON.stringify({
        name: 'not-python',
        version: '1.0.0'
      }))

      process.chdir(testDir)

      expect(detect()).toBe(false)
    })

    it('should prioritize poetry over pipenv', () => {
      // Create both pyproject.toml and Pipfile
      fs.writeFileSync(path.join(testDir, 'pyproject.toml'), '[tool.poetry.dependencies]\nrequests = "^2.31.0"')
      fs.writeFileSync(path.join(testDir, 'Pipfile'), '[packages]\nrequests = "==2.31.0"')

      process.chdir(testDir)

      expect(detect()).toBe('poetry')
    })

    it('should prioritize pipenv over pip', () => {
      // Create both Pipfile and requirements.txt
      fs.writeFileSync(path.join(testDir, 'Pipfile'), '[packages]\nrequests = "==2.31.0"')
      fs.writeFileSync(path.join(testDir, 'requirements.txt'), 'requests==2.31.0')

      process.chdir(testDir)

      expect(detect()).toBe('pipenv')
    })
  })

  describe('Full scanning flow (with mocked Python script)', () => {
    it('should scan requirements.txt project', async () => {
      // Create requirements.txt
      const reqPath = path.join(testDir, 'requirements.txt')
      fs.writeFileSync(reqPath, 'requests==2.31.0\nnumpy>=1.24.0')

      process.chdir(testDir)

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock Python script output (JSON)
      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0',
        numpy: 'BSD-3-Clause'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(2)
      expect(result.compatible).toBe(2)
    })

    it('should scan Pipfile project', async () => {
      const pipfilePath = path.join(testDir, 'Pipfile')
      fs.writeFileSync(pipfilePath, '[packages]\nrequests = "==2.31.0"\nnumpy = ">=1.24.0"')

      process.chdir(testDir)

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock Python script output
      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0',
        numpy: 'BSD-3-Clause'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(2)
      expect(result.compatible).toBe(2)
    })

    it('should scan pyproject.toml project', async () => {
      const pyprojectPath = path.join(testDir, 'pyproject.toml')
      fs.writeFileSync(pyprojectPath,
        '[tool.poetry.dependencies]\npython = "^3.9"\nrequests = "^2.31.0"'
      )

      process.chdir(testDir)

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock Python script output (only requests, python is skipped)
      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(1) // python is skipped
      expect(result.compatible).toBe(1)
    })

    it('should handle multiple dependencies with mixed licenses', async () => {
      const reqPath = path.join(testDir, 'requirements.txt')
      fs.writeFileSync(reqPath, 'requests==2.31.0\nnumpy>=1.24.0\nflask>=2.0.0')

      process.chdir(testDir)

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock Python script output
      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0',
        numpy: 'BSD-3-Clause',
        flask: 'BSD-3-Clause'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(3)
      expect(result.compatible).toBe(3)
      expect(result.incompatible).toBe(0)
    })

    it('should detect GPL conflicts', async () => {
      const reqPath = path.join(testDir, 'requirements.txt')
      fs.writeFileSync(reqPath, 'requests==2.31.0\ngplpackage>=1.0.0')

      process.chdir(testDir)

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock Python script output
      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0',
        gplpackage: 'GPL-3.0-only'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(2)
      expect(result.compatible).toBe(1)
      expect(result.incompatible).toBe(1)
      expect(result.issues.length).toBe(1)
      expect(result.issues[0].package).toBe('gplpackage')
      expect(result.issues[0].type).toBe('conflict')
    })

    it('should handle UNKNOWN licenses as warnings', async () => {
      const reqPath = path.join(testDir, 'requirements.txt')
      fs.writeFileSync(reqPath, 'requests==2.31.0\nunknownpkg>=1.0.0')

      process.chdir(testDir)

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock Python script output
      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0',
        unknownpkg: 'UNKNOWN'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(2)
      expect(result.compatible).toBe(1)
      expect(result.unknown).toBe(1)
      expect(result.issues.length).toBe(1)
      expect(result.issues[0].type).toBe('warning')
    })

    it('should handle license normalization', async () => {
      const reqPath = path.join(testDir, 'requirements.txt')
      fs.writeFileSync(reqPath, 'flask==2.0.0')

      process.chdir(testDir)

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock Python script returning non-normalized license
      execSync.mockReturnValueOnce(JSON.stringify({
        flask: 'BSD License'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(1)
      expect(result.compatible).toBe(1)
      // License should be normalized to BSD-3-Clause internally
    })

    it('should handle empty requirements.txt', async () => {
      const reqPath = path.join(testDir, 'requirements.txt')
      fs.writeFileSync(reqPath, '# Just comments\n\n')

      process.chdir(testDir)

      // No packages to scan, so getLicensesBatch won't be called
      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(0)
      expect(result.compatible).toBe(0)
    })

    it('should skip comments and options in requirements.txt', async () => {
      const reqPath = path.join(testDir, 'requirements.txt')
      fs.writeFileSync(reqPath,
        '# Comment\nrequests==2.31.0\n-r dev-requirements.txt\ngit+https://github.com/user/repo.git\n-e .'
      )

      process.chdir(testDir)

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Only requests should be scanned
      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(1)
      expect(result.compatible).toBe(1)
    })
  })
})
