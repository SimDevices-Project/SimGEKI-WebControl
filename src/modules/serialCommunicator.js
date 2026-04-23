export class SerialCommunicator {
  constructor() {
    this.port = null
    this.reader = null
    this.writer = null
    this.readableStream = null
    this.writableStream = null
    this.isConnected = false
    this.receiveBuffer = []
    this.onDataReceived = null
  }

  async connect(options = {}) {
    const {
      baudRate = 115200,
      dataBits = 8,
      stopBits = 1,
      parity = 'none',
    } = options

    try {
      if (!this.port) {
        this.port = await navigator.serial.requestPort()
      }

      await this.port.open({
        baudRate,
        dataBits,
        stopBits,
        parity,
        bufferSize: 256,
        flowControl: 'none',
      })

      this.isConnected = true

      this.readableStream = this.port.readable
      this.reader = this.readableStream.getReader()

      this.writableStream = this.port.writable
      this.writer = this.writableStream.getWriter()

      this.startReading()

      console.debug('串口已连接')
      return true
    } catch (error) {
      console.error('串口连接失败:', error)
      this.isConnected = false
      throw error
    }
  }

  startReading() {
    const readLoop = async () => {
      while (this.isConnected && this.reader) {
        try {
          const { value, done } = await this.reader.read()
          if (done) {
            console.debug('读取流已关闭')
            break
          }
          if (value && value.length > 0) {
            this.receiveBuffer.push(...value)
            if (this.onDataReceived) {
              this.onDataReceived(new Uint8Array(value))
            }
          }
        } catch (error) {
          if (this.isConnected) {
            console.error('读取错误:', error)
          }
          break
        }
      }
    }
    readLoop()
  }

  async send(data) {
    if (!this.isConnected || !this.writer) {
      throw new Error('串口未连接')
    }

    const dataArray = data instanceof Uint8Array ? data : new Uint8Array(data)
    
    try {
      await this.writer.write(dataArray)
      console.debug('串口数据已发送:', Array.from(dataArray).map(x => x.toString(16).padStart(2, '0')).join(' '))
    } catch (error) {
      console.error('发送失败:', error)
      throw error
    }
  }

  async disconnect() {
    this.isConnected = false

    try {
      if (this.reader) {
        await this.reader.cancel()
        this.reader.releaseLock()
        this.reader = null
      }

      if (this.writer) {
        await this.writer.close()
        this.writer.releaseLock()
        this.writer = null
      }

      if (this.port) {
        await this.port.close()
        this.port = null
      }

      this.receiveBuffer = []
      console.debug('串口已断开')
    } catch (error) {
      console.error('断开连接时出错:', error)
    }
  }

  getBuffer() {
    return new Uint8Array(this.receiveBuffer)
  }

  clearBuffer() {
    this.receiveBuffer = []
  }

  getInfo() {
    if (!this.port) return null
    return {
      usbVendorId: this.port.getInfo().usbVendorId,
      usbProductId: this.port.getInfo().usbProductId,
      connected: this.isConnected,
    }
  }

  static isSupported() {
    return 'serial' in navigator
  }
}