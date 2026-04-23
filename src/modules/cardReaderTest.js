import {
  CARD_READER_VID,
  CARD_READER_PID,
  CARD_READER_SERIAL_OPTIONS,
  CARD_IO_STATUS,
  CARD_TYPE,
  CARD_IO_COMMANDS,
} from '../constants'
import { SerialCommunicator } from './serialCommunicator'
import { CardIOProtocol } from './cardIOProtocol'

export const createCardReaderTestController = ({
  elements,
  showStatus,
  showCardReaderLog,
  renderList,
}) => {
  let serialCommunicator = null
  let cardIOProtocol = new CardIOProtocol()
  let isPolling = false
  let pollInterval = null
  let seqNo = 0
  let isConnected = false

  const {
    connectBtn,
    disconnectBtn,
    connectionStatus,
    deviceStatus,
    getFWVersionBtn,
    getHWVersionBtn,
    getBoardInfoBtn,
    startPollingBtn,
    stopPollingBtn,
    cardDetectBtn,
    setLEDBtn,
    ledColorPicker,
    operationStatus,
    logBox,
    cardTypeDisplay,
    cardUidDisplay,
    pollingStatus,
  } = elements

  const getNextSeqNo = () => {
    seqNo = (seqNo + 1) & 0xff
    return seqNo
  }

  const showCardReaderStatus = (message, type = 'info', element = operationStatus) => {
    showStatus(message, type, element)
  }

  const formatBytes = (data) => {
    return Array.from(data).map(x => x.toString(16).padStart(2, '0')).join(' ')
  }

  const handleReceivedData = async (data) => {
    for (const byte of data) {
      const frame = cardIOProtocol.decodeByte(byte)
      if (frame) {
        processReceivedFrame(frame)
      }
    }
  }

  const processReceivedFrame = (frame) => {
    if (frame.error) {
      showCardReaderLog(`接收帧错误: ${frame.error}`)
      return
    }

    const cmdName = cardIOProtocol.getCommandName(frame.cmd)
    const statusName = cardIOProtocol.getStatusName(frame.status)
    
    showCardReaderLog(`收到响应: CMD=${cmdName}, Status=${statusName}, Payload=${formatBytes(frame.payload)}`)

    if (frame.status === CARD_IO_STATUS.STATUS_OK) {
      switch (frame.cmd) {
        case CARD_IO_COMMANDS.CMD_GET_FW_VERSION:
          showCardReaderLog(`固件版本: ${frame.payload}`)
          updateDeviceStatus('fwVersion', String.fromCharCode(...frame.payload))
          break
        case CARD_IO_COMMANDS.CMD_GET_HW_VERSION:
          showCardReaderLog(`硬件版本: ${frame.payload}`)
          updateDeviceStatus('hwVersion', String.fromCharCode(...frame.payload))
          break
        case CARD_IO_COMMANDS.CMD_EXT_BOARD_INFO:
          showCardReaderLog(`设备信息: ${frame.payload}`)
          updateDeviceStatus('boardInfo', formatBytes(frame.payload))
          break
        case CARD_IO_COMMANDS.CMD_CARD_DETECT:
          if (frame.payloadLen >= 3 && frame.payload[1] !== 0x00) {
            const cardType = frame.payload[1]
            const cardTypeName = CARD_TYPE[cardType] || `未知类型(0x${cardType.toString(16).padStart(2, '0')})`
            showCardReaderLog(`检测到卡片: ${cardTypeName}`)
            cardTypeDisplay.textContent = cardTypeName
            
            if (frame.payloadLen >= 7 && cardType === 0x10) {
              const uid = frame.payload.slice(3, 7)
              cardUidDisplay.textContent = formatBytes(uid)
              showCardReaderLog(`卡片UID: ${formatBytes(uid)}`)
            } else if (frame.payloadLen >= 19 && cardType === 0x20) {
              const idm = frame.payload.slice(3, 11)
              const pmm = frame.payload.slice(11, 19)
              showCardReaderLog(`FeliCa IDm: ${formatBytes(idm)}, PMm: ${formatBytes(pmm)}`)
              cardUidDisplay.textContent = formatBytes(idm)
            } else {
              cardUidDisplay.textContent = '-'
            }
            
            if (isPolling) {
              showCardReaderLog('检测到卡片，自动停止轮询')
              stopPollingInternal()
            }
          } else {
            cardTypeDisplay.textContent = '未检测到卡片'
            cardUidDisplay.textContent = '-'
          }
          break
        case CARD_IO_COMMANDS.CMD_START_POLLING:
          showCardReaderLog('开始轮询')
          pollingStatus.textContent = '轮询中'
          break
        case CARD_IO_COMMANDS.CMD_STOP_POLLING:
          showCardReaderLog('停止轮询')
          pollingStatus.textContent = '已停止'
          break
        case CARD_IO_COMMANDS.CMD_TO_NORMAL_MODE:
          showCardReaderLog('进入正常模式')
          break
        case CARD_IO_COMMANDS.CMD_EXT_BOARD_SET_LED_RGB:
          showCardReaderLog('LED设置成功')
          break
        default:
          break
      }
      showCardReaderStatus(`${cmdName} 成功`, 'success')
    } else {
      showCardReaderStatus(`${cmdName} 失败: ${statusName}`, 'error')
    }
  }

  const deviceStatusData = {
    fwVersion: '-',
    hwVersion: '-',
    boardInfo: '-',
  }

  const updateDeviceStatus = (key, value) => {
    deviceStatusData[key] = value
    deviceStatus.innerHTML = `
      <strong>连接状态:</strong> 已连接<br>
      <hr style="margin: 10px 0;">
      <strong>固件版本:</strong> ${deviceStatusData.fwVersion}<br>
      <strong>硬件版本:</strong> ${deviceStatusData.hwVersion}<br>
      <strong>设备信息:</strong> ${deviceStatusData.boardInfo}<br>
    `
  }

  const sendCommand = async (frame) => {
    if (!isConnected || !serialCommunicator) {
      showCardReaderStatus('设备未连接', 'error')
      throw new Error('设备未连接')
    }
    
    showCardReaderLog(`发送命令: ${formatBytes(frame)}`)
    await serialCommunicator.send(frame)
  }

  const connectDevice = async () => {
    if (!SerialCommunicator.isSupported()) {
      showCardReaderStatus('浏览器不支持 WebSerial API', 'error', connectionStatus)
      showCardReaderLog('错误: 当前浏览器不支持 WebSerial API，请使用 Chrome/Edge 浏览器')
      return
    }

    try {
      connectBtn.disabled = true
      showCardReaderStatus('正在请求设备...', 'info', connectionStatus)
      showCardReaderLog('开始连接读卡器设备...')
      showCardReaderLog(`期望 VID: 0x${CARD_READER_VID.toString(16)}, PID: 0x${CARD_READER_PID.toString(16)}`)

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
      
      showCardReaderStatus('读卡器已连接！', 'success', connectionStatus)
      showCardReaderLog('串口已打开，波特率: 115200')
      
      const info = serialCommunicator.getInfo()
      showCardReaderLog(`设备信息: VID=0x${info.usbVendorId?.toString(16)}, PID=0x${info.usbProductId?.toString(16)}`)
      
      deviceStatus.innerHTML = `
        <strong>连接状态:</strong> 已连接<br>
        <hr style="margin: 10px 0;">
        <strong>固件版本:</strong> -<br>
        <strong>硬件版本:</strong> -<br>
        <strong>设备信息:</strong> -<br>
      `
      
      disconnectBtn.disabled = false
      getFWVersionBtn.disabled = false
      getHWVersionBtn.disabled = false
      getBoardInfoBtn.disabled = false
      startPollingBtn.disabled = false
      cardDetectBtn.disabled = false
      setLEDBtn.disabled = false

      const initFrame = cardIOProtocol.buildToNormalMode(0x00, getNextSeqNo())
      await sendCommand(initFrame)
      
    } catch (error) {
      showCardReaderStatus(`连接失败: ${error.message}`, 'error', connectionStatus)
      showCardReaderLog(`连接失败: ${error.message}`)
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
      
      if (isPolling) {
        await stopPolling()
      }
      
      await serialCommunicator.disconnect()
      isConnected = false
      serialCommunicator = null
      cardIOProtocol.reset()
      
      showCardReaderStatus('设备已断开', 'info', connectionStatus)
      showCardReaderLog('读卡器已断开连接')
      
      deviceStatus.innerHTML = '未连接设备'
      cardTypeDisplay.textContent = '-'
      cardUidDisplay.textContent = '-'
      pollingStatus.textContent = '-'
      
      disconnectBtn.disabled = true
      getFWVersionBtn.disabled = true
      getHWVersionBtn.disabled = true
      getBoardInfoBtn.disabled = true
      startPollingBtn.disabled = true
      stopPollingBtn.disabled = true
      cardDetectBtn.disabled = true
      setLEDBtn.disabled = true
      
    } catch (error) {
      showCardReaderStatus(`断开失败: ${error.message}`, 'error', connectionStatus)
      showCardReaderLog(`断开失败: ${error.message}`)
    } finally {
      disconnectBtn.disabled = false
    }
  }

  const getFWVersion = async () => {
    const frame = cardIOProtocol.buildGetFWVersion(0x00, getNextSeqNo())
    await sendCommand(frame)
  }

  const getHWVersion = async () => {
    const frame = cardIOProtocol.buildGetHWVersion(0x00, getNextSeqNo())
    await sendCommand(frame)
  }

  const getBoardInfo = async () => {
    const frame = cardIOProtocol.buildGetBoardInfo(0x00, getNextSeqNo())
    await sendCommand(frame)
  }

  const startPolling = async () => {
    try {
      startPollingBtn.disabled = true
      
      const startFrame = cardIOProtocol.buildStartPolling(0x00, getNextSeqNo())
      await sendCommand(startFrame)
      
      isPolling = true
      stopPollingBtn.disabled = false
      
      pollInterval = setInterval(async () => {
        if (isConnected && isPolling) {
          const detectFrame = cardIOProtocol.buildCardDetect(0x00, getNextSeqNo())
          try {
            await sendCommand(detectFrame)
          } catch (e) {
            console.error('轮询检测错误:', e)
          }
        }
      }, 200)
      
      showCardReaderLog('开始卡片轮询 (每200ms检测一次)')
      
    } catch (error) {
      showCardReaderStatus(`启动轮询失败: ${error.message}`, 'error')
      showCardReaderLog(`启动轮询失败: ${error.message}`)
    } finally {
      startPollingBtn.disabled = false
    }
  }

  const stopPollingInternal = async () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    
    try {
      const stopFrame = cardIOProtocol.buildStopPolling(0x00, getNextSeqNo())
      await sendCommand(stopFrame)
    } catch (e) {
      console.error('停止轮询错误:', e)
    }
    
    isPolling = false
    stopPollingBtn.disabled = true
    startPollingBtn.disabled = false
    pollingStatus.textContent = '已停止 (检测到卡片)'
  }

  const stopPolling = async () => {
    try {
      stopPollingBtn.disabled = true
      
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
      
      const stopFrame = cardIOProtocol.buildStopPolling(0x00, getNextSeqNo())
      await sendCommand(stopFrame)
      
      isPolling = false
      startPollingBtn.disabled = false
      
      showCardReaderLog('停止卡片轮询')
      
    } catch (error) {
      showCardReaderStatus(`停止轮询失败: ${error.message}`, 'error')
      showCardReaderLog(`停止轮询失败: ${error.message}`)
    } finally {
      stopPollingBtn.disabled = false
    }
  }

  const detectCard = async () => {
    const frame = cardIOProtocol.buildCardDetect(0x00, getNextSeqNo())
    await sendCommand(frame)
  }

  const setLED = async () => {
    const colorValue = ledColorPicker.value
    const r = parseInt(colorValue.slice(1, 3), 16)
    const g = parseInt(colorValue.slice(3, 5), 16)
    const b = parseInt(colorValue.slice(5, 7), 16)
    
    showCardReaderLog(`设置LED颜色: RGB(${r}, ${g}, ${b})`)
    
    const frame = cardIOProtocol.buildSetLEDRGB(r, g, b, 0x00, getNextSeqNo())
    await sendCommand(frame)
  }

  const bindEvents = () => {
    connectBtn.addEventListener('click', connectDevice)
    disconnectBtn.addEventListener('click', disconnectDevice)
    getFWVersionBtn.addEventListener('click', getFWVersion)
    getHWVersionBtn.addEventListener('click', getHWVersion)
    getBoardInfoBtn.addEventListener('click', getBoardInfo)
    startPollingBtn.addEventListener('click', startPolling)
    stopPollingBtn.addEventListener('click', stopPolling)
    cardDetectBtn.addEventListener('click', detectCard)
    setLEDBtn.addEventListener('click', setLED)

    disconnectBtn.disabled = true
    getFWVersionBtn.disabled = true
    getHWVersionBtn.disabled = true
    getBoardInfoBtn.disabled = true
    startPollingBtn.disabled = true
    stopPollingBtn.disabled = true
    cardDetectBtn.disabled = true
    setLEDBtn.disabled = true
  }

  const stopTest = async () => {
    if (isPolling) {
      await stopPolling()
    }
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