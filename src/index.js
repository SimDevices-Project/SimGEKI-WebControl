;(async () => {
  /** @type {HTMLInputElement} */
  const requestBtn = document.getElementById('RequestDevices')
  /** @type {HTMLInputElement} */
  const connectBtn = document.getElementById('ConnectDevice')
  /** @type {HTMLInputElement} */
  const iapInitBtn = document.getElementById('IAP_Init')

  /** @type {HTMLInputElement} */
  const fileInput = document.getElementById('FileInput')
  /** @type {HTMLInputElement} */
  const writeBtn = document.getElementById('WriteFirmeware')
  /** @type {HTMLInputElement} */
  const verifyBtn = document.getElementById('VerifyFirmeware')
  /** @type {HTMLInputElement} */
  const runBtn = document.getElementById('RunFirmeware')

  /** @type {HTMLUListElement} */
  const connectList = document.getElementById('ConnectedList')
  /** @type {HTMLTextAreaElement} */
  const logBox = document.getElementById('LogBox')

  let activeDevice = null

  let isDataReceived = false
  let ReceivedData = new Uint8Array([])

  const REPORT_ID = 0xaa

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

  const requestDevices = async () => {
    const devices = await navigator.hid.requestDevice({
      filters: [
        {
          vendorId: 0x8088,
          productId: 0x00fe,
        },
      ],
    })
    showList(connectList, devices)
    activeDevice = devices[0]
  }

  const onReport = (reportID, data) => {
    showLog(`Received report: ${reportID}\n${new Uint8Array(data.buffer)}`)
    isDataReceived = true
    ReceivedData = new Uint8Array(data.buffer)
  }

  const connectDevice = async () => {
    if (activeDevice === null || activeDevice.opened) {
      return
    }
    await activeDevice.open()
    showLog('Device connected to ' + activeDevice.productName)
    activeDevice.addEventListener('inputreport', (event) => {
      onReport(event.reportId, event.data)
    })
  }

  const sendReport = async (reportID, data) => {
    if (activeDevice === null || !activeDevice.opened) {
      return
    }
    await activeDevice.sendReport(reportID, new Uint8Array(data))
    showLog(`Sent report: ${reportID}\n${new Uint8Array(data)}`)
  }

  const initIAP = async () => {
    if (activeDevice === null || !activeDevice.opened) {
      return
    }
    const data = new Uint8Array([0xa1], 0, 63)
    sendReport(REPORT_ID, data)
  }

  const writeFirmeware = async () => {
    if (isDataReceived === false || fileInput.files.length === 0) {
      return
    }
    const file = fileInput.files[0]
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    reader.onload = async () => {
      const data = new Uint8Array(reader.result)
      let i = 0
      let length = data.length
      for (i = 0; i < length; i += 61) {
        const dataToSend = data.slice(i, i + 61)
        sendReport(REPORT_ID, [0xa2, 61, ...dataToSend])
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            if (isDataReceived) {
              isDataReceived = false
              clearInterval(interval)
              resolve()
            }
          }, 1)
        })
      }
      sendReport(REPORT_ID, [0xa3])
      showLog('Firmeware write done')
    }
  }

  const verifyFirmeware = async () => {
    if (isDataReceived === false || fileInput.files.length === 0) {
      return
    }
    const file = fileInput.files[0]
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    let state_OK = true
    reader.onload = async () => {
      const data = new Uint8Array(reader.result)
      let i = 0
      let length = data.length
      for (i = 0; i < length; i += 61) {
        const dataToSend = data.slice(i, i + 61)
        sendReport(REPORT_ID, [0xa4, 61, ...dataToSend])
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
      }
      sendReport(REPORT_ID, [0xa5])
      showLog(`Firmeware verify ${state_OK ? 'OK' : 'Failed'}`)
    }
  }

  const runFirmeware = async () => {
    if (activeDevice === null || !activeDevice.opened) {
      return
    }
    const data = new Uint8Array([0xF0], 0, 63)
    sendReport(REPORT_ID, data)
  }
  // const connectDevice = async () => {
  //   if(activeDevice === null) {
  //     return
  //   }
  //   await activeDevice.open()
  // }

  requestBtn.addEventListener('click', requestDevices)
  connectBtn.addEventListener('click', connectDevice)
  iapInitBtn.addEventListener('click', initIAP)
  writeBtn.addEventListener('click', writeFirmeware)
  verifyBtn.addEventListener('click', verifyFirmeware)
  runBtn.addEventListener('click', runFirmeware)
})()
