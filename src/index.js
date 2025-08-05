;(async () => {
  // Tab functionality
  const tabButtons = document.querySelectorAll('.tab-button')
  const tabContents = document.querySelectorAll('.tab-content')

  /**
   * Switch to specified tab
   * @param {string} tabName - Name of tab to switch to
   */
  const switchTab = (tabName) => {
    // Update tab buttons
    tabButtons.forEach((button) => {
      if (button.dataset.tab === tabName) {
        button.classList.add('active')
      } else {
        button.classList.remove('active')
      }
    })

    // Update tab contents
    tabContents.forEach((content) => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active')
      } else {
        content.classList.remove('active')
      }
    })

    // showLog(`切换到${tabName === 'firmware' ? '固件刷入' : '设备配置'}标签页`)
  }

  // Add click listeners to tab buttons
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.tab)
    })
  })

  // Firmware tab elements
  /** @type {HTMLInputElement} */
  const connectAndInitBtn = document.getElementById('ConnectAndInit')
  /** @type {HTMLDivElement} */
  const connectionStatus = document.getElementById('ConnectionStatus')

  /** @type {HTMLInputElement} */
  const downloadLatestBtn = document.getElementById('DownloadLatest')
  /** @type {HTMLInputElement} */
  const downloadNightlyBtn = document.getElementById('DownloadNightly')
  /** @type {HTMLDivElement} */
  const downloadStatus = document.getElementById('DownloadStatus')
  /** @type {HTMLDivElement} */
  const latestVersionElement = document.getElementById('LatestVersion')
  /** @type {HTMLDivElement} */
  const nightlyVersionElement = document.getElementById('NightlyVersion')

  /** @type {HTMLInputElement} */
  const fileInput = document.getElementById('FileInput')
  /** @type {HTMLDivElement} */
  const selectedFile = document.getElementById('SelectedFile')
  /** @type {HTMLInputElement} */
  const writeBtn = document.getElementById('WriteFirmeware')
  /** @type {HTMLInputElement} */
  const verifyBtn = document.getElementById('VerifyFirmeware')
  /** @type {HTMLInputElement} */
  const runBtn = document.getElementById('RunFirmeware')

  /** @type {HTMLDivElement} */
  const progressContainer = document.getElementById('ProgressContainer')
  /** @type {HTMLDivElement} */
  const progressFill = document.getElementById('ProgressFill')
  /** @type {HTMLDivElement} */
  const progressText = document.getElementById('ProgressText')
  /** @type {HTMLDivElement} */
  const operationStatus = document.getElementById('OperationStatus')

  /** @type {HTMLUListElement} */
  const connectList = document.getElementById('ConnectedList')
  /** @type {HTMLTextAreaElement} */
  const logBox = document.getElementById('LogBox')

  // Config tab elements
  /** @type {HTMLInputElement} */
  const connectConfigBtn = document.getElementById('ConnectConfigDevice')
  /** @type {HTMLUListElement} */
  const configConnectList = document.getElementById('ConfigConnectedList')
  /** @type {HTMLDivElement} */
  const configConnectionStatus = document.getElementById(
    'ConfigConnectionStatus'
  )
  /** @type {HTMLInputElement} */
  const resetLeverBtn = document.getElementById('ResetLeverBtn')
  /** @type {HTMLInputElement} */
  const readLeverInfoBtn = document.getElementById('ReadLeverInfoBtn')
  /** @type {HTMLInputElement} */
  const toggleMonitorBtn = document.getElementById('ToggleMonitorBtn')
  /** @type {HTMLInputElement} */
  const saveConfigBtn = document.getElementById('SaveConfigBtn')
  /** @type {HTMLInputElement} */
  const cancelConfigBtn = document.getElementById('CancelConfigBtn')
  /** @type {HTMLInputElement} */
  // const resetDeviceBtn = document.getElementById('ResetDevice')
  /** @type {HTMLDivElement} */
  const configOperationStatus = document.getElementById('ConfigOperationStatus')
  /** @type {HTMLDivElement} */
  const deviceStat = document.getElementById('DeviceInfo')
  /** @type {HTMLTextAreaElement} */
  const configLogBox = document.getElementById('ConfigLogBox')

  /** @type {HIDDevice} */
  let activeDevice = null
  /** @type {HIDDevice} */
  let configDevice = null // Device for configuration mode (main firmware)

  let downloadedFirmware = null

  const REPORT_ID = 0xaa
  const CONFIG_REPORT_ID = 0xAA

  // Unified HID communication system
  class HIDCommunicator {
    constructor() {
      this.pendingRequests = new Map() // Map to store pending requests
      this.requestId = 0 // Counter for unique request IDs
      this.device = null // Current device reference
    }

    /**
     * Set the device for this communicator
     * @param {HIDDevice} device - The HID device
     */
    setDevice(device) {
      this.device = device
      if (device && device.opened) {
        // Set up input report listener if not already set
        if (!device._communicatorListenerSet) {
          device.addEventListener('inputreport', (event) => {
            this.handleIncomingReport(event.reportId, new Uint8Array(event.data.buffer))
          })
          device._communicatorListenerSet = true
        }
      }
    }

    /**
     * Send HID report and automatically wait for response
     * @param {number} reportId - Report ID
     * @param {Uint8Array|Array} data - Data to send
     * @param {number} timeout - Timeout in milliseconds (default: 5000)
     * @returns {Promise<Uint8Array>} Promise that resolves with response data
     */
    async send(reportId, data, timeout = 5000) {
      if (!this.device || !this.device.opened) {
        throw new Error('设备未连接或未打开')
      }

      // Convert data to Uint8Array if needed
      const dataArray = data instanceof Uint8Array ? data : new Uint8Array(data)
      
      const requestId = ++this.requestId
      
      return new Promise((resolve, reject) => {
        // Set up timeout
        const timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId)
          reject(new Error(`通信超时 (${timeout}ms) - 报告ID: ${reportId}`))
        }, timeout)

        // Store the request
        this.pendingRequests.set(requestId, {
          resolve,
          reject,
          timeoutId,
          reportId,
          timestamp: Date.now(),
          originalData: dataArray // Store original data for debugging
        })

        // Send the report
        this.device.sendReport(reportId, dataArray)
          .then(() => {
            // Report sent successfully, now waiting for response
            console.debug(`HID报告已发送 (ID: ${reportId}, 请求: ${requestId})`)
          })
          .catch((error) => {
            // Failed to send report
            clearTimeout(timeoutId)
            this.pendingRequests.delete(requestId)
            reject(new Error(`发送报告失败: ${error.message}`))
          })
      })
    }

    /**
     * Handle incoming HID report and automatically resolve pending requests
     * @param {number} reportId - Report ID of incoming data
     * @param {Uint8Array} data - Incoming data
     */
    handleIncomingReport(reportId, data) {
      console.debug(`收到HID报告 (ID: ${reportId}):`, Array.from(data).map(x => x.toString(16).padStart(2, '0')).join(' '))
      
      // Find the oldest pending request for this report ID
      let oldestRequest = null
      let oldestRequestId = null

      for (const [requestId, request] of this.pendingRequests) {
        if (request.reportId === reportId) {
          if (!oldestRequest || request.timestamp < oldestRequest.timestamp) {
            oldestRequest = request
            oldestRequestId = requestId
          }
        }
      }

      if (oldestRequest) {
        // Clear timeout and resolve the promise with response data
        clearTimeout(oldestRequest.timeoutId)
        this.pendingRequests.delete(oldestRequestId)
        console.debug(`匹配到请求 ${oldestRequestId}，自动解析Promise`)
        oldestRequest.resolve(data)
      } else {
        // No pending request found - log as unexpected data
        console.warn(`收到未期望的HID报告 (ID: ${reportId}):`, data)
      }
    }

    /**
     * Clear all pending requests
     */
    clearAllRequests() {
      for (const [requestId, request] of this.pendingRequests) {
        clearTimeout(request.timeoutId)
        request.reject(new Error('通信被中断或设备断开'))
      }
      this.pendingRequests.clear()
      console.debug('已清理所有待处理的HID请求')
    }

    /**
     * Get number of pending requests
     */
    getPendingCount() {
      return this.pendingRequests.size
    }

    /**
     * Get debug information about pending requests
     */
    getDebugInfo() {
      const requests = []
      for (const [requestId, request] of this.pendingRequests) {
        requests.push({
          requestId,
          reportId: request.reportId,
          timestamp: request.timestamp,
          waitingTime: Date.now() - request.timestamp
        })
      }
      return {
        device: this.device ? this.device.productName : 'None',
        pendingCount: this.pendingRequests.size,
        requests
      }
    }
  }

  // Create global communicator instances
  const firmwareCommunicator = new HIDCommunicator()
  const configCommunicator = new HIDCommunicator()

  // Debug function to monitor communication status
  window.getHIDDebugInfo = () => {
    return {
      firmware: firmwareCommunicator.getDebugInfo(),
      config: configCommunicator.getDebugInfo()
    }
  }

  // Real-time lever monitoring
  let leverMonitorInterval = null
  let isMonitoring = false
  
  const startLeverMonitoring = () => {
    if (leverMonitorInterval) {
      clearInterval(leverMonitorInterval)
    }
    isMonitoring = true
    leverMonitorInterval = setInterval(() => {
      if (configDevice && configDevice.opened) {
        readLeverInfo().catch(error => {
          console.warn('实时摇杆监控失败:', error.message)
        })
      }
    }, 0) // Update every second
    showConfigLog('已启动实时摇杆监控')
    if (toggleMonitorBtn) {
      toggleMonitorBtn.value = '停止实时监控'
      toggleMonitorBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
    }
  }

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

  const toggleLeverMonitoring = () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('请先连接配置设备', 'error', configOperationStatus)
      stopLeverMonitoring();
      return
    }
    
    if (isMonitoring) {
      stopLeverMonitoring()
    } else {
      startLeverMonitoring()
    }
  }

  // Firmware URLs
  const FIRMWARE_URLS = {
    latest:
      'https://simdevices-project.github.io/SimGEKI/standard/SimGEKI-SimGETRO_Public.bin',
    nightly:
      'https://simdevices-project.github.io/SimGEKI/nightly/SimGEKI-SimGETRO_Public.bin',
  }

  // GitHub API URLs for version information
  const API_URLS = {
    latest:
      'https://api.github.com/repos/SimDevices-Project/SimGEKI/releases/latest',
    nightly:
      'https://api.github.com/repos/SimDevices-Project/SimGEKI/releases/tags/nightly',
  }

  /**
   * Fetch and display latest version information
   */
  const fetchLatestVersion = async () => {
    try {
      latestVersionElement.className = 'version-value loading'
      latestVersionElement.textContent = '获取中...'

      const response = await fetch(API_URLS.latest)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const version = data.tag_name || '未知版本'

      latestVersionElement.className = 'version-value'
      latestVersionElement.textContent = version
      showLog(`获取到最新版本信息: ${version}`)
    } catch (error) {
      latestVersionElement.className = 'version-value error'
      latestVersionElement.textContent = '获取失败'
      showLog(`获取最新版本信息失败: ${error.message}`)
    }
  }

  /**
   * Fetch and display nightly version information
   */
  const fetchNightlyVersion = async () => {
    try {
      nightlyVersionElement.className = 'version-value loading'
      nightlyVersionElement.textContent = '获取中...'

      const response = await fetch(API_URLS.nightly)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const publishedAt = data.published_at

      if (publishedAt) {
        // Format the date: "2025-07-18T15:23:30Z" -> "2025-07-18 15:23"
        const date = new Date(publishedAt)
        const formattedDate =
          date.getFullYear() +
          '-' +
          String(date.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(date.getDate()).padStart(2, '0') +
          ' ' +
          String(date.getHours()).padStart(2, '0') +
          ':' +
          String(date.getMinutes()).padStart(2, '0')

        nightlyVersionElement.className = 'version-value'
        nightlyVersionElement.textContent = formattedDate
        showLog(`获取到每日构建信息: ${formattedDate}`)
      } else {
        throw new Error('无发布日期信息')
      }
    } catch (error) {
      nightlyVersionElement.className = 'version-value error'
      nightlyVersionElement.textContent = '获取失败'
      showLog(`获取每日构建信息失败: ${error.message}`)
    }
  }

  /**
   * Fetch all version information
   */
  const fetchVersionInfo = async () => {
    await Promise.all([fetchLatestVersion(), fetchNightlyVersion()])
  }

  /**
   * Show/hide progress bar
   * @param {boolean} show
   */
  const toggleProgress = (show) => {
    progressContainer.style.display = show ? 'block' : 'none'
    if (!show) {
      updateProgress(0, '')
    }
  }

  /**
   * Update progress bar
   * @param {number} percent
   * @param {string} text
   */
  const updateProgress = (percent, text) => {
    progressFill.style.width = `${percent}%`
    progressText.textContent = text || `${Math.round(percent)}%`
  }

  let timer = null
  /**
   * Show status message
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   * @param {HTMLElement} element
   */
  const showStatus = (message, type = 'info', element = operationStatus) => {
    element.className = `status ${type}`
    element.textContent = message
    element.style.display = 'block'
    clearTimeout(timer)
    timer = setTimeout(() => {
      element.style.display = 'none'
    }, 8000)
  }

  /**
   * Disable all buttons except the specified one during critical operations

   */
  const disableAllButtons = () => {
    const buttons = [
      connectAndInitBtn,
      downloadLatestBtn,
      downloadNightlyBtn,
      writeBtn,
      verifyBtn,
      runBtn,
      connectConfigBtn,
      resetLeverBtn,
      resetLeverBtn,
    ]
    buttons.forEach((button) => {
      button.disabled = true
    })
  }

  /**
   * Enable all buttons after critical operations complete
   */
  const enableAllButtons = () => {
    const buttons = [
      connectAndInitBtn,
      downloadLatestBtn,
      downloadNightlyBtn,
      writeBtn,
      verifyBtn,
      runBtn,
      connectConfigBtn,
      resetLeverBtn,
      resetLeverBtn,
    ]
    buttons.forEach((button) => {
      button.disabled = false
    })
  }

  /**
   * Download firmware from URL
   * @param {string} url
   * @param {string} name
   */
  const downloadFirmware = async (url, name) => {
    try {
      downloadLatestBtn.disabled = true
      downloadNightlyBtn.disabled = true

      showStatus(`正在下载${name}固件...`, 'info', downloadStatus)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const contentLength = +response.headers.get('Content-Length')
      let receivedLength = 0
      let chunks = []

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        chunks.push(value)
        receivedLength += value.length

        if (contentLength) {
          const percent = (receivedLength / contentLength) * 100
          showStatus(
            `正在下载${name}固件... ${Math.round(percent)}%`,
            'info',
            downloadStatus
          )
        }
      }

      downloadedFirmware = new Uint8Array(receivedLength)
      let position = 0
      for (let chunk of chunks) {
        downloadedFirmware.set(chunk, position)
        position += chunk.length
      }

      showStatus(
        `${name}固件下载完成！大小: ${(receivedLength / 1024).toFixed(2)} KB`,
        'success',
        downloadStatus
      )
      selectedFile.textContent = `已下载: ${name}固件 (${(
        receivedLength / 1024
      ).toFixed(2)} KB)`
      showLog(`${name}固件下载完成，大小: ${receivedLength} 字节`)
    } catch (error) {
      // Check if it's a CORS error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showStatus(
          `下载失败：CORS错误。请手动下载固件文件：${url}`,
          'error',
          downloadStatus
        )
        showLog(
          `CORS错误：无法从 ${url} 下载固件。请手动下载后使用"选择文件"功能。`
        )

        // Show user-friendly instructions
        setTimeout(() => {
          if (
            confirm(
              '由于浏览器安全限制，无法直接下载固件。是否打开GitHub下载页面？'
            )
          ) {
            window.open(url, '_blank')
          }
        }, 1000)
      } else {
        showStatus(`下载失败: ${error.message}`, 'error', downloadStatus)
        showLog(`固件下载失败: ${error.message}`)
      }
    } finally {
      downloadLatestBtn.disabled = false
      downloadNightlyBtn.disabled = false
    }
  }

  /**
   *
   * @param {HTMLLIElement} dom
   * @param {HIDDevice[]} list
   */
  const showList = (dom, list) => {
    dom.innerHTML = ''
    list.forEach((device) => {
      const li = document.createElement('li')
      li.textContent = device.productName
      // li.addEventListener('click', () => {
      //   if (activeDevice) {
      //     activeDevice.close()
      //   }
      //   activeDevice = device
      //   connectDevice()
      // })
      dom.appendChild(li)
    })
  }

  const showLog = (message) => {
    logBox.value += message + '\n'
    logBox.scrollTop = logBox.scrollHeight
  }

  const showConfigLog = (message) => {
    configLogBox.value += message + '\n'
    configLogBox.scrollTop = configLogBox.scrollHeight
  }

  /**
   * Send report to firmware device and automatically wait for response
   * @param {number} reportID - Report ID
   * @param {Uint8Array|Array} data - Data to send
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Uint8Array>} Response data
   */
  const sendReportAndWait = async (reportID, data, timeout = 5000) => {
    return await firmwareCommunicator.send(reportID, data, timeout)
  }

  /**
   * Send report to config device and automatically wait for response
   * @param {number} reportID - Report ID
   * @param {Uint8Array|Array} data - Data to send
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Uint8Array>} Response data
   */
  const sendConfigReportAndWait = async (reportID, data, timeout = 5000) => {
    return await configCommunicator.send(reportID, data, timeout)
  }

  const writeFirmeware = async () => {
    let firmwareData = null
    let fileName = ''

    // Check if we have downloaded firmware or local file
    if (downloadedFirmware) {
      firmwareData = downloadedFirmware
      fileName = '下载的固件'
    } else if (fileInput.files.length > 0) {
      const file = fileInput.files[0]
      const reader = new FileReader()
      fileName = file.name

      await new Promise((resolve, reject) => {
        reader.onload = () => {
          firmwareData = new Uint8Array(reader.result)
          resolve()
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      })
    } else {
      showStatus('请先选择固件文件或下载固件', 'error')
      return
    }

    if (!activeDevice || !activeDevice.opened) {
      showStatus('请先连接设备并初始化', 'error')
      return
    }

    try {
      // Disable all buttons except the write button during firmware write operation
      disableAllButtons()
      toggleProgress(true)
      showStatus('正在烧入固件...', 'info')

      const totalLength = firmwareData.length
      const chunkSize = 61
      let writtenBytes = 0

      for (let i = 0; i < totalLength; i += chunkSize) {
        const dataToSend = firmwareData.slice(i, i + chunkSize)
        const command = [0xa2, chunkSize, ...dataToSend]
        
        // Send chunk and wait for response
        const response = await sendReportAndWait(REPORT_ID, command)
        
        // Verify response (you can add specific response validation here)
        if (response.length === 0) {
          throw new Error(`写入块 ${Math.floor(i / chunkSize) + 1} 时未收到响应`)
        }

        writtenBytes += dataToSend.length
        const percent = (writtenBytes / totalLength) * 100
        updateProgress(percent, `烧入中: ${Math.round(percent)}%`)
      }

      // Send completion command and wait for response
      await sendReportAndWait(REPORT_ID, [0xa3])
      
      updateProgress(100, '烧入完成')
      showStatus(`固件烧入完成: ${fileName}`, 'success')
      showLog(`固件烧入完成: ${fileName}`)
    } catch (error) {
      showStatus(`烧入失败: ${error.message}`, 'error')
      showLog(`固件烧入失败: ${error.message}`)
    } finally {
      // Re-enable all buttons after operation completes
      enableAllButtons()
      setTimeout(() => toggleProgress(false), 2000)
    }
  }

  const verifyFirmeware = async () => {
    let firmwareData = null
    let fileName = ''

    // Check if we have downloaded firmware or local file
    if (downloadedFirmware) {
      firmwareData = downloadedFirmware
      fileName = '下载的固件'
    } else if (fileInput.files.length > 0) {
      const file = fileInput.files[0]
      const reader = new FileReader()
      fileName = file.name

      await new Promise((resolve, reject) => {
        reader.onload = () => {
          firmwareData = new Uint8Array(reader.result)
          resolve()
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      })
    } else {
      showStatus('请先选择固件文件或下载固件', 'error')
      return
    }

    if (!activeDevice || !activeDevice.opened) {
      showStatus('请先连接设备并初始化', 'error')
      return
    }

    try {
      // Disable all buttons except the verify button during firmware verification operation
      disableAllButtons()
      toggleProgress(true)
      showStatus('正在验证固件...', 'info')

      const totalLength = firmwareData.length
      const chunkSize = 61
      let verifiedBytes = 0
      let state_OK = true

      for (let i = 0; i < totalLength; i += chunkSize) {
        const dataToSend = firmwareData.slice(i, i + chunkSize)
        const command = [0xa4, chunkSize, ...dataToSend]
        
        // Send verification chunk and wait for response
        const response = await sendReportAndWait(REPORT_ID, command)
        
        // Check verification result from response
        if (response.length < 3 || response[1] !== 0x01) {
          state_OK = false
          showLog(`验证失败在块 ${Math.floor(i / chunkSize) + 1}, 响应: ${Array.from(response).map(x => x.toString(16).padStart(2, '0')).join(' ')}`)
        }

        verifiedBytes += dataToSend.length
        const percent = (verifiedBytes / totalLength) * 100
        updateProgress(percent, `验证中: ${Math.round(percent)}%`)
      }

      // Send verification completion command and wait for response
      await sendReportAndWait(REPORT_ID, [0xa5])
      
      updateProgress(100, state_OK ? '验证通过' : '验证失败')
      showStatus(
        `固件验证${state_OK ? '通过' : '失败'}: ${fileName}`,
        state_OK ? 'success' : 'error'
      )
      showLog(`固件验证${state_OK ? '通过' : '失败'}: ${fileName}`)
    } catch (error) {
      showStatus(`验证失败: ${error.message}`, 'error')
      showLog(`固件验证失败: ${error.message}`)
    } finally {
      // Re-enable all buttons after operation completes
      enableAllButtons()
      setTimeout(() => toggleProgress(false), 2000)
    }
  }

  const runFirmeware = async () => {
    if (!activeDevice || !activeDevice.opened) {
      showStatus('设备未连接', 'error')
      return
    }
    
    try {
      const data = [0xf0]
      // Pad the array to 63 bytes total
      while (data.length < 63) {
        data.push(0)
      }
      
      await sendReportAndWait(REPORT_ID, data)
      showLog('已发送跳转程序指令，准备切换到设备配置模式')

      // Switch to config tab after a short delay
      setTimeout(() => {
        switchTab('config')
        showConfigLog('已从固件刷入模式切换，准备连接设备配置模式')
      }, 1000)
    } catch (error) {
      showStatus(`跳转失败: ${error.message}`, 'error')
      showLog(`跳转程序失败: ${error.message}`)
    }
  }

  /**
   * Unified function to request device, connect, and initialize IAP
   */
  const connectAndInitialize = async () => {
    try {
      connectAndInitBtn.disabled = true
      showStatus('正在请求设备...', 'info', connectionStatus)
      showLog('开始连接设备流程...')

      // Clear any pending requests from previous connections
      firmwareCommunicator.clearAllRequests()

      // Step 1: Request devices
      const devices = await navigator.hid.requestDevice({
        filters: [
          {
            vendorId: 0x8088,
            productId: 0x00fe,
          },
        ],
      })

      if (devices.length === 0) {
        throw new Error('未选择任何设备')
      }

      activeDevice = devices[0]
      showList(connectList, devices)
      showStatus('设备已选择，正在连接...', 'info', connectionStatus)
      showLog(`设备已选择: ${activeDevice.productName}`)

      // Step 2: Connect to device
      if (activeDevice.opened) {
        await activeDevice.close()
      }

      await activeDevice.open()
      showStatus('设备已连接，正在初始化IAP...', 'info', connectionStatus)
      showLog(`设备已连接: ${activeDevice.productName}`)

      // Step 3: Set up automatic communication
      firmwareCommunicator.setDevice(activeDevice)

      // Step 4: Initialize IAP with automatic response handling
      const data = [0xa1]
      // Pad the array to 63 bytes total
      while (data.length < 63) {
        data.push(0)
      }
      
      const response = await sendReportAndWait(REPORT_ID, data, 5000)
      
      showStatus('设备连接并初始化完成！', 'success', connectionStatus)
      showLog('IAP初始化完成，设备准备就绪')
      showLog(`初始化响应: ${Array.from(response).map(x => x.toString(16).padStart(2, '0')).join(' ')}`)
    } catch (error) {
      showStatus(`连接失败: ${error.message}`, 'error', connectionStatus)
      showLog(`设备连接失败: ${error.message}`)
      if (activeDevice && activeDevice.opened) {
        try {
          await activeDevice.close()
        } catch (closeError) {
          showLog(`关闭设备时出错: ${closeError.message}`)
        }
      }
      activeDevice = null
      firmwareCommunicator.clearAllRequests()
    } finally {
      connectAndInitBtn.disabled = false
    }
  }

  /**
   * Connect to device in configuration mode (main firmware)
   */
  const connectConfigDevice = async () => {
    try {
      connectConfigBtn.disabled = true
      showStatus('正在请求配置设备...', 'info', configConnectionStatus)
      showConfigLog('开始连接配置设备...')

      // Clear any pending requests from previous connections
      configCommunicator.clearAllRequests()

      // Request device with different PID for main firmware
      const devices = await navigator.hid.requestDevice({
        filters: [
          {
            vendorId: 0x0ca3,
            productId: 0x0021, // Different PID for main firmware
            usagePage: 0xff00, // Custom usage page for main firmware
          },
          {
            vendorId: 0x8088,
            productId: 0x0101, // PID for SimGEKI main firmware (0x0101, in none SG mode)
            usagePage: 0xff00, // Custom usage page for main firmware
          }
        ],
      })

      if (devices.length === 0) {
        throw new Error('未选择设备')
      }

      configDevice = devices[0]
      showList(configConnectList, devices)

      window.configDevice = configDevice // Make it globally accessible for debugging

      await configDevice.open()
      showStatus('配置设备已连接！', 'success', configConnectionStatus)
      showConfigLog(`配置设备已连接: ${configDevice.productName}`)

      // Set up automatic communication for config device
      configCommunicator.setDevice(configDevice)

      // Read device information
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
      configCommunicator.clearAllRequests()
      stopLeverMonitoring()
    } finally {
      connectConfigBtn.disabled = false
    }
  }

  /**
   * Read device information and configuration
   */
  const readDeviceStat = async () => {
    if (!configDevice || !configDevice.opened) {
      showConfigLog('设备未连接')
      stopLeverMonitoring()
      return
    }

    try {
      showConfigLog('正在读取设备状态...')
      
      // 首先显示基本设备信息
      deviceStat.innerHTML = `
        <strong>设备名称:</strong> ${configDevice.productName || '未知'}<br>
        <strong>连接状态:</strong> 已连接<br>
        <strong>摇杆状态:</strong> 正在读取...
      `
      
      // 然后读取摇杆信息
      await readLeverInfo()
      
    } catch (error) {
      showConfigLog(`读取设备信息失败: ${error.message}`)
      deviceStat.innerHTML = `
        <strong>设备名称:</strong> ${configDevice.productName || '未知'}<br>
        <strong>状态:</strong> <span style="color: #dc3545;">读取失败</span>
      `
    }
  }

  /**
   * Reset device lever
   */
  const resetLever = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      return
    }

    try {
      showStatus('正在重置摇杆...', 'info', configOperationStatus)
      showConfigLog('开始重置设备摇杆...')

      // Send lever reset command (ROLLER_SET_OFFSET = 0xA0)
      // Protocol: [Report ID, Symbol, Command, Unused, ...Payload]
      const command = [0x00, 0xA0, 0x00]
      // Pad to 64 bytes
      while (command.length < 63) {
        command.push(0x00)
      }
      
      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)
      
      // Check response: [Report ID, Symbol, Command, State, ...Payload]
      if (response.length >= 4 && response[2] === 0x01) { // STATE_OK = 0x01
        showConfigLog(`摇杆重置成功，响应: ${Array.from(response.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`)
        showStatus('摇杆重置完成', 'success', configOperationStatus)
        showConfigLog('摇杆偏移量已重置到中心位置 (0x8000)')
        
        // 重置后立即读取摇杆信息
        setTimeout(() => readLeverInfo(), 500)
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showStatus(
        `摇杆重置失败: ${error.message}`,
        'error',
        configOperationStatus
      )
      showConfigLog(`摇杆重置失败: ${error.message}`)
    }
  }

  /**
   * Read lever information and display status
   */
  const readLeverInfo = async () => {
    if (!configDevice || !configDevice.opened) {
      showConfigLog('设备未连接，无法读取摇杆信息')
      return
    }

    try {
      showConfigLog('正在读取摇杆信息...')
      
      // Send lever data request command (ROLLER_GET_DATA = 0xA1)
      // Protocol: [Report ID, Symbol, Command, Unused, ...Payload]
      const command = [0x00, 0xA1, 0x00]
      // Pad to 64 bytes
      while (command.length < 63) {
        command.push(0x00)
      }
      
      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)
      
      // Check response: [Report ID, Symbol, Command, State, ...Payload]
      if (response.length >= 8 && response[2] === 0x01) { // STATE_OK = 0x00
        // Extract roller data from response
        // Payload structure based on hidconfig.c:
        // - 2 bytes: Roller value (processed value)  
        // - 2 bytes: Roller raw value (raw reading)
        const rollerValue = (response[4] << 8) | response[3] // Little endian
        const rollerRawValue = (response[6] << 8) | response[5] // Little endian
        
        // Update device status display
        const centerValue = 0x8000 // 32768
        const deviation = rollerValue - centerValue
        const deviationPercent = ((deviation / centerValue) * 100).toFixed(1)
        
        deviceStat.innerHTML = `
          <strong>设备名称:</strong> ${configDevice.productName || '未知'}<br>
          <strong>连接状态:</strong> 已连接<br>
          <hr style="margin: 10px 0;">
          <strong>摇杆状态:</strong><br>
          <div style="margin-left: 15px;">
            <strong>处理值:</strong> ${rollerValue} (0x${rollerValue.toString(16).padStart(4, '0')})<br>
            <strong>原始值:</strong> ${rollerRawValue} (0x${rollerRawValue.toString(16).padStart(4, '0')})<br>
            <strong>偏移量:</strong> ${deviation > 0 ? '+' : ''}${deviation} (${deviationPercent > 0 ? '+' : ''}${deviationPercent}%)<br>
            <strong>位置:</strong> ${getPositionDescription(rollerValue, centerValue)}
          </div>
        `
        
        showConfigLog(`摇杆数据读取成功:`)
        showConfigLog(`  处理值: ${rollerValue} (0x${rollerValue.toString(16).padStart(4, '0')})`)
        showConfigLog(`  原始值: ${rollerRawValue} (0x${rollerRawValue.toString(16).padStart(4, '0')})`)
        showConfigLog(`  偏移: ${deviation} (${deviationPercent}%)`)
        
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showConfigLog(`读取摇杆信息失败: ${error.message}`)
      deviceStat.innerHTML = `<br><strong style="color: #dc3545;">摇杆状态:</strong> 读取失败`
    }
  }

  /**
   * Get position description based on roller value
   * @param {number} value - Current roller value
   * @param {number} center - Center value (0x8000)
   * @returns {string} Position description
   */
  const getPositionDescription = (value, center) => {
    const deviation = Math.abs(value - center)
    const threshold1 = center * 0.1  // 10% threshold
    const threshold2 = center * 0.3  // 30% threshold
    
    if (deviation < threshold1) {
      return '🎯 中心位置'
    } else if (deviation < threshold2) {
      return value > center ? '↗️ 轻微右偏' : '↖️ 轻微左偏'
    } else {
      return value > center ? '➡️ 明显右偏' : '⬅️ 明显左偏'
    }
  }

  /**
   * Save device configuration
   */
  const saveConfig = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      return
    }

    try {
      showStatus('正在保存配置...', 'info', configOperationStatus)
      showConfigLog('开始保存设备配置...')

      // Send save config command (0x81)
      // Protocol: [Report ID, Symbol, Command, Unused, ...Payload]
      const command = [0x00, 0x81, 0x00]
      // Pad to 64 bytes
      while (command.length < 63) {
        command.push(0x00)
      }
      
      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)
      
      // Check response: [Report ID, Symbol, Command, State, ...Payload]
      if (response.length >= 4 && response[2] === 0x01) { // STATE_OK = 0x01
        showConfigLog(`配置保存成功，响应: ${Array.from(response.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`)
        showStatus('配置保存完成', 'success', configOperationStatus)
        showConfigLog('配置已成功保存到设备')
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showStatus(
        `保存配置失败: ${error.message}`,
        'error',
        configOperationStatus
      )
      showConfigLog(`保存配置失败: ${error.message}`)
    }
  }

  /**
   * Cancel configuration changes (discard unsaved changes)
   */
  const cancelConfig = async () => {
    if (!configDevice || !configDevice.opened) {
      showStatus('设备未连接', 'error', configOperationStatus)
      return
    }

    try {
      showStatus('正在放弃配置...', 'info', configOperationStatus)
      showConfigLog('开始放弃未保存的配置更改...')

      // Send cancel config command (0x80)
      // Protocol: [Report ID, Symbol, Command, Unused, ...Payload]
      const command = [0x00, 0x80, 0x00]
      // Pad to 64 bytes
      while (command.length < 63) {
        command.push(0x00)
      }
      
      const response = await sendConfigReportAndWait(CONFIG_REPORT_ID, command)
      
      // Check response: [Report ID, Symbol, Command, State, ...Payload]
      if (response.length >= 4 && response[2] === 0x01) { // STATE_OK = 0x01
        showConfigLog(`配置放弃成功，响应: ${Array.from(response.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join(' ')}`)
        showStatus('配置放弃完成', 'success', configOperationStatus)
        showConfigLog('未保存的配置更改已放弃，设备恢复到之前保存的状态')
        
        // 放弃配置后立即读取摇杆信息以确认状态
        setTimeout(() => readLeverInfo(), 500)
      } else {
        throw new Error(`设备返回错误状态: ${response[2] ? response[2].toString(16) : '未知'}`)
      }
    } catch (error) {
      showStatus(
        `放弃配置失败: ${error.message}`,
        'error',
        configOperationStatus
      )
      showConfigLog(`放弃配置失败: ${error.message}`)
    }
  }

  // Event listeners
  connectAndInitBtn.addEventListener('click', connectAndInitialize)

  downloadLatestBtn.addEventListener('click', () =>
    downloadFirmware(FIRMWARE_URLS.latest, '最新版')
  )
  downloadNightlyBtn.addEventListener('click', () =>
    downloadFirmware(FIRMWARE_URLS.nightly, '每日构建')
  )

  fileInput.addEventListener('change', (event) => {
    downloadedFirmware = null // Clear downloaded firmware when local file is selected
    if (event.target.files.length > 0) {
      const file = event.target.files[0]
      selectedFile.textContent = `已选择: ${file.name} (${(
        file.size / 1024
      ).toFixed(2)} KB)`
    } else {
      selectedFile.textContent = ''
    }
  })

  writeBtn.addEventListener('click', writeFirmeware)
  verifyBtn.addEventListener('click', verifyFirmeware)
  runBtn.addEventListener('click', runFirmeware)

  // Config tab event listeners
  connectConfigBtn.addEventListener('click', connectConfigDevice)
  resetLeverBtn.addEventListener('click', resetLever)
  readLeverInfoBtn.addEventListener('click', readLeverInfo)
  toggleMonitorBtn.addEventListener('click', toggleLeverMonitoring)
  saveConfigBtn.addEventListener('click', saveConfig)
  cancelConfigBtn.addEventListener('click', cancelConfig)

  // Fetch version information when page loads
  fetchVersionInfo()

  // Stop monitoring when page unloads
  window.addEventListener('beforeunload', () => {
    stopLeverMonitoring()
  })
})()
