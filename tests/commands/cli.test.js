const { Command } = require('commander')

jest.mock('../../lib/commands/init', () => ({ runInit: jest.fn() }))
jest.mock('../../lib/commands/init-fast', () => ({ runInitFast: jest.fn() }))
jest.mock('../../lib/commands/scan', () => ({ runScan: jest.fn() }))
jest.mock('../../lib/commands/list', () => ({ runList: jest.fn() }))
jest.mock('../../lib/commands/setup', () => ({ setupCommand: jest.fn() }))
jest.mock('../../lib/utils/update-notifier', () => ({ checkForUpdates: jest.fn() }))

const { runInit } = require('../../lib/commands/init')
const { runInitFast } = require('../../lib/commands/init-fast')
const { runScan } = require('../../lib/commands/scan')
const { runList } = require('../../lib/commands/list')
const { setupCommand } = require('../../lib/commands/setup')
const { checkForUpdates } = require('../../lib/utils/update-notifier')

describe('CLI command dispatch', () => {
  let program
  let errorSpy
  let exitSpy

  beforeEach(() => {
    jest.resetAllMocks()
    checkForUpdates.mockResolvedValue(undefined)
    program = new Command()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    program.exitOverride()
    jest.doMock('commander', () => ({ program }))
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.dontMock('commander')
  })

  async function run(args) {
    jest.replaceProperty(process, 'argv', [process.execPath, 'licenseguard', ...args])
    jest.isolateModules(() => require('../../bin/licenseguard'))
    // program.parse starts async actions; flush their completion and error handlers.
    await new Promise(resolve => setImmediate(resolve))
  }

  test('interactive init forwards flags to the init handler', async () => {
    await run(['init', '--force', '--noscan', '--explain'])
    expect(runInit).toHaveBeenCalledWith({ force: true, noscan: true, explain: true })
    expect(runInitFast).not.toHaveBeenCalled()
  })

  test('fast init forwards license and owner to the fast handler', async () => {
    await run(['init', '--fast', '--license', 'MIT', '--owner', 'Fixture'])
    expect(runInitFast).toHaveBeenCalledWith({ fast: true, license: 'MIT', owner: 'Fixture' })
    expect(runInit).not.toHaveBeenCalled()
  })

  test('scan forwards policy and output options', async () => {
    await run(['scan', '--license', 'ISC', '--allow', '--fail-on-unknown', '--explain', '--format', 'html', '--cwd', 'fixture'])
    expect(runScan).toHaveBeenCalledWith({ license: 'ISC', allow: true, failOnUnknown: true, explain: true, format: 'html', cwd: 'fixture' })
  })

  test('ls invokes the license list handler', async () => {
    await run(['ls'])
    expect(runList).toHaveBeenCalledTimes(1)
  })

  test('setup invokes the setup handler', async () => {
    await run(['setup'])
    expect(setupCommand).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['init', runInit],
    ['scan', runScan],
    ['ls', runList],
  ])('%s command failures report an error and exit nonzero', async (command, handler) => {
    handler.mockRejectedValue(new Error('fixture failure'))
    await run([command])
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'fixture failure')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('setup failure warns without failing npm prepare', async () => {
    setupCommand.mockRejectedValue(new Error('fixture failure'))
    await run(['setup'])
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Setup warning:'), 'fixture failure')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  test('update check failure does not block a command', async () => {
    checkForUpdates.mockRejectedValue(new Error('offline'))
    await run(['scan'])
    expect(runScan).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  test('no command displays help', async () => {
    await expect(run([])).rejects.toMatchObject({ code: 'commander.help', exitCode: 1 })
  })
})
