const DEVICE_OPTIONS = {
  config: {
    name: '主控配置通道',
    transport: 'Web HID · 配置报告 0xAA',
    description: '摇杆校准、输入模式与设备参数',
  },
  inputtest: {
    name: '主控输入通道',
    transport: 'Web HID · 原始输入报告',
    description: '摇杆、按键矩阵与投币器诊断',
  },
  cardreader: {
    name: '读卡器',
    transport: 'Web Serial · 115200 baud',
    description: '卡片检测、UID 与板卡信息',
  },
  ledboard: {
    name: '灯板',
    transport: 'Web Serial · RGB direct',
    description: '灯板信息与分区灯光测试',
  },
  firmware: {
    name: '固件维护通道',
    transport: 'Web HID · IAP / Bootloader',
    description: '下载、烧入、验证与启动固件',
  },
}

const setText = (selector, text) => {
  const element = document.querySelector(selector)
  if (element) element.textContent = text
}

export const createDeviceSessionController = ({ tabs, connectButtons }) => {
  const picker = document.getElementById('device-picker')
  const appShell = document.getElementById('app-shell')
  const mobileUnsupported = document.getElementById('mobile-unsupported')
  const choices = Array.from(document.querySelectorAll('.device-choice'))
  const selectedPill = document.getElementById('picker-selected-pill')
  const connectButton = document.getElementById('device-start-connect')
  const continueButton = document.getElementById('device-continue')
  const openPickerButton = document.getElementById('open-device-picker')
  const closePickerButton = document.getElementById('close-device-picker')

  let selectedTab = 'config'
  let hasOpenedConsole = false

  const isMobileDevice = () =>
    Boolean(navigator.userAgentData?.mobile) ||
    /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent)

  const showMobileUnsupported = () => {
    if (picker) picker.hidden = true
    if (appShell) appShell.hidden = true
    if (mobileUnsupported) mobileUnsupported.hidden = false
    document.body.dataset.session = 'unsupported'
  }

  const updateSelection = (tabName) => {
    const device = DEVICE_OPTIONS[tabName] || DEVICE_OPTIONS.config
    selectedTab = DEVICE_OPTIONS[tabName] ? tabName : 'config'

    choices.forEach((choice) => {
      const isSelected = choice.dataset.deviceRole === selectedTab
      choice.classList.toggle('is-selected', isSelected)
      choice.setAttribute('aria-pressed', String(isSelected))
    })

    if (selectedPill) selectedPill.textContent = `已选择 · ${device.name}`

    setText('#picker-selected-name', device.name)
    setText('#picker-selected-description', device.description)
    setText('#picker-selected-transport', device.transport)
    setText('#active-device-name', device.name)
    setText('#sidebar-selected-name', device.name)
    setText('#sidebar-selected-transport', device.transport)
    setText('#inspector-selected-device', device.name)
    setText('#inspector-selected-transport', device.transport)

    if (connectButton) connectButton.textContent = `连接 ${device.name}`
  }

  const showPicker = () => {
    if (!picker) return
    picker.hidden = false
    if (appShell) appShell.hidden = true
    document.body.dataset.session = 'selecting'
    updateSelection(selectedTab)
  }

  const showConsole = () => {
    if (!picker) return
    picker.hidden = true
    if (appShell) appShell.hidden = false
    hasOpenedConsole = true
    document.body.dataset.session = 'console'
    tabs.switchTab(selectedTab)
  }

  const connectSelectedDevice = () => {
    showConsole()
    const connectTarget = connectButtons[selectedTab]
    if (connectTarget && !connectTarget.disabled) connectTarget.click()
  }

  const bind = () => {
    if (isMobileDevice()) {
      showMobileUnsupported()
      return
    }

    choices.forEach((choice) => {
      choice.addEventListener('click', () => updateSelection(choice.dataset.deviceRole))
    })

    connectButton?.addEventListener('click', connectSelectedDevice)
    continueButton?.addEventListener('click', showConsole)
    openPickerButton?.addEventListener('click', showPicker)
    closePickerButton?.addEventListener('click', () => {
      if (hasOpenedConsole) showConsole()
    })

    window.addEventListener('simgeki:tabchange', (event) => {
      const tabName = event.detail?.tabName
      if (tabName && DEVICE_OPTIONS[tabName]) updateSelection(tabName)
    })

    updateSelection(selectedTab)
    showPicker()
  }

  return { bind, showPicker, showConsole, updateSelection }
}
