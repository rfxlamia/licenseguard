/**
 * Tests for C/C++ Conan ecosystem plugin
 * Target: 80%+ coverage
 */

const fs = require('fs')
const { execSync } = require('child_process')
const {
  detect,
  scanDependencies,
  parseConanfile,
  getConanPackages,
  extractConanLicense
} = require('../../lib/scanner/plugins/cpp')

// Mock child_process
jest.mock('child_process')

// Mock chalk to avoid colored output in tests
jest.mock('chalk', () => ({
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  gray: jest.fn((str) => str)
}))

describe('C/C++ Conan Plugin', () => {
  describe('detect', () => {
    let existsSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
    })

    it('should return true when conanfile.txt exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'conanfile.txt'
      })

      expect(detect()).toBe(true)
    })

    it('should return true when conanfile.py exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'conanfile.py'
      })

      expect(detect()).toBe(true)
    })

    it('should return false when no conanfile exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      expect(detect()).toBe(false)
    })
  })

  describe('parseConanfile', () => {
    let existsSyncSpy
    let readFileSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    })

    it('should parse conanfile.txt and extract dependencies', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'conanfile.txt'
      })
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '[requires]\nboost/1.81.0\nopenssl/3.0.7\n\n[generators]\ncmake'
      )

      const deps = parseConanfile()
      expect(deps).toEqual(['boost/1.81.0', 'openssl/3.0.7'])
    })

    it('should handle conanfile.txt with no dependencies', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'conanfile.txt'
      })
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '[generators]\ncmake'
      )

      const deps = parseConanfile()
      expect(deps).toEqual([])
    })

    it('should ignore comments in conanfile.txt', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'conanfile.txt'
      })
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        '[requires]\n# This is a comment\nboost/1.81.0\n# Another comment\nopenssl/3.0.7'
      )

      const deps = parseConanfile()
      expect(deps).toEqual(['boost/1.81.0', 'openssl/3.0.7'])
    })

    it('should return empty array for conanfile.py (relies on conan info)', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'conanfile.py'
      })

      const deps = parseConanfile()
      expect(deps).toEqual([])
    })
  })

  describe('getConanPackages', () => {
    afterEach(() => {
      execSync.mockReset()
    })

    it('should parse conan info output and return packages', () => {
      // Conan 2.x format
      const mockOutput = JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile', label: 'conanfile.txt' },
            '1': {
              ref: 'boost/1.81.0',
              license: 'BSL-1.0',
              package_folder: '/home/user/.conan2/p/boost/1.81.0'
            },
            '2': {
              ref: 'openssl/3.0.7',
              license: 'Apache-2.0',
              package_folder: '/home/user/.conan2/p/openssl/3.0.7'
            }
          }
        }
      })

      execSync.mockReturnValue(mockOutput)

      const packages = getConanPackages()
      expect(packages).toHaveLength(2)
      expect(packages[0].name).toBe('boost')
      expect(packages[0].version).toBe('1.81.0')
      expect(packages[0].license).toBe('BSL-1.0')
      expect(packages[1].name).toBe('openssl')
      expect(packages[1].version).toBe('3.0.7')
    })

    it('should handle packages with license as array', () => {
      // Conan 2.x format
      const mockOutput = JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile', label: 'conanfile.txt' },
            '1': {
              ref: 'zlib/1.2.13',
              license: ['Zlib'],
              package_folder: '/home/user/.conan2/p/zlib/1.2.13'
            }
          }
        }
      })

      execSync.mockReturnValue(mockOutput)

      const packages = getConanPackages()
      expect(packages[0].license).toEqual(['Zlib'])
    })

    it('should throw error when Conan not installed', () => {
      execSync.mockImplementation(() => {
        const error = new Error('conan: command not found')
        throw error
      })

      expect(() => getConanPackages()).toThrow('Conan not installed')
      expect(() => getConanPackages()).toThrow('pip install conan')
    })

    it('should throw error when Conan returns not recognized', () => {
      execSync.mockImplementation(() => {
        const error = new Error('\'conan\' is not recognized')
        throw error
      })

      expect(() => getConanPackages()).toThrow('Conan not installed')
    })

    it('should throw error when dependencies not installed', () => {
      execSync.mockImplementation(() => {
        const error = new Error('ERROR: Package not found')
        throw error
      })

      expect(() => getConanPackages()).toThrow('Conan dependencies not installed')
      expect(() => getConanPackages()).toThrow('conan install')
    })

    it('should throw generic error for other failures', () => {
      execSync.mockImplementation(() => {
        throw new Error('Network timeout')
      })

      expect(() => getConanPackages()).toThrow('Failed to get Conan package info')
      expect(() => getConanPackages()).toThrow('Network timeout')
    })
  })

  describe('extractConanLicense', () => {
    let existsSyncSpy
    let readFileSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    })

    it('should return license from package info', () => {
      const pkg = {
        name: 'boost',
        version: '1.81.0',
        license: 'BSL-1.0',
        path: '/home/user/.conan/data/boost/1.81.0'
      }

      expect(extractConanLicense(pkg)).toBe('BSL-1.0')
    })

    it('should handle license as array', () => {
      const pkg = {
        name: 'zlib',
        version: '1.2.13',
        license: ['Zlib', 'zlib-acknowledgement'],
        path: '/home/user/.conan/data/zlib/1.2.13'
      }

      expect(extractConanLicense(pkg)).toBe('Zlib')
    })

    it('should return UNKNOWN for empty license array', () => {
      const pkg = {
        name: 'test',
        version: '1.0.0',
        license: [],
        path: '/home/user/.conan/data/test/1.0.0'
      }

      expect(extractConanLicense(pkg)).toBe('UNKNOWN')
    })

    it('should extract license from conanfile.py if not in metadata', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        'class BoostConan(ConanFile):\n    name = "boost"\n    license = "BSL-1.0"\n'
      )

      const pkg = {
        name: 'boost',
        version: '1.81.0',
        license: null,
        path: '/home/user/.conan/data/boost/1.81.0'
      }

      expect(extractConanLicense(pkg)).toBe('BSL-1.0')
    })

    it('should return UNKNOWN when no license found', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      const pkg = {
        name: 'unknown-pkg',
        version: '1.0.0',
        license: null,
        path: '/home/user/.conan/data/unknown-pkg/1.0.0'
      }

      expect(extractConanLicense(pkg)).toBe('UNKNOWN')
    })

    it('should return UNKNOWN when path is conan-cache placeholder', () => {
      const pkg = {
        name: 'test',
        version: '1.0.0',
        license: null,
        path: 'conan-cache'
      }

      expect(extractConanLicense(pkg)).toBe('UNKNOWN')
    })
  })

  describe('scanDependencies', () => {
    let stdoutWriteSpy

    beforeEach(() => {
      stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
      execSync.mockReset()
    })

    afterEach(() => {
      if (stdoutWriteSpy) stdoutWriteSpy.mockRestore()
    })

    it('should handle no dependencies', () => {
      // Conan 2.x format with only root node
      execSync.mockReturnValue(JSON.stringify({
        graph: { nodes: { '0': { ref: 'conanfile', label: 'conanfile.txt' } } }
      }))

      return scanDependencies('MIT').then(result => {
        expect(result.totalDependencies).toBe(0)
        expect(result.compatible).toBe(0)
        expect(result.incompatible).toBe(0)
        expect(result.unknown).toBe(0)
        expect(result.issues).toEqual([])
      })
    })

    it('should detect all compatible dependencies', () => {
      const mockOutput = JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile', label: 'conanfile.txt' },
            '1': { ref: 'lib1/1.0.0', license: 'MIT', package_folder: '/path' },
            '2': { ref: 'lib2/2.0.0', license: 'ISC', package_folder: '/path' }
          }
        }
      })

      execSync.mockReturnValue(mockOutput)

      return scanDependencies('MIT').then(result => {
        expect(result.totalDependencies).toBe(2)
        expect(result.compatible).toBe(2)
        expect(result.incompatible).toBe(0)
        expect(result.issues).toEqual([])
      })
    })

    it('should detect GPL conflict with MIT project', () => {
      const mockOutput = JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile', label: 'conanfile.txt' },
            '1': { ref: 'mit-lib/1.0.0', license: 'MIT', package_folder: '/path' },
            '2': { ref: 'gpl-lib/2.0.0', license: 'GPL-3.0', package_folder: '/path' }
          }
        }
      })

      execSync.mockReturnValue(mockOutput)

      return scanDependencies('MIT').then(result => {
        expect(result.totalDependencies).toBe(2)
        expect(result.compatible).toBe(1)
        expect(result.incompatible).toBe(1)
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].package).toBe('gpl-lib@2.0.0')
        expect(result.issues[0].license).toBe('GPL-3.0')
        expect(result.issues[0].type).toBe('conflict')
        expect(result.issues[0].reason).toContain('Copyleft')
      })
    })

    it('should handle UNKNOWN licenses as warnings', () => {
      const mockOutput = JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile', label: 'conanfile.txt' },
            '1': { ref: 'unknown-lib/1.0.0', license: null, package_folder: 'conan-cache' }
          }
        }
      })

      execSync.mockReturnValue(mockOutput)

      return scanDependencies('MIT').then(result => {
        expect(result.totalDependencies).toBe(1)
        expect(result.unknown).toBe(1)
        expect(result.compatible).toBe(0)
        expect(result.issues).toHaveLength(1)
        expect(result.issues[0].type).toBe('warning')
        expect(result.issues[0].license).toBe('UNKNOWN')
      })
    })

    it('should include timestamp in results', () => {
      execSync.mockReturnValue(JSON.stringify({
        graph: { nodes: { '0': { ref: 'conanfile', label: 'conanfile.txt' } } }
      }))

      return scanDependencies('MIT').then(result => {
        expect(result.timestamp).toBeDefined()
        expect(new Date(result.timestamp)).toBeInstanceOf(Date)
      })
    })

    it('should call progress indicator', () => {
      const mockOutput = JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile', label: 'conanfile.txt' },
            '1': { ref: 'pkg1/1.0.0', license: 'MIT', package_folder: '/path' },
            '2': { ref: 'pkg2/2.0.0', license: 'MIT', package_folder: '/path' }
          }
        }
      })

      execSync.mockReturnValue(mockOutput)

      return scanDependencies('MIT').then(() => {
        expect(stdoutWriteSpy).toHaveBeenCalled()
        expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Scanning dependencies'))
      })
    })

    it('should handle Apache-2.0 as compatible with MIT', () => {
      const mockOutput = JSON.stringify({
        graph: {
          nodes: {
            '0': { ref: 'conanfile', label: 'conanfile.txt' },
            '1': { ref: 'apache-lib/1.0.0', license: 'Apache-2.0', package_folder: '/path' }
          }
        }
      })

      execSync.mockReturnValue(mockOutput)

      return scanDependencies('MIT').then(result => {
        expect(result.compatible).toBe(1)
        expect(result.incompatible).toBe(0)
      })
    })

    it('should throw when Conan not installed during scan', () => {
      execSync.mockImplementation(() => {
        throw new Error('conan: command not found')
      })

      return expect(scanDependencies('MIT')).rejects.toThrow('Conan not installed')
    })
  })
})
