import { CONFIG_COMMANDS, CONFIG_REPORT_ID, HID_TIMEOUT } from '../constants'

export const createConfigController = ({
  elements,
  communicator,
  showStatus,
  showConfigLog,
  renderList,
  delay,
}) => {
  let configDevice = null
  let leverMonitorInterval = null
  let isMonitoring = false
  let cachedSerialNumber = null

  const {
    connectConfigBtn,
    configConnectList,
    configConnectionStatus,
    resetLeverBtn,
    readLeverInfoBtn,
    readInputModeBtn,
    setInputModeBtn,
    inputModeSelect,
    toggleMonitorBtn,
    lightTestBtn,
    saveConfigBtn,
    cancelConfigBtn,
    configOperationStatus,
    deviceStat,
  } = elements

  const getInputModeLabel = (mode) => {
    switch (mode) {
      case 1:
        return 'IO4兼容'
      case 2:
        return 'DLL输入'
      case 3:
        return '模拟键盘'
      default:
        return '未知'
    }
  }

  const sendConfigReportAndWait = (reportId, data, timeout = HID_TIMEOUT) =>
    communicator.send(reportId, data, timeout)

  const stopLeverMonitoring = () => {
    if (leverMonitorInterval) {
      clearInterval(leverMonitorInterval)
      leverMonitorInterval = null
    }
    isMonitoring = false
    showConfigLog('已停止实时摇杆监控')
    if (toggleMonitorBtn) {
      toggleMonitorBtn.value = '开启实时监控'
      toggleMonitorBtn.style.background = ''
    }
  }

  const startLeverMonitoring = () => {
    if (leverMonitorInterval) {
      clearInterval(leverMonitorInterval)
    }
    isMonitoring = true
    leverMonitorInterval = setInterval(() => {
      if (configDevice && configDevice.opened) {
        readLeverInfo().catch((error) => {
          console.warn('实时摇杆监控失败:', error.message)
        })
      }
    }, 0)
    showConfigLog('已启动实时摇杆监控')
    if (toggleMonitorBtn) {
      toggleMonitorBtn.value = '停止实时监控'
      toggleMonitorBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
    }
  }

  const toggleLeverMonitoring = () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('请先连接配置设备', 'error', configOperationStatus)
      stopLeverMonitoring()
      return
    }

    if (isMonitoring) {
      stopLeverMonitoring()
    } else {
      startLeverMonitoring()
    }
  }

  const getPositionDescription = (value, center) => {
    const deviation = Math.abs(value - center)
    const threshold1 = center * 0.1
    const threshold2 = center * 0.3

    if (deviation < threshold1) {
      return '🎯 中心位置'
    } else if (deviation < threshold2) {
      return value > center ? '↗️ 轻微右偏' : '↖️ 轻微左偏'
    } else {
      return value > center ? '➡️ 明显右偏' : '⬅️ 明显左偏'
    }
  }

  const readLeverInfo = async () => {
    if (!configDevice || !configDevice.opened) {
      showConfigLog('设备未连接，无法读取摇杆信息')
      return
    }

    try {
      showConfigLog('正在读取摇杆信息...')

      const command = [0x00, CONFIG_COMMANDS.ROLLER_GET_DATA, 0x00]
      while (command.length < 63) {
        command.push(0x00)
      }

      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)

      if (response.length >= 7 && response[2] === 0x01) {
        const rollerValue = (response[4] << 8) | response[3]
        const rollerRawValue = (response[6] << 8) | response[5]

        const centerValue = 0x8000
        const deviation = rollerValue - centerValue
        const deviationPercent = ((deviation / centerValue) * 100).toFixed(1)

        deviceStat.innerHTML = `
          <strong>设备名称:</strong> ${configDevice.productName || '未知'}<br>
          <strong>连接状态:</strong> 已连接<br>
          <strong>序列号:</strong> ${cachedSerialNumber || '未读取'}<br>
          <hr style="margin: 10px 0;">
          <strong>摇杆状态:</strong><br>
          <div style="margin-left: 15px;">
            <strong>处理值:</strong> ${rollerValue} (0x${rollerValue.toString(16).padStart(4, '0')})<br>
            <strong>原始值:</strong> ${rollerRawValue} (0x${rollerRawValue.toString(16).padStart(4, '0')})<br>
            <strong>偏移量:</strong> ${deviation > 0 ? '+' : ''}${deviation} (${deviationPercent > 0 ? '+' : ''}${deviationPercent}%)<br>
            <strong>位置:</strong> ${getPositionDescription(rollerValue, centerValue)}
          </div>
        `

        showConfigLog('摇杆数据读取成功:')
        showConfigLog(`  处理值: ${rollerValue} (0x${rollerValue.toString(16).padStart(4, '0')})`)
        showConfigLog(`  原始值: ${rollerRawValue} (0x${rollerRawValue.toString(16).padStart(4, '0')})`)
        showConfigLog(`  偏移: ${deviation} (${deviationPercent}%)`)
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showConfigLog(`读取摇杆信息失败: ${error.message}`)
      deviceStat.innerHTML = `
        <strong>设备名称:</strong> ${configDevice.productName || '未知'}<br>
        <strong>连接状态:</strong> 已连接<br>
        <strong>序列号:</strong> ${cachedSerialNumber || '未读取'}<br>
        <hr style="margin: 10px 0;">
        <strong style="color: #dc3545;">摇杆状态:</strong> 读取失败
      `
    }
  }

  const readInputMode = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      showConfigLog('设备未连接，无法读取输入模式')
      return
    }

    try {
      showStatus('正在读取输入模式...', 'info', configOperationStatus)
      showConfigLog('正在读取输入模式...')

      const command = [0x00, CONFIG_COMMANDS.INPUT_MODE_GET, 0x00]
      while (command.length < 63) {
        command.push(0x00)
      }

      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)

      if (response.length >= 4 && response[2] === 0x01) {
        const mode = response[3]
        if (inputModeSelect) {
          inputModeSelect.value = String(mode)
        }
        showStatus(`输入模式已读取: ${getInputModeLabel(mode)}`, 'success', configOperationStatus)
        showConfigLog(`输入模式读取成功: ${getInputModeLabel(mode)} (${mode})`)
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showStatus(`读取输入模式失败: ${error.message}`, 'error', configOperationStatus)
      showConfigLog(`读取输入模式失败: ${error.message}`)
    }
  }

  const setInputMode = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      showConfigLog('设备未连接，无法设置输入模式')
      return
    }

    if (!inputModeSelect) {
      showStatus('未找到输入模式选择器', 'error', configOperationStatus)
      return
    }

    const mode = Number.parseInt(inputModeSelect.value, 10)
    if (!Number.isInteger(mode) || mode < 1 || mode > 3) {
      showStatus('请选择有效的输入模式', 'error', configOperationStatus)
      return
    }

    try {
      showStatus('正在设置输入模式...', 'info', configOperationStatus)
      showConfigLog(`正在设置输入模式为: ${getInputModeLabel(mode)} (${mode})`)

      const command = [0x00, CONFIG_COMMANDS.INPUT_MODE_SET, 0x00, mode]
      while (command.length < 63) {
        command.push(0x00)
      }

      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)

      if (response.length >= 4 && response[2] === 0x01) {
        showStatus(`输入模式已设置为: ${getInputModeLabel(mode)}`, 'success', configOperationStatus)
        showConfigLog(`输入模式设置成功: ${getInputModeLabel(mode)} (${mode})`)
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showStatus(`设置输入模式失败: ${error.message}`, 'error', configOperationStatus)
      showConfigLog(`设置输入模式失败: ${error.message}`)
    }
  }

const getSerialNumber = async () => {
    if (!configDevice || !configDevice.opened) {
      showConfigLog('设备未连接，无法读取序列号')
      return null
    }

    try {
      showConfigLog('正在读取序列号...')

      const command = [0x00, CONFIG_COMMANDS.GET_SERIAL_NUMBER, 0x00]
      while (command.length < 63) {
        command.push(0x00)
      }

      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)

      if (response.length >= 15 && response[2] === 0x01) {
        const serialBytes = response.slice(3, 15)
        const serialNumber = Array.from(serialBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()

        cachedSerialNumber = serialNumber
        showConfigLog(`序列号读取成功: ${serialNumber}`)
        return serialNumber
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showConfigLog(`读取序列号失败: ${error.message}`)
      return null
    }
}

  const readDeviceStat = async () => {
    if (!configDevice || !configDevice.opened) {
      showConfigLog('设备未连接')
      stopLeverMonitoring()
      cachedSerialNumber = null
      return
    }

    try {
      showConfigLog('正在读取设备状态...')

      deviceStat.innerHTML = `
        <strong>设备名称:</strong> ${configDevice.productName || '未知'}<br>
        <strong>连接状态:</strong> 已连接<br>
        <strong>序列号:</strong> 正在读取...<br>
        <hr style="margin: 10px 0;">
        <strong>摇杆状态:</strong> 正在读取...
      `

      const serialNumber = await getSerialNumber()

      deviceStat.innerHTML = `
        <strong>设备名称:</strong> ${configDevice.productName || '未知'}<br>
        <strong>连接状态:</strong> 已连接<br>
        <strong>序列号:</strong> ${serialNumber || '读取失败'}<br>
        <hr style="margin: 10px 0;">
        <strong>摇杆状态:</strong> 正在读取...
      `

      await readLeverInfo()
    } catch (error) {
      showConfigLog(`读取设备信息失败: ${error.message}`)
      deviceStat.innerHTML = `
        <strong>设备名称:</strong> ${configDevice.productName || '未知'}<br>
        <strong>状态:</strong> <span style="color: #dc3545;">读取失败</span>
      `
    }
  }

  const resetLever = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      return
    }

    try {
      showStatus('正在重置摇杆...', 'info', configOperationStatus)
      showConfigLog('开始重置设备摇杆...')

      const command = [0x00, CONFIG_COMMANDS.ROLLER_SET_OFFSET, 0x00]
      while (command.length < 63) {
        command.push(0x00)
      }

      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)

      if (response.length >= 4 && response[2] === 0x01) {
        showConfigLog(
          `摇杆重置成功，响应: ${Array.from(response.slice(0, 8))
            .map((x) => x.toString(16).padStart(2, '0'))
            .join(' ')}`
        )
        showStatus('摇杆重置完成', 'success', configOperationStatus)
        showConfigLog('摇杆偏移量已重置到中心位置 (0x8000)')

        setTimeout(() => readLeverInfo(), 500)
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showStatus(`摇杆重置失败: ${error.message}`, 'error', configOperationStatus)
      showConfigLog(`摇杆重置失败: ${error.message}`)
    }
  }

  const sendLedCommand = async (r, g, b) => {
    const command = [
      0x00,
      CONFIG_COMMANDS.LED_SET_MODE,
      0x00,
      0xff,
      0xff,
      0x01,
      0xff,
      r,
      g,
      b,
    ]
    while (command.length < 63) {
      command.push(0x00)
    }

    const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)

    if (response.length >= 3 && response[2] === 0x01) {
      return response
    }

    throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
  }

  const lightTestSequence = [
    { name: '红色', rgb: [0xff, 0x00, 0x00] },
    { name: '绿色', rgb: [0x00, 0xff, 0x00] },
    { name: '蓝色', rgb: [0x00, 0x00, 0xff] },
    { name: '白色', rgb: [0xff, 0xff, 0xff] },
  ]

  const runLightTest = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      return
    }

    try {
      lightTestBtn.disabled = true
      showStatus('正在执行灯光测试...', 'info', configOperationStatus)
      showConfigLog('开始灯光测试: R -> G -> B -> W，每步间隔1秒')

      for (const step of lightTestSequence) {
        const [r, g, b] = step.rgb
        await sendLedCommand(r, g, b)
        showConfigLog(`已切换到${step.name} (${r}, ${g}, ${b})`)
        await delay(1000)
      }

      await delay(3000)
      await sendLedCommand(0x00, 0x00, 0x00)
      showConfigLog('灯光测试完成，已关闭灯光')
      showStatus('灯光测试完成', 'success', configOperationStatus)
    } catch (error) {
      showStatus(`灯光测试失败: ${error.message}`, 'error', configOperationStatus)
      showConfigLog(`灯光测试失败: ${error.message}`)
    } finally {
      lightTestBtn.disabled = false
    }
  }

  const saveConfig = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      return
    }

    try {
      showStatus('正在保存配置...', 'info', configOperationStatus)
      showConfigLog('开始保存设备配置...')

      const command = [0x00, CONFIG_COMMANDS.SAVE_DATA, 0x00]
      while (command.length < 63) {
        command.push(0x00)
      }

      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)

      if (response.length >= 4 && response[2] === 0x01) {
        showConfigLog(
          `配置保存成功，响应: ${Array.from(response.slice(0, 8))
            .map((x) => x.toString(16).padStart(2, '0'))
            .join(' ')}`
        )
        showStatus('配置保存完成', 'success', configOperationStatus)
        showConfigLog('配置已成功保存到设备')
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showStatus(`保存配置失败: ${error.message}`, 'error', configOperationStatus)
      showConfigLog(`保存配置失败: ${error.message}`)
    }
  }

  const cancelConfig = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      return
    }

    try {
      showStatus('正在放弃配置...', 'info', configOperationStatus)
      showConfigLog('开始放弃未保存的配置更改...')

      const command = [0x00, CONFIG_COMMANDS.RELOAD_DATA, 0x00]
      while (command.length < 63) {
        command.push(0x00)
      }

      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)

      if (response.length >= 4 && response[2] === 0x01) {
        showConfigLog(
          `配置放弃成功，响应: ${Array.from(response.slice(0, 8))
            .map((x) => x.toString(16).padStart(2, '0'))
            .join(' ')}`
        )
        showStatus('配置放弃完成', 'success', configOperationStatus)
        showConfigLog('未保存的配置更改已放弃，设备恢复到之前保存的状态')

        setTimeout(() => readLeverInfo(), 500)
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showStatus(`放弃配置失败: ${error.message}`, 'error', configOperationStatus)
      showConfigLog(`放弃配置失败: ${error.message}`)
    }
  }

  const connectConfigDevice = async () => {
    try {
      connectConfigBtn.disabled = true
      showStatus('正在请求配置设备...', 'info', configConnectionStatus)
      showConfigLog('开始连接配置设备...')

      communicator.clearAllRequests()
      cachedSerialNumber = null

      const devices = await navigator.hid.requestDevice({
        filters: [
          {
            vendorId: 0x0ca3,
            productId: 0x0021,
            usagePage: 0xff00,
          },
          {
            vendorId: 0x8088,
            productId: 0x0101,
            usagePage: 0xff00,
          },
        ],
      })

      if (devices.length === 0) {
        throw new Error('未选择设备')
      }

      configDevice = devices[0]
      renderList(configConnectList, devices)

      window.configDevice = configDevice

      await configDevice.open()
      showStatus('配置设备已连接！', 'success', configConnectionStatus)
      showConfigLog(`配置设备已连接: ${configDevice.productName}`)

      communicator.setDevice(configDevice)

      await readDeviceStat()
      showConfigLog('设备连接成功！可以使用"开启实时监控"查看摇杆状态变化')
    } catch (error) {
      showStatus(`连接失败: ${error.message}`, 'error', configConnectionStatus)
      showConfigLog(`配置设备连接失败: ${error.message}`)
      if (configDevice && configDevice.opened) {
        try {
          await configDevice.close()
        } catch (closeError) {
          showConfigLog(`关闭设备时出错: ${closeError.message}`)
        }
      }
      configDevice = null
      cachedSerialNumber = null
      communicator.clearAllRequests()
      stopLeverMonitoring()
    } finally {
      connectConfigBtn.disabled = false
    }
  }

  const bindEvents = () => {
    connectConfigBtn.addEventListener('click', connectConfigDevice)
    resetLeverBtn.addEventListener('click', resetLever)
    readLeverInfoBtn.addEventListener('click', readLeverInfo)
    if (readInputModeBtn) {
      readInputModeBtn.addEventListener('click', readInputMode)
    }
    if (setInputModeBtn) {
      setInputModeBtn.addEventListener('click', setInputMode)
    }
    toggleMonitorBtn.addEventListener('click', toggleLeverMonitoring)
    lightTestBtn.addEventListener('click', runLightTest)
    saveConfigBtn.addEventListener('click', saveConfig)
    cancelConfigBtn.addEventListener('click', cancelConfig)
  }

  return {
    bindEvents,
    stopMonitoring: stopLeverMonitoring,
    getConfigDevice: () => configDevice,
  }
}
