/**
 * Tests for Rust Cargo ecosystem plugin
 * Target: 80%+ coverage
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const {
  detect,
  scanDependencies,
  getCargoMetadata,
  extractCrateLicense,
  filterDependencies,
  normalizeLicense
} = require('../../lib/scanner/plugins/rust')

// Mock child_process
jest.mock('child_process')

// Mock chalk to avoid colored output in tests
jest.mock('chalk', () => ({
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  gray: jest.fn((str) => str)
}))

// Load test fixtures
const fixturesPath = path.join(__dirname, '../fixtures/rust')
const mockMetadata = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, 'cargo-metadata-mock.json'), 'utf8')
)
const gplConflictMetadata = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, 'cargo-metadata-gpl-conflict.json'), 'utf8')
)
const unknownLicenseMetadata = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, 'cargo-metadata-unknown-license.json'), 'utf8')
)

describe('Rust Cargo Plugin', () => {
  describe('detect', () => {
    let existsSyncSpy

    afterEach(() => {
      if (existsSyncSpy) existsSyncSpy.mockRestore()
    })

    it('should return true when Cargo.toml exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'Cargo.toml'
      })

      expect(detect()).toBe(true)
    })

    it('should return false when no Cargo.toml exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      expect(detect()).toBe(false)
    })

    it('should only detect Cargo.toml, not other files', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
        return file === 'package.json' // Node.js file, not Cargo
      })

      expect(detect()).toBe(false)
    })
  })

  describe('getCargoMetadata', () => {
    afterEach(() => {
      execSync.mockReset()
    })

    it('should parse cargo metadata output and return JSON', () => {
      execSync.mockReturnValue(JSON.stringify(mockMetadata))

      const result = getCargoMetadata()
      expect(result.packages).toBeDefined()
      expect(result.packages.length).toBe(3)
      expect(result.packages[1].name).toBe('serde')
    })

    it('should throw error when Cargo not installed (command not found)', () => {
      execSync.mockImplementation(() => {
        const error = new Error('cargo: command not found')
        throw error
      })

      expect(() => getCargoMetadata()).toThrow('Cargo not installed')
      expect(() => getCargoMetadata()).toThrow('https://rustup.rs')
    })

    it('should throw error when Cargo not recognized (Windows)', () => {
      execSync.mockImplementation(() => {
        const error = new Error('\'cargo\' is not recognized')
        throw error
      })

      expect(() => getCargoMetadata()).toThrow('Cargo not installed')
    })

    it('should throw error when ENOENT (executable not found)', () => {
      execSync.mockImplementation(() => {
        const error = new Error('spawnSync cargo ENOENT')
        throw error
      })

      expect(() => getCargoMetadata()).toThrow('Cargo not installed')
    })

    it('should throw error when no Cargo.toml found', () => {
      execSync.mockImplementation(() => {
        const error = new Error('error: could not find `Cargo.toml`')
        throw error
      })

      expect(() => getCargoMetadata()).toThrow('No Cargo.toml found')
    })

    it('should throw generic error for other failures', () => {
      execSync.mockImplementation(() => {
        throw new Error('Network timeout')
      })

      expect(() => getCargoMetadata()).toThrow('Failed to get Cargo metadata')
      expect(() => getCargoMetadata()).toThrow('Network timeout')
    })
  })

  describe('extractCrateLicense', () => {
    it('should return license from package metadata', () => {
      const pkg = {
        name: 'serde',
        version: '1.0.193',
        license: 'MIT OR Apache-2.0',
        manifest_path: '/path/Cargo.toml'
      }

      expect(extractCrateLicense(pkg)).toBe('MIT OR Apache-2.0')
    })

    it('should return simple license string', () => {
      const pkg = {
        name: 'tokio',
        version: '1.35.0',
        license: 'MIT'
      }

      expect(extractCrateLicense(pkg)).toBe('MIT')
    })

    it('should return UNKNOWN when license is null', () => {
      const pkg = {
        name: 'unknown-crate',
        version: '1.0.0',
        license: null
      }

      expect(extractCrateLicense(pkg)).toBe('UNKNOWN')
    })

    it('should return UNKNOWN when license field is missing', () => {
      const pkg = {
        name: 'no-license',
        version: '1.0.0'
      }

      expect(extractCrateLicense(pkg)).toBe('UNKNOWN')
    })

    it('should return UNKNOWN when only license_file is present', () => {
      const pkg = {
        name: 'file-license',
        version: '1.0.0',
        license: null,
        license_file: '/path/to/LICENSE'
      }

      expect(extractCrateLicense(pkg)).toBe('UNKNOWN')
    })

    it('should normalize legacy slash format to SPDX OR', () => {
      const pkg = {
        name: 'legacy-crate',
        version: '1.0.0',
        license: 'MIT/Apache-2.0'
      }

      expect(extractCrateLicense(pkg)).toBe('MIT OR Apache-2.0')
    })

    it('should normalize slash format with spaces', () => {
      const pkg = {
        name: 'spaced-license',
        version: '1.0.0',
        license: 'Apache-2.0 / MIT'
      }

      expect(extractCrateLicense(pkg)).toBe('Apache-2.0 OR MIT')
    })
  })

  describe('normalizeLicense', () => {
    it('should convert MIT/Apache-2.0 to MIT OR Apache-2.0', () => {
      expect(normalizeLicense('MIT/Apache-2.0')).toBe('MIT OR Apache-2.0')
    })

    it('should convert Apache-2.0/MIT to Apache-2.0 OR MIT', () => {
      expect(normalizeLicense('Apache-2.0/MIT')).toBe('Apache-2.0 OR MIT')
    })

    it('should handle spaces around slash', () => {
      expect(normalizeLicense('Apache-2.0 / MIT')).toBe('Apache-2.0 OR MIT')
    })

    it('should not modify already valid SPDX OR expression', () => {
      expect(normalizeLicense('MIT OR Apache-2.0')).toBe('MIT OR Apache-2.0')
    })

    it('should not modify simple license', () => {
      expect(normalizeLicense('MIT')).toBe('MIT')
    })

    it('should handle null/undefined input', () => {
      expect(normalizeLicense(null)).toBe(null)
      expect(normalizeLicense(undefined)).toBe(undefined)
    })

    it('should handle triple license with slashes', () => {
      expect(normalizeLicense('MIT/Apache-2.0/BSD-3-Clause')).toBe('MIT OR Apache-2.0 OR BSD-3-Clause')
    })
  })

  describe('filterDependencies', () => {
    it('should filter out root package', () => {
      const metadata = {
        packages: [
          { name: 'root', id: 'root 0.1.0 (path)', source: null },
          { name: 'dep1', id: 'dep1 1.0.0 (registry)', source: 'registry' }
        ],
        resolve: { root: 'root 0.1.0 (path)' }
      }

      const filtered = filterDependencies(metadata)
      expect(filtered.length).toBe(1)
      expect(filtered[0].name).toBe('dep1')
    })

    it('should filter out workspace packages (path dependencies)', () => {
      const cwd = process.cwd()
      const metadata = {
        packages: [
          {
            name: 'workspace-member',
            id: 'workspace-member 0.1.0',
            source: null,
            manifest_path: `${cwd}/crates/member/Cargo.toml`
          },
          {
            name: 'external-dep',
            id: 'external-dep 1.0.0',
            source: 'registry',
            manifest_path: '/home/user/.cargo/registry/external-dep/Cargo.toml'
          }
        ],
        resolve: {}
      }

      const filtered = filterDependencies(metadata)
      expect(filtered.length).toBe(1)
      expect(filtered[0].name).toBe('external-dep')
    })

    it('should handle empty packages array', () => {
      const metadata = { packages: [], resolve: {} }
      const filtered = filterDependencies(metadata)
      expect(filtered).toEqual([])
    })

    it('should handle missing packages array', () => {
      const metadata = { resolve: {} }
      const filtered = filterDependencies(metadata)
      expect(filtered).toEqual([])
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

    it('should scan Cargo dependencies and return results', async () => {
      execSync.mockReturnValue(JSON.stringify(mockMetadata))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(2) // serde and tokio (root filtered out)
      expect(result.compatible).toBe(2)
      expect(result.incompatible).toBe(0)
      expect(result.unknown).toBe(0)
      expect(result.issues).toEqual([])
    })

    it('should handle dual-licensed crates (MIT OR Apache-2.0)', async () => {
      execSync.mockReturnValue(JSON.stringify(mockMetadata))

      const result = await scanDependencies('Apache-2.0')

      // Both serde (MIT OR Apache-2.0) and tokio (MIT) are permissive
      expect(result.compatible).toBe(2)
      expect(result.incompatible).toBe(0)
    })

    it('should detect GPL conflict with MIT project', async () => {
      execSync.mockReturnValue(JSON.stringify(gplConflictMetadata))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(2) // mit-crate and gpl-crate
      expect(result.compatible).toBe(1)
      expect(result.incompatible).toBe(1)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].package).toBe('gpl-crate@2.0.0')
      expect(result.issues[0].license).toBe('GPL-3.0')
      expect(result.issues[0].type).toBe('conflict')
      expect(result.issues[0].reason).toContain('Copyleft')
    })

    it('should handle UNKNOWN licenses as warnings', async () => {
      execSync.mockReturnValue(JSON.stringify(unknownLicenseMetadata))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(1) // unknown-crate only
      expect(result.unknown).toBe(1)
      expect(result.compatible).toBe(0)
      expect(result.incompatible).toBe(0)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].type).toBe('warning')
      expect(result.issues[0].license).toBe('UNKNOWN')
    })

    it('should include timestamp in results', async () => {
      execSync.mockReturnValue(JSON.stringify({ packages: [], resolve: {} }))

      const result = await scanDependencies('MIT')

      expect(result.timestamp).toBeDefined()
      expect(new Date(result.timestamp)).toBeInstanceOf(Date)
    })

    it('should call progress indicator during scanning', async () => {
      execSync.mockReturnValue(JSON.stringify(mockMetadata))

      await scanDependencies('MIT')

      expect(stdoutWriteSpy).toHaveBeenCalled()
      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Scanning dependencies'))
    })

    it('should handle no dependencies (empty project)', async () => {
      const emptyMetadata = {
        packages: [{ name: 'empty-project', id: 'empty-project 0.1.0', source: null }],
        resolve: { root: 'empty-project 0.1.0' }
      }
      execSync.mockReturnValue(JSON.stringify(emptyMetadata))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(0)
      expect(result.compatible).toBe(0)
      expect(result.incompatible).toBe(0)
      expect(result.issues).toEqual([])
    })

    it('should throw when Cargo not installed during scan', async () => {
      execSync.mockImplementation(() => {
        throw new Error('cargo: command not found')
      })

      await expect(scanDependencies('MIT')).rejects.toThrow('Cargo not installed')
      await expect(scanDependencies('MIT')).rejects.toThrow('https://rustup.rs')
    })

    it('should include manifest_path in issue location', async () => {
      execSync.mockReturnValue(JSON.stringify(gplConflictMetadata))

      const result = await scanDependencies('MIT')

      expect(result.issues[0].location).toContain('Cargo.toml')
    })

    it('should handle Apache-2.0 as compatible with MIT', async () => {
      const apacheMetadata = {
        packages: [
          { name: 'root', id: 'root 0.1.0', source: null },
          {
            name: 'apache-crate',
            id: 'apache-crate 1.0.0',
            version: '1.0.0',
            license: 'Apache-2.0',
            source: 'registry',
            manifest_path: '/path/Cargo.toml'
          }
        ],
        resolve: { root: 'root 0.1.0' }
      }
      execSync.mockReturnValue(JSON.stringify(apacheMetadata))

      const result = await scanDependencies('MIT')

      expect(result.compatible).toBe(1)
      expect(result.incompatible).toBe(0)
    })

    it('should handle BSD-3-Clause as compatible with MIT', async () => {
      const bsdMetadata = {
        packages: [
          { name: 'root', id: 'root 0.1.0', source: null },
          {
            name: 'bsd-crate',
            id: 'bsd-crate 1.0.0',
            version: '1.0.0',
            license: 'BSD-3-Clause',
            source: 'registry',
            manifest_path: '/path/Cargo.toml'
          }
        ],
        resolve: { root: 'root 0.1.0' }
      }
      execSync.mockReturnValue(JSON.stringify(bsdMetadata))

      const result = await scanDependencies('MIT')

      expect(result.compatible).toBe(1)
      expect(result.incompatible).toBe(0)
    })
  })
})
