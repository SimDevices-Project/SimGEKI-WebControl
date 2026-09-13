import {
  allButtons,
  configElements,
  firmwareElements,
  inputTestElements,
  cardReaderTestElements,
  ledBoardTestElements,
  tabElements,
} from './modules/domElements'
import {
  appendLog,
  createProgressController,
  createStatusDisplay,
  delay,
  renderDeviceList,
} from './modules/ui'
import { HIDCommunicator } from './modules/communicator'
import { createTabController } from './modules/tabs'
import { createFirmwareController } from './modules/firmware'
import { createConfigController } from './modules/config'
import { createInputTestController } from './modules/inputTest'
import { createCardReaderTestController } from './modules/cardReaderTest'
import { createLedBoardTestController } from './modules/ledBoardTest'
import { createThemeController } from './modules/theme'
import { createDeviceSessionController } from './modules/deviceSession'
import { initializeColorPickers } from './modules/colorPicker'

const initialize = () => {
  const theme = createThemeController()
  initializeColorPickers()
  const showStatus = createStatusDisplay()
  const firmwareProgress = createProgressController(
    firmwareElements.progressContainer,
    firmwareElements.progressFill,
    firmwareElements.progressText
  )

  const firmwareCommunicator = new HIDCommunicator()
  const configCommunicator = new HIDCommunicator()
  const inputTestCommunicator = new HIDCommunicator()
  const tabs = createTabController(tabElements)

  const firmwareController = createFirmwareController({
    elements: firmwareElements,
    communicator: firmwareCommunicator,
    showStatus,
    progress: firmwareProgress,
    showLog: (message) => appendLog(firmwareElements.logBox, message),
    renderList: renderDeviceList,
    switchToConfigTab: () => tabs.switchTab('config'),
    lockButtons: allButtons,
  })

  const configController = createConfigController({
    elements: configElements,
    communicator: configCommunicator,
    showStatus,
    showConfigLog: (message) => appendLog(configElements.configLogBox, message),
    renderList: renderDeviceList,
    delay,
  })

  const inputTestController = createInputTestController({
    elements: inputTestElements,
    communicator: inputTestCommunicator,
    showStatus,
    showInputTestLog: (message) => appendLog(inputTestElements.inputTestLogBox, message),
    renderList: renderDeviceList,
  })

  const cardReaderTestController = createCardReaderTestController({
    elements: cardReaderTestElements,
    showStatus,
    showCardReaderLog: (message) => appendLog(cardReaderTestElements.logBox, message),
    renderList: renderDeviceList,
  })

  const ledBoardTestController = createLedBoardTestController({
    elements: ledBoardTestElements,
    showStatus,
    showLedBoardLog: (message) => appendLog(ledBoardTestElements.logBox, message),
    renderList: renderDeviceList,
  })

  const deviceSession = createDeviceSessionController({
    tabs,
    connectButtons: {
      config: configElements.connectConfigBtn,
      inputtest: inputTestElements.connectInputTestBtn,
      cardreader: cardReaderTestElements.connectBtn,
      ledboard: ledBoardTestElements.connectBtn,
      firmware: firmwareElements.connectAndInitBtn,
    },
  })

  tabs.bind()
  firmwareController.bindEvents()
  configController.bindEvents()
  inputTestController.bindEvents()
  cardReaderTestController.bindEvents()
  ledBoardTestController.bindEvents()
  deviceSession.bind()
  firmwareController.fetchVersionInfo()

  window.getHIDDebugInfo = () => ({
    firmware: firmwareCommunicator.getDebugInfo(),
    config: configCommunicator.getDebugInfo(),
    inputTest: inputTestCommunicator.getDebugInfo(),
  })

  window.SimGEKITheme = theme

  window.addEventListener('beforeunload', () => {
    configController.stopMonitoring()
    inputTestController.stopTest()
    cardReaderTestController.stopTest()
    ledBoardTestController.stopTest()
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}
