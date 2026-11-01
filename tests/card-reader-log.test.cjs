const assert = require('node:assert/strict')
const test = require('node:test')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const source = name => readFileSync(resolve(__dirname, '../src', name), 'utf8')
const constants = moduleUrl(source('constants.js'))
const serial = moduleUrl(source('modules/serialCommunicator.js'))
const protocol = moduleUrl(source('modules/cardIOProtocol.js').replace("'../constants'", JSON.stringify(constants)))
const controller = moduleUrl(source('modules/cardReaderTest.js')
  .replace("'../constants'", JSON.stringify(constants))
  .replace("'./serialCommunicator'", JSON.stringify(serial))
  .replace("'./cardIOProtocol'", JSON.stringify(protocol)))
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(' ')
const reply = (payload, corrupt = false, command = 0x42) => {
  const raw = [6 + payload.length, 0, 1, command, 0, payload.length, ...payload]
  const checksum = raw.reduce((sum, byte) => sum + byte, 0) & 255
  raw.push(corrupt ? checksum ^ 255 : checksum)
  return [0xe0, ...raw.flatMap(byte => byte === 0xe0 || byte === 0xd0 ? [0xd0, byte - 1] : [byte])]
}

test('reader logs actual serial bytes without accepting checksum failures', async t => {
  const { createCardReaderTestController } = await import(controller)
  const elements = Object.fromEntries([
    'connectBtn', 'disconnectBtn', 'connectionStatus', 'deviceStatus', 'getFWVersionBtn',
    'getHWVersionBtn', 'getBoardInfoBtn', 'startPollingBtn', 'stopPollingBtn', 'cardDetectBtn',
    'setLEDBtn', 'ledColorPicker', 'operationStatus', 'logBox', 'cardTypeDisplay',
    'cardUidDisplay', 'pollingStatus',
  ].map(name => [name, { textContent: '-', innerHTML: '', addEventListener(event, action) { this[event] = action } }]))
  const logs = [], statuses = []
  let input
  const port = {
    async open() {
      this.readable = new ReadableStream({ start(controller) { input = controller } })
      this.writable = new WritableStream({ write() {} })
    },
    async close() {},
    getInfo: () => ({ usbVendorId: 0x0ca3, usbProductId: 0x0021 }),
  }
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serial: { requestPort: async () => port } } })
  const reader = createCardReaderTestController({ elements,
    showStatus(message, type, element) { statuses.push({ message, type }); element.textContent = message },
    showCardReaderLog: message => logs.push(message), renderList() {},
  })
  reader.bindEvents()
  await elements.connectBtn.click()
  t.after(async () => {
    await reader.stopTest()
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
    else delete globalThis.navigator
  })
  const deliver = async bytes => {
    input.enqueue(Uint8Array.from(bytes))
    await new Promise(setImmediate)
  }
  const rawLines = () => logs.filter(line => line.startsWith('收到数据: '))
  const uid = bytes => [1, 0x10, 4, ...bytes]

  await t.test('valid escaped frame split at the escape byte logs each byte once and updates UI', async () => {
    logs.length = 0
    const wire = reply(uid([0xe0, 0xd0, 0x12, 0x34]))
    const split = wire.indexOf(0xd0) + 1
    const chunks = [wire.slice(0, split), wire.slice(split)]
    await deliver(chunks[0])
    assert.equal(elements.cardUidDisplay.textContent, '-')
    await deliver(chunks[1])
    assert.equal(elements.cardUidDisplay.textContent, 'e0 d0 12 34')
    assert.deepEqual(rawLines(), chunks.map(bytes => `收到数据: ${hex(bytes)}`))
    assert.equal(logs.filter(line => line.startsWith('收到响应:')).length, 1)
    assert.equal(logs.some(line => line.startsWith('接收帧错误:')), false)
  })

  await t.test('bad checksum logs the complete wire frame and preserves confirmed state and status', async () => {
    logs.length = 0
    const before = { uid: elements.cardUidDisplay.textContent, info: elements.deviceStatus.innerHTML, count: statuses.length }
    const wire = reply(uid([0xe0, 0xd0, 0x56, 0x78]), true)
    await deliver(wire)
    assert.deepEqual(rawLines(), [`收到数据: ${hex(wire)}`])
    assert.equal(logs.filter(line => line === '接收帧错误: checksum').length, 1)
    assert.equal(logs.some(line => line.startsWith('收到响应:')), false)
    assert.equal(elements.cardUidDisplay.textContent, before.uid)
    assert.equal(elements.deviceStatus.innerHTML, before.info)
    assert.equal(statuses.length, before.count)
  })

  await t.test('unsolicited corrupt frame remains complete across three reads including its checksum', async () => {
    logs.length = 0
    const wire = reply(uid([0xe0, 0xd0, 0x9a, 0xbc]), true)
    const chunks = [wire.slice(0, 3), wire.slice(3, -1), wire.slice(-1)]
    for (const chunk of chunks) await deliver(chunk)
    assert.deepEqual(rawLines(), chunks.map(bytes => `收到数据: ${hex(bytes)}`))
    assert.equal(logs.filter(line => line === '接收帧错误: checksum').length, 1)
    assert.equal(elements.cardUidDisplay.textContent, 'e0 d0 12 34')
  })

  await t.test('coalesced valid/bad/valid frames keep normal response counts and recover after corruption', async () => {
    logs.length = 0
    const wire = [...reply(uid([1, 2, 3, 4])), ...reply(uid([5, 6, 7, 8]), true), ...reply(uid([9, 10, 11, 12]))]
    await deliver(wire)
    assert.deepEqual(rawLines(), [`收到数据: ${hex(wire)}`])
    assert.equal(logs.filter(line => line.startsWith('收到响应:')).length, 2)
    assert.equal(logs.filter(line => line === '接收帧错误: checksum').length, 1)
    assert.equal(elements.cardUidDisplay.textContent, '09 0a 0b 0c')
  })

  await t.test('bad response to an information command cannot update information or report success', async () => {
    logs.length = 0
    await elements.getFWVersionBtn.click()
    const before = { info: elements.deviceStatus.innerHTML, count: statuses.length }
    const wire = reply([0x58], true, 0x30)
    await deliver(wire)
    assert.deepEqual(rawLines(), [`收到数据: ${hex(wire)}`])
    assert.equal(elements.deviceStatus.innerHTML, before.info)
    assert.equal(statuses.length, before.count)
    assert.equal(logs.some(line => line.startsWith('收到响应:')), false)
  })
})
