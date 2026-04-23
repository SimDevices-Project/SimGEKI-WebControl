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

export const CARD_READER_VID = 0x0ca3
export const CARD_READER_PID = 0x0021

export const CARD_READER_SERIAL_OPTIONS = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
}

export const CARD_IO_COMMANDS = {
  CMD_RESET: 0x10,
  CMD_SET_TIMEOUT: 0x11,
  CMD_SET_DISABLE: 0x14,
  CMD_GET_FW_VERSION: 0x30,
  CMD_GET_HW_VERSION: 0x32,
  CMD_START_POLLING: 0x40,
  CMD_STOP_POLLING: 0x41,
  CMD_CARD_DETECT: 0x42,
  CMD_CARD_SELECT: 0x43,
  CMD_CARD_HALT: 0x44,
  CMD_MIFARE_KEY_SET_A: 0x50,
  CMD_MIFARE_AUTHORIZE_A: 0x51,
  CMD_MIFARE_READ: 0x52,
  CMD_MIFARE_WRITE: 0x53,
  CMD_MIFARE_KEY_SET_B: 0x54,
  CMD_MIFARE_AUTHORIZE_B: 0x55,
  CMD_TO_UPDATER_MODE: 0x60,
  CMD_SEND_HEX_DATA: 0x61,
  CMD_TO_NORMAL_MODE: 0x62,
  CMD_SEND_BINDATA_INIT: 0x63,
  CMD_SEND_BINDATA_EXEC: 0x64,
  CMD_FELICA_PUSH: 0x70,
  CMD_FELICA_THROUGH: 0x71,
  CMD_EXT_BOARD_SET_LED: 0x80,
  CMD_EXT_BOARD_SET_LED_RGB: 0x81,
  CMD_EXT_BOARD_SET_LED_RGB_DIRECT: 0x82,
  CMD_EXT_BOARD_INFO: 0xf0,
  CMD_EXT_BOARD_STATUS: 0xf1,
  CMD_EXT_FIRM_SUM: 0xf2,
  CMD_EXT_PROTOCOL_VERSION: 0xf3,
  CMD_EXT_TO_BOOT_MODE: 0xf4,
  CMD_EXT_TO_NORMAL_MODE: 0xf5,
}

export const CARD_IO_STATUS = {
  STATUS_OK: 0x00,
  STATUS_ERROR: 0x01,
  STATUS_UNKNOWN_COMMAND: 0x02,
  STATUS_PARAM_ERROR: 0x03,
  STATUS_BUSY: 0x04,
  STATUS_INVALID: 0xff,
}

export const CARD_IO_SYNC_BYTE = 0xe0
export const CARD_IO_ESCAPE_BYTE = 0xd0

export const CARD_IO_REQUEST_HEADER_SIZE = 5
export const CARD_IO_RESPONSE_HEADER_SIZE = 6
export const CARD_IO_MAX_PAYLOAD_SIZE = 23

export const CARD_TYPE = {
  0x00: '未检测到卡片',
  0x10: 'Mifare卡片',
  0x11: 'Mifare UL',
  0x20: 'FeliCa卡片',
}

export const CARD_READER_RATE = {
  HI: 'high',
  LOW: 'low',
}

export const CARD_READER_FW_HI = '\x94'
export const CARD_READER_FW_LOW = 'TN32MSEC003S F/W Ver1.2'

export const CARD_READER_HW_HI = '837-15396'
export const CARD_READER_HW_LOW = 'TN32MSEC003S H/W Ver3.0'
