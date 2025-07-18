;(async () => {
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

  let activeDevice = null

  let isDataReceived = false
  let ReceivedData = new Uint8Array([])
  let downloadedFirmware = null

  const REPORT_ID = 0xaa

  // Firmware URLs
  const FIRMWARE_URLS = {
    latest: 'https://simdevices-project.github.io/SimGEKI/standard/SimGEKI-SimGETRO_Public.bin',
    nightly: 'https://simdevices-project.github.io/SimGEKI/nightly/SimGEKI-SimGETRO_Public.bin'
  }

  // GitHub API URLs for version information
  const API_URLS = {
    latest: 'https://api.github.com/repos/SimDevices-Project/SimGEKI/releases/latest',
    nightly: 'https://api.github.com/repos/SimDevices-Project/SimGEKI/releases/tags/nightly'
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
        const formattedDate = date.getFullYear() + '-' + 
          String(date.getMonth() + 1).padStart(2, '0') + '-' + 
          String(date.getDate()).padStart(2, '0') + ' ' +
          String(date.getHours()).padStart(2, '0') + ':' + 
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
    await Promise.all([
      fetchLatestVersion(),
      fetchNightlyVersion()
    ])
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
    const buttons = [connectAndInitBtn, downloadLatestBtn, downloadNightlyBtn, writeBtn, verifyBtn, runBtn]
    buttons.forEach(button => {
      button.disabled = true
    })
  }

  /**
   * Enable all buttons after critical operations complete
   */
  const enableAllButtons = () => {
    const buttons = [connectAndInitBtn, downloadLatestBtn, downloadNightlyBtn, writeBtn, verifyBtn, runBtn, fileInput]
    buttons.forEach(button => {
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
          showStatus(`正在下载${name}固件... ${Math.round(percent)}%`, 'info', downloadStatus)
        }
      }
      
      downloadedFirmware = new Uint8Array(receivedLength)
      let position = 0
      for (let chunk of chunks) {
        downloadedFirmware.set(chunk, position)
        position += chunk.length
      }
      
      showStatus(`${name}固件下载完成！大小: ${(receivedLength / 1024).toFixed(2)} KB`, 'success', downloadStatus)
      selectedFile.textContent = `已下载: ${name}固件 (${(receivedLength / 1024).toFixed(2)} KB)`
      showLog(`${name}固件下载完成，大小: ${receivedLength} 字节`)
      
    } catch (error) {
      // Check if it's a CORS error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showStatus(`下载失败：CORS错误。请手动下载固件文件：${url}`, 'error', downloadStatus)
        showLog(`CORS错误：无法从 ${url} 下载固件。请手动下载后使用"选择文件"功能。`)
        
        // Show user-friendly instructions
        setTimeout(() => {
          if (confirm('由于浏览器安全限制，无法直接下载固件。是否打开GitHub下载页面？')) {
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

  const onReport = (reportID, data) => {
    showLog(`Received report: ${reportID}\n${new Uint8Array(data.buffer)}`)
    isDataReceived = true
    ReceivedData = new Uint8Array(data.buffer)
  }

  const sendReport = async (reportID, data) => {
    if (activeDevice === null || !activeDevice.opened) {
      return
    }
    await activeDevice.sendReport(reportID, new Uint8Array(data))
    showLog(`Sent report: ${reportID}\n${new Uint8Array(data)}`)
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
    
    if (isDataReceived === false) {
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
        await sendReport(REPORT_ID, [0xa2, chunkSize, ...dataToSend])
        
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            if (isDataReceived) {
              isDataReceived = false
              clearInterval(interval)
              resolve()
            }
          }, 1)
        })
        
        writtenBytes += dataToSend.length
        const percent = (writtenBytes / totalLength) * 100
        updateProgress(percent, `烧入中: ${Math.round(percent)}%`)
      }
      
      await sendReport(REPORT_ID, [0xa3])
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
    
    if (isDataReceived === false) {
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
        await sendReport(REPORT_ID, [0xa4, chunkSize, ...dataToSend])
        
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            if (isDataReceived) {
              isDataReceived = false
              clearInterval(interval)
              if (ReceivedData[2] !== 0x00) {
                state_OK = false
              }
              resolve()
            }
          }, 1)
        })
        
        verifiedBytes += dataToSend.length
        const percent = (verifiedBytes / totalLength) * 100
        updateProgress(percent, `验证中: ${Math.round(percent)}%`)
      }
      
      await sendReport(REPORT_ID, [0xa5])
      updateProgress(100, state_OK ? '验证通过' : '验证失败')
      showStatus(`固件验证${state_OK ? '通过' : '失败'}: ${fileName}`, state_OK ? 'success' : 'error')
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
    if (activeDevice === null || !activeDevice.opened) {
      return
    }
    const data = new Uint8Array([0xF0], 0, 63)
    sendReport(REPORT_ID, data)
  }

  /**
   * Unified function to request device, connect, and initialize IAP
   */
  const connectAndInitialize = async () => {
    try {
      connectAndInitBtn.disabled = true
      showStatus('正在请求设备...', 'info', connectionStatus)
      showLog('开始连接设备流程...')
      
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
      
      activeDevice.addEventListener('inputreport', (event) => {
        onReport(event.reportId, event.data)
      })
      
      // Step 3: Initialize IAP
      const data = new Uint8Array([0xa1], 0, 63)
      await sendReport(REPORT_ID, data)
      
      // Wait for IAP initialization response
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('IAP初始化超时'))
        }, 5000)
        
        const interval = setInterval(() => {
          if (isDataReceived) {
            clearTimeout(timeout)
            clearInterval(interval)
            resolve()
          }
        }, 100)
      })
      
      showStatus('设备连接并初始化完成！', 'success', connectionStatus)
      showLog('IAP初始化完成，设备准备就绪')
      
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
    } finally {
      connectAndInitBtn.disabled = false
    }
  }

  // Event listeners
  connectAndInitBtn.addEventListener('click', connectAndInitialize)
  
  downloadLatestBtn.addEventListener('click', () => downloadFirmware(FIRMWARE_URLS.latest, '最新版'))
  downloadNightlyBtn.addEventListener('click', () => downloadFirmware(FIRMWARE_URLS.nightly, '每日构建'))
  
  fileInput.addEventListener('change', (event) => {
    downloadedFirmware = null // Clear downloaded firmware when local file is selected
    if (event.target.files.length > 0) {
      const file = event.target.files[0]
      selectedFile.textContent = `已选择: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
    } else {
      selectedFile.textContent = ''
    }
  })
  
  writeBtn.addEventListener('click', writeFirmeware)
  verifyBtn.addEventListener('click', verifyFirmeware)
  runBtn.addEventListener('click', runFirmeware)

  // Fetch version information when page loads
  fetchVersionInfo()
})()
