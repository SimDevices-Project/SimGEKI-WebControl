import {
  API_URLS,
  FIRMWARE_CHUNK_SIZE,
  FIRMWARE_URLS,
  HID_TIMEOUT,
  REPORT_ID,
} from '../constants'

export const createFirmwareController = ({
  elements,
  communicator,
  showStatus,
  progress,
  showLog,
  renderList,
  switchToConfigTab,
  lockButtons,
}) => {
  let activeDevice = null
  let downloadedFirmware = null

  const {
    connectAndInitBtn,
    connectionStatus,
    downloadLatestBtn,
    downloadNightlyBtn,
    downloadStatus,
    latestVersionElement,
    nightlyVersionElement,
    fileInput,
    selectedFile,
    writeBtn,
    verifyBtn,
    runBtn,
    progressContainer,
    progressFill,
    progressText,
    operationStatus,
    connectList,
  } = elements

  const disableButtons = () => {
    lockButtons.forEach((button) => {
      if (button) {
        button.disabled = true
      }
    })
  }

  const enableButtons = () => {
    lockButtons.forEach((button) => {
      if (button) {
        button.disabled = false
      }
    })
  }

  const sendReportAndWait = (reportId, data, timeout = HID_TIMEOUT) =>
    communicator.send(reportId, data, timeout)

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

  const fetchVersionInfo = async () => {
    await Promise.all([fetchLatestVersion(), fetchNightlyVersion()])
  }

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
      const chunks = []

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
      for (const chunk of chunks) {
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
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showStatus(
          `下载失败：CORS错误。请手动下载固件文件：${url}`,
          'error',
          downloadStatus
        )
        showLog(
          `CORS错误：无法从 ${url} 下载固件。请手动下载后使用"选择文件"功能。`
        )

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

  const renderSelectedFile = (file) => {
    if (file) {
      selectedFile.textContent = `已选择: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`
    } else {
      selectedFile.textContent = ''
    }
  }

  const getFirmwareData = async () => {
    let firmwareData = null
    let fileName = ''

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
    }

    return { firmwareData, fileName }
  }

  const writeFirmware = async () => {
    const { firmwareData, fileName } = await getFirmwareData()

    if (!firmwareData) {
      showStatus('请先选择固件文件或下载固件', 'error', operationStatus)
      return
    }

    if (!activeDevice || !activeDevice.opened) {
      showStatus('请先连接设备并初始化', 'error', operationStatus)
      return
    }

    try {
      disableButtons()
      progress.show()
      showStatus('正在烧入固件...', 'info', operationStatus)

      const totalLength = firmwareData.length
      let writtenBytes = 0

      for (let i = 0; i < totalLength; i += FIRMWARE_CHUNK_SIZE) {
        const dataToSend = firmwareData.slice(i, i + FIRMWARE_CHUNK_SIZE)
        const command = [0xa2, FIRMWARE_CHUNK_SIZE, ...dataToSend]

        const response = await sendReportAndWait(REPORT_ID, command)
        if (response.length === 0) {
          throw new Error(`写入块 ${Math.floor(i / FIRMWARE_CHUNK_SIZE) + 1} 时未收到响应`)
        }

        writtenBytes += dataToSend.length
        const percent = (writtenBytes / totalLength) * 100
        progress.update(percent, `烧入中: ${Math.round(percent)}%`)
      }

      await sendReportAndWait(REPORT_ID, [0xa3])

      progress.update(100, '烧入完成')
      showStatus(`固件烧入完成: ${fileName}`, 'success', operationStatus)
      showLog(`固件烧入完成: ${fileName}`)
    } catch (error) {
      showStatus(`烧入失败: ${error.message}`, 'error', operationStatus)
      showLog(`固件烧入失败: ${error.message}`)
    } finally {
      enableButtons()
      setTimeout(() => progress.hide(), 2000)
    }
  }

  const verifyFirmware = async () => {
    const { firmwareData, fileName } = await getFirmwareData()

    if (!firmwareData) {
      showStatus('请先选择固件文件或下载固件', 'error', operationStatus)
      return
    }

    if (!activeDevice || !activeDevice.opened) {
      showStatus('请先连接设备并初始化', 'error', operationStatus)
      return
    }

    try {
      disableButtons()
      progress.show()
      showStatus('正在验证固件...', 'info', operationStatus)

      const totalLength = firmwareData.length
      let verifiedBytes = 0
      let stateOK = true

      for (let i = 0; i < totalLength; i += FIRMWARE_CHUNK_SIZE) {
        const dataToSend = firmwareData.slice(i, i + FIRMWARE_CHUNK_SIZE)
        const command = [0xa4, FIRMWARE_CHUNK_SIZE, ...dataToSend]

        const response = await sendReportAndWait(REPORT_ID, command)

        if (response.length < 3 || response[1] !== 0x01) {
          stateOK = false
          showLog(
            `验证失败在块 ${Math.floor(i / FIRMWARE_CHUNK_SIZE) + 1}, 响应: ${Array.from(response)
              .map((x) => x.toString(16).padStart(2, '0'))
              .join(' ')}`
          )
        }

        verifiedBytes += dataToSend.length
        const percent = (verifiedBytes / totalLength) * 100
        progress.update(percent, `验证中: ${Math.round(percent)}%`)
      }

      await sendReportAndWait(REPORT_ID, [0xa5])

      progress.update(100, stateOK ? '验证通过' : '验证失败')
      showStatus(
        `固件验证${stateOK ? '通过' : '失败'}: ${fileName}`,
        stateOK ? 'success' : 'error',
        operationStatus
      )
      showLog(`固件验证${stateOK ? '通过' : '失败'}: ${fileName}`)
    } catch (error) {
      showStatus(`验证失败: ${error.message}`, 'error', operationStatus)
      showLog(`固件验证失败: ${error.message}`)
    } finally {
      enableButtons()
      setTimeout(() => progress.hide(), 2000)
    }
  }

  const runFirmware = async () => {
    if (!activeDevice || !activeDevice.opened) {
      showStatus('设备未连接', 'error', operationStatus)
      return
    }

    try {
      const data = [0xf0]
      while (data.length < 63) {
        data.push(0)
      }

      await sendReportAndWait(REPORT_ID, data)
      showLog('已发送跳转程序指令，准备切换到设备配置模式')

      setTimeout(() => {
        switchToConfigTab()
        showLog('已从固件刷入模式切换，准备连接设备配置模式')
      }, 1000)
    } catch (error) {
      showStatus(`跳转失败: ${error.message}`, 'error', operationStatus)
      showLog(`跳转程序失败: ${error.message}`)
    }
  }

  const connectAndInitialize = async () => {
    try {
      connectAndInitBtn.disabled = true
      showStatus('正在请求设备...', 'info', connectionStatus)
      showLog('开始连接设备流程...')

      communicator.clearAllRequests()

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
      renderList(connectList, devices)
      showStatus('设备已选择，正在连接...', 'info', connectionStatus)
      showLog(`设备已选择: ${activeDevice.productName}`)

      if (activeDevice.opened) {
        await activeDevice.close()
      }

      await activeDevice.open()
      showStatus('设备已连接，正在初始化IAP...', 'info', connectionStatus)
      showLog(`设备已连接: ${activeDevice.productName}`)

      communicator.setDevice(activeDevice)

      const data = [0xa1]
      while (data.length < 63) {
        data.push(0)
      }

      const response = await sendReportAndWait(REPORT_ID, data, HID_TIMEOUT)

      showStatus('设备连接并初始化完成！', 'success', connectionStatus)
      showLog('IAP初始化完成，设备准备就绪')
      showLog(
        `初始化响应: ${Array.from(response)
          .map((x) => x.toString(16).padStart(2, '0'))
          .join(' ')}`
      )
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
      communicator.clearAllRequests()
    } finally {
      connectAndInitBtn.disabled = false
    }
  }

  const bindEvents = () => {
    connectAndInitBtn.addEventListener('click', connectAndInitialize)

    downloadLatestBtn.addEventListener('click', () =>
      downloadFirmware(FIRMWARE_URLS.latest, '最新版')
    )
    downloadNightlyBtn.addEventListener('click', () =>
      downloadFirmware(FIRMWARE_URLS.nightly, '每日构建')
    )

    fileInput.addEventListener('change', (event) => {
      downloadedFirmware = null
      if (event.target.files.length > 0) {
        renderSelectedFile(event.target.files[0])
      } else {
        renderSelectedFile(null)
      }
    })

    writeBtn.addEventListener('click', writeFirmware)
    verifyBtn.addEventListener('click', verifyFirmware)
    runBtn.addEventListener('click', runFirmware)
  }

  return {
    bindEvents,
    fetchVersionInfo,
    getActiveDevice: () => activeDevice,
  }
}
