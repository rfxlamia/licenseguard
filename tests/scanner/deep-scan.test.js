const fs = require('fs')
const path = require('path')
const {
  deepScan,
  parseLockfileV1,
  parseLockfileV2V3,
  detectLockfileVersion,
  extractLicenseFromPackage
} = require('../../lib/scanner/deep-scan')

describe('Deep Scan Engine', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/lockfiles')

  describe('detectLockfileVersion', () => {
    test('detects lockfile v1', () => {
      const lockfile = { lockfileVersion: 1 }
      expect(detectLockfileVersion(lockfile)).toBe(1)
    })

    test('detects lockfile v2', () => {
      const lockfile = { lockfileVersion: 2 }
      expect(detectLockfileVersion(lockfile)).toBe(2)
    })

    test('detects lockfile v3', () => {
      const lockfile = { lockfileVersion: 3 }
      expect(detectLockfileVersion(lockfile)).toBe(3)
    })

    test('defaults to v1 when lockfileVersion missing', () => {
      const lockfile = {}
      expect(detectLockfileVersion(lockfile)).toBe(1)
    })
  })

  describe('extractLicenseFromPackage', () => {
    test('extracts license field when present', () => {
      const pkg = { name: 'chalk', version: '4.1.2', license: 'MIT' }
      expect(extractLicenseFromPackage(pkg)).toBe('MIT')
    })

    test('returns UNKNOWN when license missing', () => {
      const pkg = { name: 'chalk', version: '4.1.2' }
      expect(extractLicenseFromPackage(pkg)).toBe('UNKNOWN')
    })

    test('returns UNKNOWN when license is UNKNOWN', () => {
      const pkg = { name: 'chalk', version: '4.1.2', license: 'UNKNOWN' }
      expect(extractLicenseFromPackage(pkg)).toBe('UNKNOWN')
    })
  })

  describe('parseLockfileV1', () => {
    test('parses simple flat dependencies', () => {
      const dependencies = {
        chalk: {
          version: '4.1.2',
          license: 'MIT'
        },
        commander: {
          version: '11.1.0',
          license: 'MIT'
        }
      }

      const packages = parseLockfileV1(dependencies)
      expect(packages).toHaveLength(2)
      expect(packages[0]).toEqual({
        name: 'chalk',
        version: '4.1.2',
        license: 'MIT'
      })
      expect(packages[1]).toEqual({
        name: 'commander',
        version: '11.1.0',
        license: 'MIT'
      })
    })

    test('recursively flattens nested dependencies', () => {
      const dependencies = {
        chalk: {
          version: '4.1.2',
          license: 'MIT',
          dependencies: {
            'ansi-styles': {
              version: '4.3.0',
              license: 'MIT',
              dependencies: {
                'color-convert': {
                  version: '2.0.1',
                  license: 'MIT'
                }
              }
            }
          }
        }
      }

      const packages = parseLockfileV1(dependencies)
      expect(packages).toHaveLength(3)
      expect(packages[0].name).toBe('chalk')
      expect(packages[1].name).toBe('ansi-styles')
      expect(packages[2].name).toBe('color-convert')
    })

    test('handles empty dependencies object', () => {
      const packages = parseLockfileV1({})
      expect(packages).toHaveLength(0)
    })

    test('handles package without nested dependencies', () => {
      const dependencies = {
        chalk: {
          version: '4.1.2',
          license: 'MIT'
        }
      }

      const packages = parseLockfileV1(dependencies)
      expect(packages).toHaveLength(1)
      expect(packages[0].name).toBe('chalk')
    })
  })

  describe('parseLockfileV2V3', () => {
    test('filters and extracts node_modules/ packages', () => {
      const packages = {
        '': {
          name: 'test-project',
          version: '1.0.0'
        },
        'node_modules/chalk': {
          version: '4.1.2',
          license: 'MIT'
        },
        'node_modules/commander': {
          version: '11.1.0',
          license: 'MIT'
        }
      }

      const result = parseLockfileV2V3(packages)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'chalk',
        version: '4.1.2',
        license: 'MIT'
      })
      expect(result[1]).toEqual({
        name: 'commander',
        version: '11.1.0',
        license: 'MIT'
      })
    })

    test('skips root package (empty key)', () => {
      const packages = {
        '': {
          name: 'test-project',
          version: '1.0.0'
        },
        'node_modules/chalk': {
          version: '4.1.2',
          license: 'MIT'
        }
      }

      const result = parseLockfileV2V3(packages)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('chalk')
    })

    test('handles scoped packages correctly', () => {
      const packages = {
        'node_modules/@babel/core': {
          version: '7.22.0',
          license: 'MIT'
        }
      }

      const result = parseLockfileV2V3(packages)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('@babel/core')
    })

    test('handles nested node_modules/ paths', () => {
      const packages = {
        'node_modules/chalk/node_modules/ansi-styles': {
          version: '3.0.0',
          license: 'MIT'
        }
      }

      const result = parseLockfileV2V3(packages)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ansi-styles')
    })

    test('handles empty packages object', () => {
      const result = parseLockfileV2V3({})
      expect(result).toHaveLength(0)
    })
  })

  describe('deepScan integration', () => {
    test('parses lockfile v1 from fixture', async () => {
      const projectRoot = fixturesDir
      const mockFlatScan = jest.fn()

      // Temporarily rename v1 fixture to package-lock.json
      const v1Path = path.join(fixturesDir, 'package-lock-v1.json')
      const lockfilePath = path.join(fixturesDir, 'package-lock.json')
      fs.copyFileSync(v1Path, lockfilePath)

      try {
        const result = await deepScan(projectRoot, mockFlatScan)

        expect(mockFlatScan).not.toHaveBeenCalled()
        expect(result.packages.length).toBeGreaterThan(0)

        // Verify chalk is present (nested in v1)
        const chalk = result.packages.find(p => p.name === 'chalk')
        expect(chalk).toBeDefined()
        expect(chalk.version).toBe('4.1.2')
        expect(chalk.license).toBe('MIT')

        // Verify nested deps are flattened
        const colorConvert = result.packages.find(p => p.name === 'color-convert')
        expect(colorConvert).toBeDefined()
      } finally {
        fs.unlinkSync(lockfilePath)
      }
    })

    test('parses lockfile v2 from fixture', async () => {
      const projectRoot = fixturesDir
      const mockFlatScan = jest.fn()

      const v2Path = path.join(fixturesDir, 'package-lock-v2.json')
      const lockfilePath = path.join(fixturesDir, 'package-lock.json')
      fs.copyFileSync(v2Path, lockfilePath)

      try {
        const result = await deepScan(projectRoot, mockFlatScan)

        expect(mockFlatScan).not.toHaveBeenCalled()
        expect(result.packages.length).toBeGreaterThan(0)

        const chalk = result.packages.find(p => p.name === 'chalk')
        expect(chalk).toBeDefined()
        expect(chalk.version).toBe('4.1.2')
        expect(chalk.license).toBe('MIT')
      } finally {
        fs.unlinkSync(lockfilePath)
      }
    })

    test('parses lockfile v3 from fixture', async () => {
      const projectRoot = fixturesDir
      const mockFlatScan = jest.fn()

      const v3Path = path.join(fixturesDir, 'package-lock-v3.json')
      const lockfilePath = path.join(fixturesDir, 'package-lock.json')
      fs.copyFileSync(v3Path, lockfilePath)

      try {
        const result = await deepScan(projectRoot, mockFlatScan)

        expect(mockFlatScan).not.toHaveBeenCalled()
        expect(result.packages.length).toBeGreaterThan(0)

        const chalk = result.packages.find(p => p.name === 'chalk')
        expect(chalk).toBeDefined()
        expect(chalk.version).toBe('4.1.2')
        expect(chalk.license).toBe('MIT')
      } finally {
        fs.unlinkSync(lockfilePath)
      }
    })

    test('falls back to flat scan when lockfile missing', async () => {
      const projectRoot = fixturesDir
      const mockFlatScan = jest.fn().mockResolvedValue({
        packages: [],
        unknownCount: 0
      })

      // Ensure no package-lock.json exists
      const lockfilePath = path.join(fixturesDir, 'package-lock.json')
      if (fs.existsSync(lockfilePath)) {
        fs.unlinkSync(lockfilePath)
      }

      const result = await deepScan(projectRoot, mockFlatScan)

      expect(mockFlatScan).toHaveBeenCalledWith(projectRoot)
      expect(result).toEqual({
        packages: [],
        unknownCount: 0
      })
    })

    test('falls back to flat scan when lockfile corrupt', async () => {
      const projectRoot = fixturesDir
      const mockFlatScan = jest.fn().mockResolvedValue({
        packages: [],
        unknownCount: 0
      })

      const corruptPath = path.join(fixturesDir, 'package-lock-corrupt.json')
      const lockfilePath = path.join(fixturesDir, 'package-lock.json')
      fs.copyFileSync(corruptPath, lockfilePath)

      try {
        const result = await deepScan(projectRoot, mockFlatScan)

        expect(mockFlatScan).toHaveBeenCalledWith(projectRoot)
        expect(result).toEqual({
          packages: [],
          unknownCount: 0
        })
      } finally {
        fs.unlinkSync(lockfilePath)
      }
    })

    test('calculates unknownCount correctly', async () => {
      const projectRoot = fixturesDir
      const mockFlatScan = jest.fn()

      // Create a test lockfile with mixed licenses
      const testLockfile = {
        lockfileVersion: 2,
        packages: {
          'node_modules/chalk': {
            version: '4.1.2',
            license: 'MIT'
          },
          'node_modules/unknown-lib': {
            version: '1.0.0'
            // No license field - should be UNKNOWN
          }
        }
      }

      const lockfilePath = path.join(fixturesDir, 'package-lock.json')
      fs.writeFileSync(lockfilePath, JSON.stringify(testLockfile, null, 2))

      try {
        const result = await deepScan(projectRoot, mockFlatScan)

        expect(result.packages).toHaveLength(2)
        expect(result.unknownCount).toBe(1)

        const unknownPkg = result.packages.find(p => p.name === 'unknown-lib')
        expect(unknownPkg.license).toBe('UNKNOWN')
      } finally {
        fs.unlinkSync(lockfilePath)
      }
    })
  })
})
