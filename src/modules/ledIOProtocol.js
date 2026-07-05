import {
  LED_IO_SYNC_BYTE,
  LED_IO_ESCAPE_BYTE,
  LED_IO_CHECKSUM_SEED,
  LED_IO_ACK_STATUS,
  LED_IO_REPORT_STATUS,
  CARD_IO_COMMANDS,
} from '../constants'

export class LedIOProtocol {
  constructor() {
    this.frameBuffer = []
    this.checksum = 0
    this.prevByte = 0
    this.frameStarted = false
  }

  encodeFrame(dstNodeId, srcNodeId, command, data = []) {
    const length = data.length + 1

    const frame = [dstNodeId, srcNodeId, length, command, ...data]

    let checksum = 0
    for (const byte of frame) {
      checksum += byte
    }
    frame.push(checksum & 0xff)

    const encodedFrame = [LED_IO_SYNC_BYTE]
    for (const byte of frame) {
      if (byte === LED_IO_SYNC_BYTE || byte === LED_IO_ESCAPE_BYTE) {
        encodedFrame.push(LED_IO_ESCAPE_BYTE)
        encodedFrame.push(byte - 1)
      } else {
        encodedFrame.push(byte)
      }
    }

    return new Uint8Array(encodedFrame)
  }

  decodeByte(byte) {
    if (byte === LED_IO_SYNC_BYTE && this.prevByte !== LED_IO_ESCAPE_BYTE) {
      this.frameBuffer = []
      this.checksum = LED_IO_CHECKSUM_SEED
      this.frameStarted = true
    } else if (this.prevByte === LED_IO_ESCAPE_BYTE) {
      byte = byte + 1
    } else if (byte === LED_IO_ESCAPE_BYTE) {
      this.prevByte = byte
      return null
    }

    if (!this.frameStarted) {
      return null
    }

    this.frameBuffer.push(byte)

    if (this.frameBuffer.length > 5 && this.frameBuffer.length - 5 === this.frameBuffer[3]) {
      const receivedChecksum = byte

      this.prevByte = 0
      this.frameStarted = false

      if (this.checksum === receivedChecksum) {
        const frame = this.parseFrame(this.frameBuffer)
        this.frameBuffer = []
        return frame
      } else {
        console.warn('LED IO 校验和错误', {
          calculated: this.checksum,
          received: receivedChecksum,
        })
        this.frameBuffer = []
        return { error: 'checksum' }
      }
    }

    this.checksum = (this.checksum + byte) & 0xff

    this.prevByte = byte
    if (this.prevByte === LED_IO_ESCAPE_BYTE) {
      this.prevByte = 0
    }

    return null
  }

  parseFrame(buffer) {
    if (buffer.length < 8) return null

    const length = buffer[3]
    const dataCount = length - 3

    return {
      sync: buffer[0],
      dstNodeId: buffer[1],
      srcNodeId: buffer[2],
      length: length,
      status: buffer[4],
      command: buffer[5],
      report: buffer[6],
      data: buffer.slice(7, 7 + dataCount),
      dataCount: dataCount,
    }
  }

  buildCommand(command, payload = [], dstNodeId = 0x00, srcNodeId = 0x00) {
    return this.encodeFrame(dstNodeId, srcNodeId, command, payload)
  }

  buildReset(dstNodeId = 0x00, srcNodeId = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_RESET, [], dstNodeId, srcNodeId)
  }

  buildSetLEDRGBDirect(rgbData, dstNodeId = 0x00, srcNodeId = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_EXT_BOARD_SET_LED_RGB_DIRECT, rgbData, dstNodeId, srcNodeId)
  }

  buildGetBoardInfo(dstNodeId = 0x00, srcNodeId = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_EXT_BOARD_INFO, [], dstNodeId, srcNodeId)
  }

  getCommandName(cmd) {
    for (const [name, value] of Object.entries(CARD_IO_COMMANDS)) {
      if (value === cmd) return name
    }
    return `UNKNOWN(0x${cmd.toString(16).padStart(2, '0')})`
  }

  getAckStatusName(status) {
    for (const [name, value] of Object.entries(LED_IO_ACK_STATUS)) {
      if (value === status) return name
    }
    return `UNKNOWN(0x${status.toString(16).padStart(2, '0')})`
  }

  getReportStatusName(report) {
    for (const [name, value] of Object.entries(LED_IO_REPORT_STATUS)) {
      if (value === report) return name
    }
    return `UNKNOWN(0x${report.toString(16).padStart(2, '0')})`
  }

  reset() {
    this.frameBuffer = []
    this.checksum = 0
    this.prevByte = 0
    this.frameStarted = false
  }
}
