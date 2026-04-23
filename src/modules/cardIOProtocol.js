import {
  CARD_IO_SYNC_BYTE,
  CARD_IO_ESCAPE_BYTE,
  CARD_IO_RESPONSE_HEADER_SIZE,
  CARD_IO_COMMANDS,
  CARD_IO_STATUS,
} from '../constants'

export class CardIOProtocol {
  constructor() {
    this.frameBuffer = []
    this.checksum = 0
    this.prevByte = 0
    this.frameStarted = false
  }

  encodeFrame(addr, seqNo, cmd, payload = []) {
    const frameLen = 5 + payload.length
    const frame = []
    
    frame.push(frameLen)
    frame.push(addr)
    frame.push(seqNo)
    frame.push(cmd)
    frame.push(payload.length)
    
    for (const byte of payload) {
      frame.push(byte)
    }
    
    let checksum = 0
    for (const byte of frame) {
      checksum += byte
    }
    frame.push(checksum & 0xff)
    
    const encodedFrame = [CARD_IO_SYNC_BYTE]
    for (const byte of frame) {
      if (byte === CARD_IO_SYNC_BYTE || byte === CARD_IO_ESCAPE_BYTE) {
        encodedFrame.push(CARD_IO_ESCAPE_BYTE)
        encodedFrame.push(byte - 1)
      } else {
        encodedFrame.push(byte)
      }
    }
    
    return new Uint8Array(encodedFrame)
  }

  decodeByte(byte) {
    if (byte === CARD_IO_SYNC_BYTE && this.prevByte !== CARD_IO_ESCAPE_BYTE) {
      this.frameBuffer = []
      this.checksum = 0
      this.frameStarted = true
      this.prevByte = byte
      return null
    }
    
    if (this.prevByte === CARD_IO_ESCAPE_BYTE) {
      byte = byte + 1
    } else if (byte === CARD_IO_ESCAPE_BYTE) {
      this.prevByte = byte
      return null
    }
    
    this.frameBuffer.push(byte)
    
    const frameLen = this.frameBuffer[0]
    
    if (frameLen && this.frameBuffer.length > frameLen) {
      const calculatedChecksum = this.calculateChecksum(this.frameBuffer.slice(0, frameLen))
      const receivedChecksum = this.frameBuffer[frameLen]
      
      this.prevByte = 0
      this.frameStarted = false
      
      if (calculatedChecksum === receivedChecksum) {
        const frame = this.parseFrame(this.frameBuffer.slice(0, frameLen))
        this.frameBuffer = []
        return frame
      } else {
        console.warn('校验和错误', { calculated: calculatedChecksum, received: receivedChecksum })
        this.frameBuffer = []
        return { error: 'checksum', frame: this.frameBuffer }
      }
    }
    
    this.prevByte = byte === CARD_IO_ESCAPE_BYTE ? CARD_IO_ESCAPE_BYTE : byte
    if (this.prevByte === CARD_IO_ESCAPE_BYTE) {
      this.prevByte = 0
    }
    
    return null
  }

  calculateChecksum(data) {
    let sum = 0
    for (const byte of data) {
      sum += byte
    }
    return sum & 0xff
  }

  parseFrame(buffer) {
    if (buffer.length < CARD_IO_RESPONSE_HEADER_SIZE) {
      return null
    }
    
    return {
      frameLen: buffer[0],
      addr: buffer[1],
      seqNo: buffer[2],
      cmd: buffer[3],
      status: buffer[4],
      payloadLen: buffer[5],
      payload: buffer.slice(6, 6 + buffer[5]),
    }
  }

  buildCommand(cmd, payload = [], addr = 0x00, seqNo = 0x00) {
    return this.encodeFrame(addr, seqNo, cmd, payload)
  }

  buildGetFWVersion(addr = 0x00, seqNo = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_GET_FW_VERSION, [], addr, seqNo)
  }

  buildGetHWVersion(addr = 0x00, seqNo = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_GET_HW_VERSION, [], addr, seqNo)
  }

  buildStartPolling(addr = 0x00, seqNo = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_START_POLLING, [], addr, seqNo)
  }

  buildStopPolling(addr = 0x00, seqNo = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_STOP_POLLING, [], addr, seqNo)
  }

  buildCardDetect(addr = 0x00, seqNo = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_CARD_DETECT, [], addr, seqNo)
  }

  buildSetLEDRGB(r, g, b, addr = 0x00, seqNo = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_EXT_BOARD_SET_LED_RGB, [r, g, b], addr, seqNo)
  }

  buildToNormalMode(addr = 0x00, seqNo = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_TO_NORMAL_MODE, [], addr, seqNo)
  }

  buildGetBoardInfo(addr = 0x00, seqNo = 0x00) {
    return this.buildCommand(CARD_IO_COMMANDS.CMD_EXT_BOARD_INFO, [], addr, seqNo)
  }

  getCommandName(cmd) {
    for (const [name, value] of Object.entries(CARD_IO_COMMANDS)) {
      if (value === cmd) return name
    }
    return `UNKNOWN(0x${cmd.toString(16).padStart(2, '0')})`
  }

  getStatusName(status) {
    for (const [name, value] of Object.entries(CARD_IO_STATUS)) {
      if (value === status) return name
    }
    return `UNKNOWN(0x${status.toString(16).padStart(2, '0')})`
  }

  reset() {
    this.frameBuffer = []
    this.checksum = 0
    this.prevByte = 0
    this.frameStarted = false
  }
}