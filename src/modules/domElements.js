export const tabElements = {
  buttons: document.querySelectorAll('.tab-button'),
  contents: document.querySelectorAll('.tab-content'),
}

export const firmwareElements = {
  connectAndInitBtn: document.getElementById('ConnectAndInit'),
  connectionStatus: document.getElementById('ConnectionStatus'),
  downloadLatestBtn: document.getElementById('DownloadLatest'),
  downloadNightlyBtn: document.getElementById('DownloadNightly'),
  downloadStatus: document.getElementById('DownloadStatus'),
  latestVersionElement: document.getElementById('LatestVersion'),
  nightlyVersionElement: document.getElementById('NightlyVersion'),
  fileInput: document.getElementById('FileInput'),
  selectedFile: document.getElementById('SelectedFile'),
  writeBtn: document.getElementById('WriteFirmeware'),
  verifyBtn: document.getElementById('VerifyFirmeware'),
  runBtn: document.getElementById('RunFirmeware'),
  progressContainer: document.getElementById('ProgressContainer'),
  progressFill: document.getElementById('ProgressFill'),
  progressText: document.getElementById('ProgressText'),
  operationStatus: document.getElementById('OperationStatus'),
  connectList: document.getElementById('ConnectedList'),
  logBox: document.getElementById('LogBox'),
}

export const configElements = {
  connectConfigBtn: document.getElementById('ConnectConfigDevice'),
  configConnectList: document.getElementById('ConfigConnectedList'),
  configConnectionStatus: document.getElementById('ConfigConnectionStatus'),
  resetLeverBtn: document.getElementById('ResetLeverBtn'),
  readLeverInfoBtn: document.getElementById('ReadLeverInfoBtn'),
  toggleMonitorBtn: document.getElementById('ToggleMonitorBtn'),
  lightTestBtn: document.getElementById('LightTestBtn'),
  saveConfigBtn: document.getElementById('SaveConfigBtn'),
  cancelConfigBtn: document.getElementById('CancelConfigBtn'),
  configOperationStatus: document.getElementById('ConfigOperationStatus'),
  deviceStat: document.getElementById('DeviceStatus'),
  configLogBox: document.getElementById('ConfigLogBox'),
}

export const allButtons = [
  firmwareElements.connectAndInitBtn,
  firmwareElements.downloadLatestBtn,
  firmwareElements.downloadNightlyBtn,
  firmwareElements.writeBtn,
  firmwareElements.verifyBtn,
  firmwareElements.runBtn,
  configElements.connectConfigBtn,
  configElements.resetLeverBtn,
  configElements.readLeverInfoBtn,
  configElements.toggleMonitorBtn,
  configElements.lightTestBtn,
  configElements.saveConfigBtn,
  configElements.cancelConfigBtn,
]
