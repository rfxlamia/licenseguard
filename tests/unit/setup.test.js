const fs = require('fs')

// Mock chalk
jest.mock('chalk', () => ({
  yellow: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
}))

// Mock git-helpers
jest.mock('../../lib/utils/git-helpers', () => ({
  isGitRepo: jest.fn(),
  installHooks: jest.fn(),
}))

const { setupCommand } = require('../../lib/commands/setup')
const { isGitRepo, installHooks } = require('../../lib/utils/git-helpers')

describe('setupCommand', () => {
  let existsSyncSpy
  let readFileSyncSpy
  let consoleLogSpy

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    if (existsSyncSpy) existsSyncSpy.mockRestore()
    if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  describe('when .licenseguardrc exists', () => {
    const mockConfig = {
      license: 'MIT',
      owner: 'TestUser',
      year: '2025',
    }

    beforeEach(() => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue(JSON.stringify(mockConfig))
    })

    it('should read and parse .licenseguardrc', async () => {
      isGitRepo.mockReturnValue(true)
      installHooks.mockReturnValue(true)

      await setupCommand()

      expect(existsSyncSpy).toHaveBeenCalledWith('.licenseguardrc')
      expect(readFileSyncSpy).toHaveBeenCalledWith('.licenseguardrc', 'utf-8')
    })

    it('should display license notification with correct format', async () => {
      isGitRepo.mockReturnValue(true)
      installHooks.mockReturnValue(true)

      await setupCommand()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📜 This project uses MIT License by TestUser')
      )
    })

    it('should uppercase the license type in notification', async () => {
      const lowercaseConfig = { license: 'apache-2.0', owner: 'dev' }
      readFileSyncSpy.mockReturnValue(JSON.stringify(lowercaseConfig))
      isGitRepo.mockReturnValue(true)
      installHooks.mockReturnValue(true)

      await setupCommand()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('APACHE-2.0')
      )
    })

    it('should call installHooks when in git repo', async () => {
      isGitRepo.mockReturnValue(true)
      installHooks.mockReturnValue(true)

      await setupCommand()

      expect(isGitRepo).toHaveBeenCalled()
      expect(installHooks).toHaveBeenCalled()
    })

    it('should skip hooks installation when not in git repo', async () => {
      isGitRepo.mockReturnValue(false)

      await setupCommand()

      expect(isGitRepo).toHaveBeenCalled()
      expect(installHooks).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping git hooks (not a git repo)')
      )
    })

    it('should not throw on successful execution', async () => {
      isGitRepo.mockReturnValue(true)
      installHooks.mockReturnValue(true)

      await expect(setupCommand()).resolves.not.toThrow()
    })
  })

  describe('when .licenseguardrc does not exist', () => {
    beforeEach(() => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
    })

    it('should display helpful message', async () => {
      await setupCommand()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'No .licenseguardrc found. Run \'licenseguard --init\' first.'
        )
      )
    })

    it('should not attempt to read config file', async () => {
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync')

      await setupCommand()

      expect(readFileSyncSpy).not.toHaveBeenCalled()
    })

    it('should not call git helpers', async () => {
      await setupCommand()

      expect(isGitRepo).not.toHaveBeenCalled()
      expect(installHooks).not.toHaveBeenCalled()
    })

    it('should exit 0 (not throw)', async () => {
      await expect(setupCommand()).resolves.not.toThrow()
    })
  })

  describe('error handling (npm prepare compatibility)', () => {
    it('should not throw when JSON parsing fails', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('invalid json')

      await expect(setupCommand()).resolves.not.toThrow()
    })

    it('should display warning on JSON parse error', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('invalid json')

      await setupCommand()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Setup warning:')
      )
    })

    it('should not throw when readFileSync fails', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('Permission denied')
      })

      await expect(setupCommand()).resolves.not.toThrow()
    })

    it('should display warning on file read error', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('Permission denied')
      })

      await setupCommand()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Setup warning: Permission denied')
      )
    })

    it('should always exit 0 even when installHooks fails', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('{"license":"MIT","owner":"test"}')
      isGitRepo.mockReturnValue(true)
      installHooks.mockImplementation(() => {
        throw new Error('Hook installation failed')
      })

      await expect(setupCommand()).resolves.not.toThrow()
    })
  })

  describe('idempotent execution', () => {
    it('should succeed on multiple consecutive calls', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('{"license":"MIT","owner":"test"}')
      isGitRepo.mockReturnValue(true)
      installHooks.mockReturnValue(true)

      // Run multiple times
      await setupCommand()
      await setupCommand()
      await setupCommand()

      // Should have been called 3 times
      expect(installHooks).toHaveBeenCalledTimes(3)
    })

    it('should display notification each time', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('{"license":"MIT","owner":"test"}')
      isGitRepo.mockReturnValue(true)
      installHooks.mockReturnValue(true)

      await setupCommand()
      await setupCommand()

      // Notification shown twice
      const notificationCalls = consoleLogSpy.mock.calls.filter((call) =>
        call[0].includes('📜')
      )
      expect(notificationCalls.length).toBe(2)
    })
  })

  describe('different license types', () => {
    beforeEach(() => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      isGitRepo.mockReturnValue(true)
      installHooks.mockReturnValue(true)
    })

    it('should handle Apache-2.0 license', async () => {
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('{"license":"Apache-2.0","owner":"Apache User"}')

      await setupCommand()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('APACHE-2.0')
      )
    })

    it('should handle GPL-3.0 license', async () => {
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('{"license":"GPL-3.0","owner":"GPL User"}')

      await setupCommand()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('GPL-3.0')
      )
    })

    it('should handle WTFPL license', async () => {
      readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('{"license":"WTFPL","owner":"Free User"}')

      await setupCommand()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WTFPL')
      )
    })
  })
})
