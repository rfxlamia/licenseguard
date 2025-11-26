/**
 * Tests for Python ecosystem plugin (pip/pipenv/poetry)
 * Updated for Python native scanner approach
 * Target: 80%+ coverage
 */

const fs = require('fs')
const { execSync } = require('child_process')
const {
  detect,
  scanDependencies,
  parseRequirementsTxt,
  parsePipfile,
  parsePyprojectToml,
  getLicensesBatch,
  resetPythonCommandCache
} = require('../../lib/scanner/plugins/python')
// normalizePythonLicense moved to shared normalizer - now use normalize()
const { normalize: normalizePythonLicense } = require('../../lib/scanner/license-normalizer')

// Mock child_process
jest.mock('child_process')

// Mock chalk to avoid colored output in tests
jest.mock('chalk', () => ({
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  gray: jest.fn((str) => str)
}))

// Mock progress display
jest.mock('../../lib/scanner/progress', () => ({
  showProgress: jest.fn()
}))

const { showProgress } = require('../../lib/scanner/progress')

describe('Python Plugin', () => {
  beforeEach(() => {
    resetPythonCommandCache() // Reset cache between tests
  })

  describe('detect', () => {
    let existsSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
    })

    it('should return "poetry" when pyproject.toml exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'pyproject.toml'
      })

      expect(detect()).toBe('poetry')
    })

    it('should return "pipenv" when Pipfile exists (no pyproject.toml)', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'Pipfile'
      })

      expect(detect()).toBe('pipenv')
    })

    it('should return "pip" when requirements.txt exists (no others)', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'requirements.txt'
      })

      expect(detect()).toBe('pip')
    })

    it('should return false when no Python files exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      expect(detect()).toBe(false)
    })

    it('should prioritize poetry over pipenv when both exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'pyproject.toml' || file === 'Pipfile'
      })

      expect(detect()).toBe('poetry')
    })

    it('should prioritize pipenv over pip when both exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'Pipfile' || file === 'requirements.txt'
      })

      expect(detect()).toBe('pipenv')
    })

    it('should prioritize poetry when all three exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

      expect(detect()).toBe('poetry')
    })
  })

  describe('parseRequirementsTxt', () => {
    let existsSyncSpy, readFileSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    })

    it('should parse basic requirements.txt', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        'requests==2.31.0\nnumpy>=1.24.0\npandas~=2.0.0'
      )

      const packages = parseRequirementsTxt()

      expect(packages).toEqual(['requests', 'numpy', 'pandas'])
    })

    it('should skip comments and empty lines', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '# Comment\nrequests==2.31.0\n\nnumpy>=1.24.0\n# Another comment'
      )

      const packages = parseRequirementsTxt()

      expect(packages).toEqual(['requests', 'numpy'])
    })

    it('should handle extras syntax', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        'flask[async]>=2.0.0'
      )

      const packages = parseRequirementsTxt()

      expect(packages).toEqual(['flask'])
    })

    it('should skip git URLs and options', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '-r requirements-dev.txt\ngit+https://github.com/user/repo.git\nrequests==2.31.0\n-e .'
      )

      const packages = parseRequirementsTxt()

      expect(packages).toEqual(['requests'])
    })

    it('should return empty array when file does not exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      const packages = parseRequirementsTxt()

      expect(packages).toEqual([])
    })
  })

  describe('parsePipfile', () => {
    let existsSyncSpy, readFileSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    })

    it('should parse Pipfile [packages] section', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '[[source]]\nurl = "https://pypi.org/simple"\n\n' +
        '[packages]\nrequests = "==2.31.0"\nnumpy = ">=1.24.0"\n\n' +
        '[dev-packages]\npytest = "*"'
      )

      const packages = parsePipfile()

      expect(packages).toEqual(['requests', 'numpy'])
    })

    it('should skip dev-packages section', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '[packages]\nrequests = "==2.31.0"\n\n' +
        '[dev-packages]\npytest = "*"'
      )

      const packages = parsePipfile()

      expect(packages).toEqual(['requests'])
    })

    it('should return empty array when file does not exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      const packages = parsePipfile()

      expect(packages).toEqual([])
    })
  })

  describe('parsePyprojectToml', () => {
    let existsSyncSpy, readFileSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    })

    it('should parse [tool.poetry.dependencies] section', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '[tool.poetry]\nname = "myproject"\n\n' +
        '[tool.poetry.dependencies]\npython = "^3.9"\nrequests = "^2.31.0"\nnumpy = "^1.24.0"\n\n' +
        '[tool.poetry.dev-dependencies]\npytest = "^7.0"'
      )

      const packages = parsePyprojectToml()

      expect(packages).toEqual(['requests', 'numpy'])
    })

    it('should skip python version specification', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '[tool.poetry.dependencies]\npython = "^3.9"\nrequests = "^2.31.0"'
      )

      const packages = parsePyprojectToml()

      expect(packages).toEqual(['requests'])
    })

    it('should return empty array when file does not exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      const packages = parsePyprojectToml()

      expect(packages).toEqual([])
    })
  })

  describe('normalizePythonLicense', () => {
    it('should normalize "BSD License" to "BSD-3-Clause"', () => {
      expect(normalizePythonLicense('BSD License')).toBe('BSD-3-Clause')
    })

    it('should normalize "Apache 2.0" to "Apache-2.0"', () => {
      expect(normalizePythonLicense('Apache 2.0')).toBe('Apache-2.0')
    })

    it('should normalize "MIT License" to "MIT"', () => {
      expect(normalizePythonLicense('MIT License')).toBe('MIT')
    })

    it('should normalize "Python Software Foundation License" to "PSF-2.0"', () => {
      expect(normalizePythonLicense('Python Software Foundation License')).toBe('PSF-2.0')
    })

    it('should normalize "ISC License (ISCL)" to "ISC"', () => {
      expect(normalizePythonLicense('ISC License (ISCL)')).toBe('ISC')
    })

    it('should normalize "Mozilla Public License 2.0 (MPL 2.0)" to "MPL-2.0"', () => {
      expect(normalizePythonLicense('Mozilla Public License 2.0 (MPL 2.0)')).toBe('MPL-2.0')
    })

    it('should normalize "GNU General Public License (GPL)" to "GPL-3.0-only"', () => {
      expect(normalizePythonLicense('GNU General Public License (GPL)')).toBe('GPL-3.0-only')
    })

    it('should normalize "Other/Proprietary License" to "LicenseRef-Proprietary"', () => {
      expect(normalizePythonLicense('Other/Proprietary License')).toBe('LicenseRef-Proprietary')
    })

    it('should handle case-insensitive matching', () => {
      expect(normalizePythonLicense('bsd license')).toBe('BSD-3-Clause')
      expect(normalizePythonLicense('APACHE 2.0')).toBe('Apache-2.0')
    })

    it('should detect BSD full license text', () => {
      const bsdText = 'Redistribution and use in source and binary forms, with or without modification...'
      expect(normalizePythonLicense(bsdText)).toBe('BSD-3-Clause')
    })

    it('should return UNKNOWN for empty/none licenses', () => {
      expect(normalizePythonLicense('')).toBe('UNKNOWN')
      expect(normalizePythonLicense('none')).toBe('UNKNOWN')
      expect(normalizePythonLicense('UNKNOWN')).toBe('UNKNOWN')
    })

    it('should return as-is for already valid SPDX', () => {
      expect(normalizePythonLicense('Apache-2.0')).toBe('Apache-2.0')
      expect(normalizePythonLicense('BSD-3-Clause')).toBe('BSD-3-Clause')
    })
  })

  describe('getLicensesBatch', () => {
    let existsSyncSpy

    beforeEach(() => {
      execSync.mockReset()
      showProgress.mockReset()
      // Mock fs.existsSync to return false for venv directories by default
      // Individual tests can override this if they need to test venv detection
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
    })

    afterEach(() => {
      execSync.mockReset()
      showProgress.mockReset()
      if (existsSyncSpy) {
        existsSyncSpy.mockRestore()
      }
    })

    it('should return empty object for empty package list', () => {
      const result = getLicensesBatch([], 'pip')

      expect(result).toEqual({})
      expect(execSync).not.toHaveBeenCalled()
    })

    it('should call Python script and parse JSON output', () => {
      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0',
        numpy: 'BSD-3-Clause'
      }))

      const result = getLicensesBatch(['requests', 'numpy'], 'pip')

      expect(execSync).toHaveBeenCalled()
      expect(result).toEqual({
        requests: 'Apache-2.0',
        numpy: 'BSD-3-Clause'
      })
    })

    it('should normalize licenses from Python script output', () => {
      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      execSync.mockReturnValueOnce(JSON.stringify({
        flask: 'BSD License',
        requests: 'Apache 2.0'
      }))

      const result = getLicensesBatch(['flask', 'requests'], 'pip')

      expect(result).toEqual({
        flask: 'BSD-3-Clause',
        requests: 'Apache-2.0'
      })
    })

    it('should handle UNKNOWN licenses', () => {
      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      execSync.mockReturnValueOnce(JSON.stringify({
        somepackage: 'UNKNOWN'
      }))

      const result = getLicensesBatch(['somepackage'], 'pip')

      expect(result).toEqual({
        somepackage: 'UNKNOWN'
      })
    })

    it('should throw error when Python not installed', () => {
      // Mock execSync to throw error for all python commands (version check fails)
      execSync.mockImplementation(() => {
        const error = new Error('Command failed: python3 --version')
        error.message = 'command not found'
        throw error
      })

      expect(() => getLicensesBatch(['requests'], 'pip')).toThrow('Python not installed')
    })

    it('should mark packages as UNKNOWN on non-fatal errors', () => {
      // Mock successful python detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock non-fatal error on script execution
      execSync.mockImplementationOnce(() => {
        const error = new Error('Some error')
        error.stderr = 'Warning: package not found'
        throw error
      })

      const result = getLicensesBatch(['nonexistent'], 'pip')

      expect(result).toEqual({
        nonexistent: 'UNKNOWN'
      })
    })

    it('should throw error on fatal system errors', () => {
      // Mock successful python detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock fatal error on script execution
      execSync.mockImplementationOnce(() => {
        const error = new Error('Fatal error')
        error.stderr = 'No space left on device'
        throw error
      })

      expect(() => getLicensesBatch(['requests'], 'pip')).toThrow('Python scanner failed with system error')
    })

    it('should handle large package lists with chunking', () => {
      // Create 150 packages to test chunking (chunk size is 100)
      const packages = Array.from({ length: 150 }, (_, i) => `package${i}`)

      // Mock Python detection (called once due to caching)
      execSync.mockReturnValueOnce('Python 3.10.0')

      // Mock script executions (called twice for 2 chunks: 100 + 50 packages)
      execSync.mockImplementation(() => {
        const licenses = {}
        for (let i = 0; i < 100; i++) {
          licenses[`package${i}`] = 'MIT'
        }
        return JSON.stringify(licenses)
      })

      getLicensesBatch(packages, 'pip')

      // Should have called execSync 3 times (1 detection + 2 chunks)
      expect(execSync).toHaveBeenCalledTimes(3)
      expect(showProgress).toHaveBeenCalledWith(1, 2)
      expect(showProgress).toHaveBeenCalledWith(2, 2)
    })

    it('should handle case-insensitive package names', () => {
      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      execSync.mockReturnValueOnce(JSON.stringify({
        django: 'BSD-3-Clause'
      }))

      const result = getLicensesBatch(['Django'], 'pip')

      expect(result).toEqual({
        django: 'BSD-3-Clause'
      })
    })
  })

  describe('scanDependencies', () => {
    let existsSyncSpy, readFileSyncSpy

    beforeEach(() => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync')
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync')
      execSync.mockReset()
    })

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
      execSync.mockReset()
    })

    it('should throw error when no Python package manager detected', async () => {
      existsSyncSpy.mockReturnValue(false)

      await expect(scanDependencies('MIT')).rejects.toThrow(
        'No Python package manager detected'
      )
    })

    it('should scan requirements.txt project with MIT license', async () => {
      existsSyncSpy.mockImplementation((file) => file === 'requirements.txt')
      readFileSyncSpy.mockReturnValue('requests==2.31.0\nnumpy>=1.24.0')

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
      expect(result.incompatible).toBe(0)
      expect(result.unknown).toBe(0)
      expect(result.issues).toEqual([])
    })

    it('should detect GPL conflict with MIT project', async () => {
      existsSyncSpy.mockImplementation((file) => file === 'requirements.txt')
      readFileSyncSpy.mockReturnValue('requests==2.31.0\ngplpackage>=1.0.0')

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

    it('should mark UNKNOWN licenses as warnings', async () => {
      existsSyncSpy.mockImplementation((file) => file === 'requirements.txt')
      readFileSyncSpy.mockReturnValue('requests==2.31.0\nunknownpkg>=1.0.0')

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

    it('should scan Pipfile project', async () => {
      existsSyncSpy.mockImplementation((file) => file === 'Pipfile')
      readFileSyncSpy.mockReturnValue('[packages]\nrequests = "==2.31.0"\nnumpy = ">=1.24.0"')

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0',
        numpy: 'BSD-3-Clause'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(2)
      expect(result.compatible).toBe(2)
    })

    it('should scan pyproject.toml project', async () => {
      existsSyncSpy.mockImplementation((file) => file === 'pyproject.toml')
      readFileSyncSpy.mockReturnValue(
        '[tool.poetry.dependencies]\npython = "^3.9"\nrequests = "^2.31.0"'
      )

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

      execSync.mockReturnValueOnce(JSON.stringify({
        requests: 'Apache-2.0'
      }))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(1) // python is skipped
      expect(result.compatible).toBe(1)
    })

    it('should handle multiple dependencies with mixed licenses', async () => {
      existsSyncSpy.mockImplementation((file) => file === 'requirements.txt')
      readFileSyncSpy.mockReturnValue('requests==2.31.0\nnumpy>=1.24.0\nflask>=2.0.0')

      // Mock Python command detection (python3 --version)
      execSync.mockReturnValueOnce('Python 3.10.0')

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
  })
})
