import {
  CARD_READER_VID,
  CARD_READER_PID,
  CARD_READER_SERIAL_OPTIONS,
  CARD_IO_COMMANDS,
  LED_IO_ACK_STATUS,
  LED_RGB_DATA_SIZE,
} from '../constants'
import { SerialCommunicator } from './serialCommunicator'
import { LedIOProtocol } from './ledIOProtocol'

export const createLedBoardTestController = ({
  elements,
  showStatus,
  showLedBoardLog,
  renderList,
}) => {
  let serialCommunicator = null
  let ledIOProtocol = new LedIOProtocol()
  let isConnected = false
  let ledStateBuffer = new Uint8Array(LED_RGB_DATA_SIZE)

  const {
    connectBtn,
    disconnectBtn,
    connectionStatus,
    deviceStatus,
    getBoardInfoBtn,
    wholeBoardBtn,
    leftKeysBtn,
    rightKeysBtn,
    resetBoardBtn,
    colorPicker,
    operationStatus,
    logBox,
  } = elements

  const showLedStatus = (message, type = 'info', element = operationStatus) => {
    showStatus(message, type, element)
  }

  const formatBytes = (data) => {
    return Array.from(data).map(x => x.toString(16).padStart(2, '0')).join(' ')
  }

  const parseBoardInfo = (data) => {
    if (data.length < 16) {
      return null
    }
    const model = String.fromCharCode(...data.slice(0, 8))
    const separator = data[8]
    const subModel = String.fromCharCode(...data.slice(9, 14))
    const flag = data[14]
    const revision = data[15]
    return {
      model,
      separator,
      subModel,
      flag,
      revision,
      raw: formatBytes(data),
    }
  }

  const handleReceivedData = (data) => {
    for (const byte of data) {
      const frame = ledIOProtocol.decodeByte(byte)
      if (frame) {
        processReceivedFrame(frame)
      }
    }
  }

  const processReceivedFrame = (frame) => {
    if (frame.error) {
      showLedBoardLog(`接收帧错误: ${frame.error}`)
      return
    }

    const cmdName = ledIOProtocol.getCommandName(frame.command)
    const ackName = ledIOProtocol.getAckStatusName(frame.status)
    const reportName = ledIOProtocol.getReportStatusName(frame.report)

    showLedBoardLog(
      `收到响应: CMD=${cmdName}, ACK=${ackName}, Report=${reportName}, Payload=${formatBytes(frame.data)}`
    )

    if (frame.status === LED_IO_ACK_STATUS.ACK_OK && frame.report === 1) {
      switch (frame.command) {
        case CARD_IO_COMMANDS.CMD_EXT_BOARD_INFO: {
          const info = parseBoardInfo(frame.data)
          if (info) {
            showLedBoardLog(`设备信息: 模型=${info.model}, 子模型=${info.subModel}, 修订=${info.revision}`)
            updateDeviceStatus(info)
          } else {
            showLedBoardLog(`设备信息原始数据: ${formatBytes(frame.data)}`)
            deviceStatus.innerHTML = `
              <strong>连接状态:</strong> 已连接<br>
              <hr style="margin: 10px 0;">
              <strong>设备信息:</strong> ${formatBytes(frame.data)}<br>
            `
          }
          break
        }
        case CARD_IO_COMMANDS.CMD_RESET:
          showLedBoardLog('灯板重置成功')
          break
        default:
          break
      }
      showLedStatus(`${cmdName} 成功`, 'success')
    } else {
      showLedStatus(`${cmdName} 失败: ${ackName}`, 'error')
    }
  }

  const updateDeviceStatus = (info) => {
    deviceStatus.innerHTML = `
      <strong>连接状态:</strong> 已连接<br>
      <hr style="margin: 10px 0;">
      <strong>模型:</strong> ${info.model}<br>
      <strong>子模型:</strong> ${info.subModel}<br>
      <strong>修订:</strong> 0x${info.revision.toString(16).padStart(2, '0')}<br>
      <strong>原始数据:</strong> ${info.raw}<br>
    `
  }

  const sendCommand = async (frame) => {
    if (!isConnected || !serialCommunicator) {
      showLedStatus('设备未连接', 'error')
      throw new Error('设备未连接')
    }

    showLedBoardLog(`发送命令: ${formatBytes(frame)}`)
    await serialCommunicator.send(frame)
  }

  const connectDevice = async () => {
    if (!SerialCommunicator.isSupported()) {
      showLedStatus('浏览器不支持 WebSerial API', 'error', connectionStatus)
      showLedBoardLog('错误: 当前浏览器不支持 WebSerial API，请使用 Chrome/Edge 浏览器')
      return
    }

    try {
      connectBtn.disabled = true
      showLedStatus('正在请求设备...', 'info', connectionStatus)
      showLedBoardLog('开始连接灯板设备...')
      showLedBoardLog(`期望 VID: 0x${CARD_READER_VID.toString(16)}, PID: 0x${CARD_READER_PID.toString(16)}`)

      serialCommunicator = new SerialCommunicator()

      await navigator.serial.requestPort({
        filters: [{
          usbVendorId: CARD_READER_VID,
          usbProductId: CARD_READER_PID,
        }]
      }).then(port => {
        serialCommunicator.port = port
      })

      await serialCommunicator.connect(CARD_READER_SERIAL_OPTIONS)

      serialCommunicator.onDataReceived = handleReceivedData

      isConnected = true

      showLedStatus('灯板已连接！', 'success', connectionStatus)
      showLedBoardLog('串口已打开，波特率: 115200')

      const info = serialCommunicator.getInfo()
      showLedBoardLog(`设备信息: VID=0x${info.usbVendorId?.toString(16)}, PID=0x${info.usbProductId?.toString(16)}`)

      ledStateBuffer.fill(0)

      deviceStatus.innerHTML = `
        <strong>连接状态:</strong> 已连接<br>
        <hr style="margin: 10px 0;">
        <strong>模型:</strong> -<br>
        <strong>子模型:</strong> -<br>
        <strong>修订:</strong> -<br>
        <strong>原始数据:</strong> -<br>
      `

      disconnectBtn.disabled = false
      getBoardInfoBtn.disabled = false
      wholeBoardBtn.disabled = false
      leftKeysBtn.disabled = false
      rightKeysBtn.disabled = false
      resetBoardBtn.disabled = false
    } catch (error) {
      showLedStatus(`连接失败: ${error.message}`, 'error', connectionStatus)
      showLedBoardLog(`连接失败: ${error.message}`)
      isConnected = false
      if (serialCommunicator) {
        try {
          await serialCommunicator.disconnect()
        } catch (e) {
          console.error('断开连接错误:', e)
        }
      }
      serialCommunicator = null
    } finally {
      connectBtn.disabled = false
    }
  }

  const disconnectDevice = async () => {
    if (!serialCommunicator) return

    try {
      disconnectBtn.disabled = true

      await serialCommunicator.disconnect()
      isConnected = false
      serialCommunicator = null
      ledIOProtocol.reset()
      ledStateBuffer.fill(0)

      showLedStatus('设备已断开', 'info', connectionStatus)
      showLedBoardLog('灯板已断开连接')

      deviceStatus.innerHTML = '未连接设备'

      disconnectBtn.disabled = true
      getBoardInfoBtn.disabled = true
      wholeBoardBtn.disabled = true
      leftKeysBtn.disabled = true
      rightKeysBtn.disabled = true
      resetBoardBtn.disabled = true
    } catch (error) {
      showLedStatus(`断开失败: ${error.message}`, 'error', connectionStatus)
      showLedBoardLog(`断开失败: ${error.message}`)
    } finally {
      disconnectBtn.disabled = false
    }
  }

  const getBoardInfo = async () => {
    const frame = ledIOProtocol.buildGetBoardInfo()
    await sendCommand(frame)
  }

  const getColorFromPicker = () => {
    const colorValue = colorPicker.value
    const r = parseInt(colorValue.slice(1, 3), 16)
    const g = parseInt(colorValue.slice(3, 5), 16)
    const b = parseInt(colorValue.slice(5, 7), 16)
    return [r, g, b]
  }

  const setWholeBoardColor = async () => {
    const [r, g, b] = getColorFromPicker()
    showLedBoardLog(`设置整个灯板颜色: RGB(${r}, ${g}, ${b})`)

    for (let i = 0; i < LED_RGB_DATA_SIZE; i += 3) {
      ledStateBuffer[i] = r
      ledStateBuffer[i + 1] = g
      ledStateBuffer[i + 2] = b
    }

    const frame = ledIOProtocol.buildSetLEDRGBDirect(ledStateBuffer)
    await sendCommand(frame)
    showLedBoardLog('整个灯板颜色已发送（设备不会回复）')
  }

  const setLeftKeysColor = async () => {
    const [r, g, b] = getColorFromPicker()
    showLedBoardLog(`设置左侧键颜色: RGB(${r}, ${g}, ${b})`)

    ledStateBuffer[0] = r
    ledStateBuffer[1] = g
    ledStateBuffer[2] = b
    ledStateBuffer[3] = r
    ledStateBuffer[4] = g
    ledStateBuffer[5] = b

    const frame = ledIOProtocol.buildSetLEDRGBDirect(ledStateBuffer)
    await sendCommand(frame)
    showLedBoardLog('左侧键颜色已发送（设备不会回复）')
  }

  const setRightKeysColor = async () => {
    const [r, g, b] = getColorFromPicker()
    showLedBoardLog(`设置右侧键颜色: RGB(${r}, ${g}, ${b})`)

    ledStateBuffer[177] = r
    ledStateBuffer[178] = g
    ledStateBuffer[179] = b
    ledStateBuffer[180] = r
    ledStateBuffer[181] = g
    ledStateBuffer[182] = b

    const frame = ledIOProtocol.buildSetLEDRGBDirect(ledStateBuffer)
    await sendCommand(frame)
    showLedBoardLog('右侧键颜色已发送（设备不会回复）')
  }

  const resetBoard = async () => {
    showLedBoardLog('重置灯板...')
    const frame = ledIOProtocol.buildReset()
    await sendCommand(frame)
    ledStateBuffer.fill(0)
  }

  const bindEvents = () => {
    connectBtn.addEventListener('click', connectDevice)
    disconnectBtn.addEventListener('click', disconnectDevice)
    getBoardInfoBtn.addEventListener('click', getBoardInfo)
    wholeBoardBtn.addEventListener('click', setWholeBoardColor)
    leftKeysBtn.addEventListener('click', setLeftKeysColor)
    rightKeysBtn.addEventListener('click', setRightKeysColor)
    resetBoardBtn.addEventListener('click', resetBoard)

    disconnectBtn.disabled = true
    getBoardInfoBtn.disabled = true
    wholeBoardBtn.disabled = true
    leftKeysBtn.disabled = true
    rightKeysBtn.disabled = true
    resetBoardBtn.disabled = true
  }

  const stopTest = async () => {
    if (isConnected) {
      await disconnectDevice()
    }
  }

  return {
    bindEvents,
    stopTest,
    getSerialCommunicator: () => serialCommunicator,
  }
}
