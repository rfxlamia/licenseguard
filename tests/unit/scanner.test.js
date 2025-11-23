/**
 * Tests for dependency scanner
 * Target: 90%+ coverage
 */

const fs = require('fs')
const path = require('path')
const {
  scanDependencies,
  parsePackageJson,
  extractLicense,
  displayConflictReport,
  detectPlugin
} = require('../../lib/scanner')

// Mock chalk to avoid colored output in tests
jest.mock('chalk', () => ({
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  gray: jest.fn((str) => str)
}))

describe('parsePackageJson', () => {
  let readFileSyncSpy

  afterEach(() => {
    if (readFileSyncSpy) readFileSyncSpy.mockRestore()
  })

  it('should parse package.json and extract dependencies', () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      name: 'test-project',
      dependencies: {
        'express': '^4.18.0',
        'lodash': '^4.17.21'
      }
    }))

    const result = parsePackageJson()
    expect(result.deps).toEqual(['express', 'lodash'])
    expect(result.packageJson.name).toBe('test-project')
  })

  it('should handle package.json with no dependencies', () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      name: 'test-project'
    }))

    const result = parsePackageJson()
    expect(result.deps).toEqual([])
  })

  it('should throw error if package.json not found', () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    expect(() => parsePackageJson()).toThrow('Failed to read package.json')
  })

  it('should throw error if package.json is malformed', () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('not valid json')

    expect(() => parsePackageJson()).toThrow('Failed to read package.json')
  })
})

describe('extractLicense', () => {
  let existsSyncSpy
  let readFileSyncSpy

  afterEach(() => {
    if (existsSyncSpy) existsSyncSpy.mockRestore()
    if (readFileSyncSpy) readFileSyncSpy.mockRestore()
  })

  it('should extract license from dependency package.json', () => {
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      name: 'express',
      version: '4.18.2',
      license: 'MIT'
    }))

    const result = extractLicense('express')
    expect(result.name).toBe('express')
    expect(result.version).toBe('4.18.2')
    expect(result.license).toBe('MIT')
    expect(result.path).toBe(path.join('node_modules', 'express', 'package.json'))
  })

  it('should handle missing license field as UNKNOWN', () => {
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      name: 'no-license',
      version: '1.0.0'
    }))

    const result = extractLicense('no-license')
    expect(result.license).toBe('UNKNOWN')
  })

  it('should handle missing version field', () => {
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      name: 'no-version',
      license: 'MIT'
    }))

    const result = extractLicense('no-version')
    expect(result.version).toBe('unknown')
    expect(result.license).toBe('MIT')
  })

  it('should handle dependency not installed', () => {
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

    const result = extractLicense('missing-package')
    expect(result.license).toBe('NOT_INSTALLED')
    expect(result.version).toBe('unknown')
  })

  it('should handle malformed package.json', () => {
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('not valid json')

    const result = extractLicense('bad-json')
    expect(result.license).toBe('PARSE_ERROR')
  })
})

describe('scanDependencies', () => {
  let readFileSyncSpy
  let existsSyncSpy
  let stdoutWriteSpy

  beforeEach(() => {
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
  })

  afterEach(() => {
    if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    if (existsSyncSpy) existsSyncSpy.mockRestore()
    if (stdoutWriteSpy) stdoutWriteSpy.mockRestore()
  })

  it('should handle no dependencies', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      name: 'test',
      dependencies: {}
    }))

    const result = await scanDependencies('MIT')
    expect(result.totalDependencies).toBe(0)
    expect(result.compatible).toBe(0)
    expect(result.incompatible).toBe(0)
    expect(result.unknown).toBe(0)
    expect(result.issues).toEqual([])
  })

  it('should detect all compatible dependencies', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path === 'package.json') {
        return JSON.stringify({
          dependencies: {
            'mit-package': '^1.0.0',
            'isc-package': '^2.0.0'
          }
        })
      }
      if (path.includes('mit-package')) {
        return JSON.stringify({ name: 'mit-package', version: '1.0.0', license: 'MIT' })
      }
      if (path.includes('isc-package')) {
        return JSON.stringify({ name: 'isc-package', version: '2.0.0', license: 'ISC' })
      }
    })
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

    const result = await scanDependencies('MIT')
    expect(result.totalDependencies).toBe(2)
    expect(result.compatible).toBe(2)
    expect(result.incompatible).toBe(0)
    expect(result.issues).toEqual([])
  })

  it('should detect GPL conflict with MIT project', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path === 'package.json') {
        return JSON.stringify({
          dependencies: {
            'mit-package': '^1.0.0',
            'gpl-package': '^2.0.0'
          }
        })
      }
      if (path.includes('mit-package')) {
        return JSON.stringify({ name: 'mit-package', version: '1.0.0', license: 'MIT' })
      }
      if (path.includes('gpl-package')) {
        return JSON.stringify({ name: 'gpl-package', version: '2.0.0', license: 'GPL-3.0' })
      }
    })
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

    const result = await scanDependencies('MIT')
    expect(result.totalDependencies).toBe(2)
    expect(result.compatible).toBe(1)
    expect(result.incompatible).toBe(1)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].package).toBe('gpl-package@2.0.0')
    expect(result.issues[0].license).toBe('GPL-3.0')
    expect(result.issues[0].type).toBe('conflict')
    expect(result.issues[0].reason).toContain('Copyleft')
  })

  it('should handle UNKNOWN licenses as warnings', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path === 'package.json') {
        return JSON.stringify({
          dependencies: {
            'no-license': '^1.0.0'
          }
        })
      }
      if (path.includes('no-license')) {
        return JSON.stringify({ name: 'no-license', version: '1.0.0' })
      }
    })
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

    const result = await scanDependencies('MIT')
    expect(result.totalDependencies).toBe(1)
    expect(result.unknown).toBe(1)
    expect(result.compatible).toBe(0)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].type).toBe('warning')
    expect(result.issues[0].license).toBe('UNKNOWN')
  })

  it('should skip dependencies not installed', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path === 'package.json') {
        return JSON.stringify({
          dependencies: {
            'installed': '^1.0.0',
            'not-installed': '^2.0.0'
          }
        })
      }
      if (path.includes('installed')) {
        return JSON.stringify({ name: 'installed', version: '1.0.0', license: 'MIT' })
      }
    })
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      // Return true for package.json (detect()) and installed packages
      if (path === 'package.json') return true
      return path.includes('installed') && !path.includes('not-installed')
    })

    const result = await scanDependencies('MIT')
    expect(result.totalDependencies).toBe(2)
    expect(result.compatible).toBe(1)
  })

  it('should handle parse errors as unknown', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path === 'package.json') {
        return JSON.stringify({
          dependencies: {
            'bad-json': '^1.0.0'
          }
        })
      }
      return 'not valid json'
    })
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

    const result = await scanDependencies('MIT')
    expect(result.unknown).toBe(1)
    expect(result.issues[0].type).toBe('warning')
    expect(result.issues[0].reason).toBe('Failed to parse package.json')
  })

  it('should handle WTFPL as compatible', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path === 'package.json') {
        return JSON.stringify({
          dependencies: {
            'wtfpl-package': '^1.0.0'
          }
        })
      }
      return JSON.stringify({ name: 'wtfpl-package', version: '1.0.0', license: 'WTFPL' })
    })
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

    const result = await scanDependencies('MIT')
    expect(result.compatible).toBe(1)
    expect(result.incompatible).toBe(0)
    expect(result.issues).toEqual([])
  })

  it('should include timestamp in results', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      dependencies: {}
    }))

    const result = await scanDependencies('MIT')
    expect(result.timestamp).toBeDefined()
    expect(new Date(result.timestamp)).toBeInstanceOf(Date)
  })

  it('should call progress indicator', async () => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path === 'package.json') {
        return JSON.stringify({
          dependencies: {
            'package1': '^1.0.0',
            'package2': '^2.0.0'
          }
        })
      }
      return JSON.stringify({ name: 'package', version: '1.0.0', license: 'MIT' })
    })
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

    await scanDependencies('MIT')
    expect(stdoutWriteSpy).toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Scanning dependencies'))
  })
})

describe('displayConflictReport', () => {
  let consoleLogSpy

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('should display success message for clean scan', () => {
    const scanResult = {
      totalDependencies: 10,
      compatible: 10,
      incompatible: 0,
      unknown: 0,
      issues: []
    }

    const hasConflicts = displayConflictReport(scanResult, 'MIT')
    expect(hasConflicts).toBe(false)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅')
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('All 10 dependencies compatible')
    )
  })

  it('should display conflicts with red color', () => {
    const scanResult = {
      totalDependencies: 2,
      compatible: 1,
      incompatible: 1,
      unknown: 0,
      issues: [
        {
          package: 'gpl-package@2.0.0',
          license: 'GPL-3.0',
          type: 'conflict',
          reason: 'Copyleft incompatible with MIT',
          location: path.join('node_modules', 'gpl-package', 'package.json')
        }
      ]
    }

    const hasConflicts = displayConflictReport(scanResult, 'MIT')
    expect(hasConflicts).toBe(true)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌')
    )
  })

  it('should display warnings with yellow color', () => {
    const scanResult = {
      totalDependencies: 1,
      compatible: 0,
      incompatible: 0,
      unknown: 1,
      issues: [
        {
          package: 'unknown-package@1.0.0',
          license: 'UNKNOWN',
          type: 'warning',
          reason: 'No license field found',
          location: path.join('node_modules', 'unknown-package', 'package.json')
        }
      ]
    }

    const hasConflicts = displayConflictReport(scanResult, 'MIT')
    expect(hasConflicts).toBe(false) // Warnings should not block (no conflicts)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('⚠️')
    )
  })

  it('should display both conflicts and warnings', () => {
    const scanResult = {
      totalDependencies: 2,
      compatible: 0,
      incompatible: 1,
      unknown: 1,
      issues: [
        {
          package: 'gpl-package@2.0.0',
          license: 'GPL-3.0',
          type: 'conflict',
          reason: 'Copyleft incompatible',
          location: path.join('node_modules', 'gpl-package', 'package.json')
        },
        {
          package: 'unknown-package@1.0.0',
          license: 'UNKNOWN',
          type: 'warning',
          reason: 'No license field',
          location: path.join('node_modules', 'unknown-package', 'package.json')
        }
      ]
    }

    const hasConflicts = displayConflictReport(scanResult, 'MIT')
    expect(hasConflicts).toBe(true)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('2 issue(s) found')
    )
  })
})

describe('Scanner Orchestrator', () => {
  describe('detectPlugin', () => {
    let existsSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
    })

    it('should detect Node.js plugin when package.json exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

      const result = detectPlugin()
      expect(result).not.toBeNull()
      expect(result.name).toBe('node')
      expect(result.plugin).toBeDefined()
      expect(typeof result.plugin.detect).toBe('function')
      expect(typeof result.plugin.scanDependencies).toBe('function')
    })

    it('should return null when no plugin detected', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      const result = detectPlugin()
      expect(result).toBeNull()
    })
  })

  describe('scanDependencies orchestration', () => {
    let existsSyncSpy
    let readFileSyncSpy
    let stdoutWriteSpy

    beforeEach(() => {
      stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
    })

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
      if (stdoutWriteSpy) stdoutWriteSpy.mockRestore()
    })

    it('should throw error when no plugin detected', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      await expect(scanDependencies('MIT')).rejects.toThrow('No supported package manager detected')
    })

    it('should delegate to Node.js plugin when package.json exists', async () => {
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        name: 'test',
        dependencies: {}
      }))
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

      const result = await scanDependencies('MIT')
      expect(result.totalDependencies).toBe(0)
      expect(result.timestamp).toBeDefined()
    })
  })

  describe('backward compatibility', () => {
    it('should export parsePackageJson from node plugin', () => {
      expect(typeof parsePackageJson).toBe('function')
    })

    it('should export extractLicense from node plugin', () => {
      expect(typeof extractLicense).toBe('function')
    })

    it('should export displayConflictReport', () => {
      expect(typeof displayConflictReport).toBe('function')
    })

    it('should export scanDependencies', () => {
      expect(typeof scanDependencies).toBe('function')
    })

    it('should export detectPlugin for testing', () => {
      expect(typeof detectPlugin).toBe('function')
    })
  })
})
