import {
  BUTTON_MAP,
  INVERTED_BUTTONS,
  ROLLER_CENTER,
  COIN_OFFSETS,
} from '../constants'

const JOYSTICK_REPORT_ID = 0x01

export const createInputTestController = ({
  elements,
  communicator,
  showStatus,
  showInputTestLog,
  renderList,
}) => {
  let inputTestDevice = null
  let isTestRunning = false
  let inputReportListener = null

  const {
    connectInputTestBtn,
    inputTestConnectList,
    inputTestConnectionStatus,
    startInputTestBtn,
    stopInputTestBtn,
    inputTestStatus,
    joystickDot,
    joystickX,
    joystickY,
    joystickRaw,
    rawInputStatus,
    rawButtons,
    inputTestLogBox,
    arcadeButtons,
    coin1Condition,
    coin1Count,
    coin2Condition,
    coin2Count,
  } = elements

  const parseButtonStateFromReport = (data) => {
    const buttonStates = {}
    
    if (data.length < 34) {
      return buttonStates
    }
    
    const buttonStart = 28
    const buttonBytes = [
      data[buttonStart],
      data[buttonStart + 1],
      data[buttonStart + 2],
      data[buttonStart + 3],
      data[buttonStart + 4],
      data[buttonStart + 5],
    ]
    
    const allButtons = buttonBytes.reduce((acc, byte, idx) => {
      return acc | (byte << (idx * 8))
    }, 0)

    for (const [name, {byte, mask}] of Object.entries(BUTTON_MAP)) {
      let isPressed = (buttonBytes[byte] & mask) !== 0
      if (INVERTED_BUTTONS.includes(name)) {
        isPressed = !isPressed
      }
      buttonStates[name] = isPressed
    }
    
    return buttonStates
  }

  const updateButtonUI = (buttonStates) => {
    for (const [name, isPressed] of Object.entries(buttonStates)) {
      const buttonElement = arcadeButtons[name]
      if (buttonElement) {
        if (isPressed) {
          buttonElement.classList.add('pressed')
        } else {
          buttonElement.classList.remove('pressed')
        }
      }
    }
  }

  const updateJoystickUI = (rollerValue) => {
    const normalizedX = (ROLLER_CENTER - rollerValue) / ROLLER_CENTER
    const xPercent = Math.max(-1, Math.min(1, normalizedX))
    const xOffset = 50 + xPercent * 50

    joystickDot.style.left = `${xOffset}%`
    joystickDot.style.top = '50%'

    joystickX.textContent = `${rollerValue} (0x${rollerValue.toString(16).padStart(4, '0')})`
    joystickY.textContent = '- (无Y轴)'
    joystickRaw.textContent = `${rollerValue} (0x${rollerValue.toString(16).padStart(4, '0')})`

    const deviationPercent = ((rollerValue - ROLLER_CENTER) / ROLLER_CENTER * 100).toFixed(1)
    if (Math.abs(deviationPercent) < 5) {
      joystickDot.style.background = 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)'
    } else if (deviationPercent > 0) {
      joystickDot.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
    } else {
      joystickDot.style.background = 'linear-gradient(135deg, #33ff66 0%, #22cc55 100%)'
    }
  }

const updateRawDataUI = (data) => {
    if (data.length >= 34) {
      const buttonStart = 27
      const buttonBytes = data.slice(buttonStart, buttonStart + 6)
      const allButtons = buttonBytes.reduce((acc, byte, idx) => {
        return acc | (byte << (idx * 8))
      }, 0)
      rawInputStatus.textContent = `0x${allButtons.toString(16).padStart(6, '0')}`
      rawButtons.textContent = Array.from(buttonBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
    }
  }

  const updateCoinUI = (data) => {
    if (data.length < 29) return

    const coin1CondRaw = data[COIN_OFFSETS.COIN1_CONDITION]
    const coin1CountRaw = data[COIN_OFFSETS.COIN1_COUNT]
    const coin2CondRaw = data[COIN_OFFSETS.COIN2_CONDITION]
    const coin2CountRaw = data[COIN_OFFSETS.COIN2_COUNT]

    if (coin1Condition) {
      coin1Condition.textContent = `0x${coin1CondRaw.toString(16).padStart(2, '0')}`
    }
    if (coin1Count) {
      coin1Count.textContent = `${coin1CountRaw}`
    }
    if (coin2Condition) {
      coin2Condition.textContent = `0x${coin2CondRaw.toString(16).padStart(2, '0')}`
    }
    if (coin2Count) {
      coin2Count.textContent = `${coin2CountRaw}`
    }
  }

  const handleJoystickInputReport = (event) => {
    if (!isTestRunning) return
    
    const { reportId, data } = event
    if (reportId !== JOYSTICK_REPORT_ID) return
    
    const dataArray = new Uint8Array(data.buffer)
    
    if (dataArray.length < 34) return
    
    const rollerLow = dataArray[0]
    const rollerHigh = dataArray[1]
    const rollerValue = (rollerHigh << 8) | rollerLow
    
    updateJoystickUI(rollerValue)

    const buttonStates = parseButtonStateFromReport(dataArray)
    updateButtonUI(buttonStates)

    updateRawDataUI(dataArray)
    updateCoinUI(dataArray)
  }

  const startInputTest = async () => {
    if (!inputTestDevice || !inputTestDevice.opened) {
      showStatus('请先连接设备', 'error', inputTestStatus)
      return
    }

    isTestRunning = true
    startInputTestBtn.disabled = true
    stopInputTestBtn.disabled = false
    showStatus('输入测试已启动', 'success', inputTestStatus)
    showInputTestLog('开始输入测试，监听摇杆和按键输入报告...')
  }

  const stopInputTest = async () => {
    isTestRunning = false
    startInputTestBtn.disabled = false
    stopInputTestBtn.disabled = true
    showStatus('输入测试已停止', 'info', inputTestStatus)
    showInputTestLog('已停止输入测试')

    resetUI()
  }

  const resetUI = () => {
    for (const buttonElement of Object.values(arcadeButtons)) {
      if (buttonElement) {
        buttonElement.classList.remove('pressed')
      }
    }

    joystickDot.style.left = '50%'
    joystickDot.style.top = '50%'
    joystickDot.style.background = 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)'
    joystickX.textContent = `${ROLLER_CENTER} (0x${ROLLER_CENTER.toString(16).padStart(4, '0')})`
    joystickY.textContent = '- (无Y轴)'
    joystickRaw.textContent = `${ROLLER_CENTER} (0x${ROLLER_CENTER.toString(16).padStart(4, '0')})`

    rawInputStatus.textContent = '0x000000'
    rawButtons.textContent = '00 00 00 00 00 00'

    if (coin1Condition) coin1Condition.textContent = '-'
    if (coin1Count) coin1Count.textContent = '0'
    if (coin2Condition) coin2Condition.textContent = '-'
    if (coin2Count) coin2Count.textContent = '0'
  }

  const connectInputTestDevice = async () => {
    try {
      connectInputTestBtn.disabled = true
      showStatus('正在请求设备...', 'info', inputTestConnectionStatus)
      showInputTestLog('开始连接输入测试设备...')
      showInputTestLog('请求 Joystick/Gamepad HID 接口 (Usage Page: 0x01, Usage: 0x04)')

      const devices = await navigator.hid.requestDevice({
        filters: [
          {
            vendorId: 0x0ca3,
            productId: 0x0021,
            usagePage: 0x01,
            usage: 0x04,
          },
          {
            vendorId: 0x8088,
            productId: 0x0101,
            usagePage: 0x01,
            usage: 0x04,
          },
        ],
      })

      if (devices.length === 0) {
        throw new Error('未选择设备')
      }

      inputTestDevice = devices[0]
      renderList(inputTestConnectList, devices)

      window.inputTestDevice = inputTestDevice
      
      showInputTestLog(`已选择设备: ${inputTestDevice.productName}`)
      showInputTestLog(`设备信息: VID=${inputTestDevice.vendorId}, PID=${inputTestDevice.productId}`)
      if (inputTestDevice.collections && inputTestDevice.collections.length > 0) {
        showInputTestLog(`HID集合: UsagePage=${inputTestDevice.collections[0].usagePage}, Usage=${inputTestDevice.collections[0].usage}`)
      }

      await inputTestDevice.open()
      showStatus('设备已连接！', 'success', inputTestConnectionStatus)
      showInputTestLog('设备已打开，准备监听输入报告')

      inputReportListener = handleJoystickInputReport
      inputTestDevice.addEventListener('inputreport', inputReportListener)

      startInputTestBtn.disabled = false
      stopInputTestBtn.disabled = true

      showInputTestLog('设备连接成功！点击"开始测试"开始监听按键和摇杆输入')
    } catch (error) {
      showStatus(`连接失败: ${error.message}`, 'error', inputTestConnectionStatus)
      showInputTestLog(`设备连接失败: ${error.message}`)
      if (inputTestDevice && inputTestDevice.opened) {
        try {
          await inputTestDevice.close()
        } catch (closeError) {
          showInputTestLog(`关闭设备时出错: ${closeError.message}`)
        }
      }
      inputTestDevice = null
      stopInputTest()
    } finally {
      connectInputTestBtn.disabled = false
    }
  }

  const bindEvents = () => {
    connectInputTestBtn.addEventListener('click', connectInputTestDevice)
    startInputTestBtn.addEventListener('click', startInputTest)
    stopInputTestBtn.addEventListener('click', stopInputTest)

    startInputTestBtn.disabled = true
    stopInputTestBtn.disabled = true
  }

  return {
    bindEvents,
    stopTest: stopInputTest,
    getInputTestDevice: () => inputTestDevice,
  }
}