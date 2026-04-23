export const REPORT_ID = 0xaa
export const CONFIG_REPORT_ID = 0xaa

export const FIRMWARE_URLS = {
  latest: 'https://simdevices.bysb.net/SimGEKI/standard/SimGEKI-SimGETRO_Public.bin',
  nightly: 'https://simdevices.bysb.net/SimGEKI/nightly/SimGEKI-SimGETRO_Public.bin',
}

export const API_URLS = {
  latest: 'https://api.github.com/repos/SimDevices-Project/SimGEKI/releases/latest',
  nightly: 'https://api.github.com/repos/SimDevices-Project/SimGEKI/releases/tags/nightly',
}

export const FIRMWARE_CHUNK_SIZE = 61
export const HID_TIMEOUT = 5000

export const CONFIG_COMMANDS = {
  INPUT_MODE_GET: 0x01,
  INPUT_MODE_SET: 0x02,
  RELOAD_DATA: 0x80,
  SAVE_DATA: 0x81,
  SLEEP_SET_TIMEOUT: 0x90,
  SLEEP_GET_TIMEOUT: 0x91,
  ROLLER_SET_OFFSET: 0xa0,
  ROLLER_GET_DATA: 0xa1,
  LED_SET_MODE: 0xb0,
  SP_LED_SET: 0xe0,
  SP_INPUT_GET: 0xe1,
  SP_INPUT_GET_START: 0xe2,
  SP_INPUT_GET_END: 0xe3,
  UPDATE_FIRMWARE: 0xf1,
  CMD_NOT_SUPPORT: 0xff,
}

export const BUTTON_MAP = {
  LA: { byte: 0, mask: 0x01 },
  LB: { byte: 0, mask: 0x20 },
  LC: { byte: 0, mask: 0x10 },
  RSIDE: { byte: 1, mask: 0x40 },
  RA: { byte: 0, mask: 0x02 },
  RB: { byte: 2, mask: 0x01 },
  RC: { byte: 1, mask: 0x80 },
  LSIDE: { byte: 3, mask: 0x80 },
  LMENU: { byte: 3, mask: 0x40 },
  RMENU: { byte: 1, mask: 0x20 },
  SERVICE: { byte: 0, mask: 0x40 },
  TEST: { byte: 1, mask: 0x02 },
}

export const INVERTED_BUTTONS = ['LSIDE', 'RSIDE']

export const BUTTON_LABELS = {
  LA: 'LA',
  LB: 'LB',
  LC: 'LC',
  RSIDE: 'RSide',
  RA: 'RA',
  RB: 'RB',
  RC: 'RC',
  LSIDE: 'LSide',
  LMENU: 'LMenu',
  RMENU: 'RMenu',
  SERVICE: 'Service',
  TEST: 'Test',
}

export const ROLLER_CENTER = 0x8000

export const COIN_OFFSETS = {
  COIN1_CONDITION: 24,
  COIN1_COUNT: 25,
  COIN2_CONDITION: 26,
  COIN2_COUNT: 27,
}

export const COIN_CONDITIONS = {
  0x00: 'NORMAL',
  0x01: 'JAM',
  0x02: 'DISCONNECT',
  0x03: 'BUSY',
}
