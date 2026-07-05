# LED Board Test Page Design

## Overview

Add a "灯板测试" (LED Board Test) tab to SimGEKI-WebControl, similar to the existing card reader test page. It communicates with the LED board via WebSerial (VID: 0x0CA3, PID: 0x0021) using the IO_Packet protocol defined in the SimGEKI firmware.

## Protocol: IO_Packet Format

The LED IO uses a different packet format from Card IO (AIME). Defined in `comio.h`.

### Request Packet (host -> device)

| Offset | Field       | Description                                         |
|--------|-------------|-----------------------------------------------------|
| 0      | sync        | 0xE0 (sent raw, not byte-stuffed)                   |
| 1      | dstNodeId   | Destination node (0x00)                             |
| 2      | srcNodeId   | Source node (0x00)                                  |
| 3      | length      | payload_count + 1 (includes checksum byte)         |
| 4      | command     | Command code                                        |
| 5..N   | data        | Payload bytes                                       |
| N+1    | checksum    | `(dstNodeId + srcNodeId + length + command + data[0..N-1]) & 0xFF` |

Total raw size = 5 + length bytes.

### Response Packet (device -> host)

| Offset | Field       | Description                                         |
|--------|-------------|-----------------------------------------------------|
| 0      | sync        | 0xE0                                                |
| 1      | dstNodeId   | Swapped from request's srcNodeId                    |
| 2      | srcNodeId   | Swapped from request's dstNodeId                   |
| 3      | length      | 3 + data_count (NOT including checksum)             |
| 4      | status      | ACK status (ACK_OK = 0x01)                          |
| 5      | command     | Echo of request command                             |
| 6      | report      | Report status (REPORT_OK = 1)                       |
| 7..N   | data        | Response payload                                    |
| N+1    | checksum    | Sum of bytes 1..N, mod 256                          |

Total raw size = 5 + length bytes.

### Byte Stuffing

Same as Card IO: 0xE0 and 0xD0 in the payload (bytes after sync) are escaped as `0xD0 (byte - 1)`. The sync byte itself is sent raw.

### Checksum

The receive-side checksum seed is 0x20, which cancels the sync byte (0x20 + 0xE0 = 0x00 mod 256). The effective checksum is the sum of bytes 1 through N (everything except sync and the checksum byte itself), mod 256.

## Commands

### CMD_RESET (0x10) — Reset LED Board

- Request: no payload
- Response: no data (length = 3 after += 3 for status/command/report)
- Firmware behavior: turns off both LED ports (left and right) to RGB(0,0,0)

### CMD_EXT_BOARD_SET_LED_RGB_DIRECT (0x82) — Set LED Colors Directly

- Request: 183-byte payload (61 LEDs x 3 bytes RGB)
- Response: **NONE** — firmware returns early without sending a response
- Data layout:
  - Bytes 0-2: RGB for left port LEDs 0-2 (left side key)
  - Bytes 3-5: RGB for left port LEDs 3-5 (left main keys)
  - Bytes 6-176: RGB for remaining left port LEDs (57 LEDs)
  - Bytes 177-179: RGB for right port LEDs 3-5 (right main keys)
  - Bytes 180-182: RGB for right port LEDs 0-2 (right side key)

### CMD_EXT_BOARD_INFO (0xF0) — Get Board Info

- Request: no payload
- Response: 16 bytes of device info:
  - Bytes 0-7: "15093-06" (ASCII, model number)
  - Byte 8: 0x0A
  - Bytes 9-13: "6710A" (ASCII, sub-model)
  - Byte 14: 0xFF
  - Byte 15: 0xA0 (revision)

### Commands NOT exposed

- CMD_SET_TIMEOUT (0x11)
- CMD_SET_DISABLE (0x14)
- CMD_EXT_BOARD_STATUS (0xF1)
- CMD_EXT_FIRM_SUM (0xF2)
- CMD_EXT_PROTOCOL_VERSION (0xF3)

## Architecture

### New Files

1. **`src/modules/ledIOProtocol.js`** — IO_Packet protocol encoder/decoder
   - `encodeFrame(dstNodeId, srcNodeId, command, data[])` → `Uint8Array`
   - `decodeByte(byte)` → frame object or null (streaming decoder)
   - `buildReset()` — CMD_RESET
   - `buildSetLEDRGBDirect(rgbData[183])` — CMD_EXT_BOARD_SET_LED_RGB_DIRECT
   - `buildGetBoardInfo()` — CMD_EXT_BOARD_INFO
   - `getCommandName(cmd)`, `getAckStatusName(status)`, `getReportStatusName(report)`

2. **`src/modules/ledBoardTest.js`** — LED board test controller
   - Maintains `ledStateBuffer` (Uint8Array(183)) for state-preserving color tests
   - Connect/disconnect via WebSerial (VID: 0x0CA3, PID: 0x0021, 115200 baud)
   - Handles received data via streaming byte decoder
   - Test actions: getBoardInfo, setWholeBoardColor, setLeftKeysColor, setRightKeysColor, reset

### Modified Files

1. **`src/constants.js`** — Add LED IO constants:
   - `LED_IO_SYNC_BYTE`, `LED_IO_ESCAPE_BYTE`, `LED_IO_CHECKSUM_SEED`
   - `LED_IO_ACK_STATUS`, `LED_IO_REPORT_STATUS`
   - `LED_RGB_DATA_SIZE = 183`

2. **`src/modules/domElements.js`** — Add `ledBoardTestElements` object

3. **`src/index.js`** — Import and initialize `createLedBoardTestController`

4. **`public/index.html`** — Add "灯板测试" tab button and tab content

### Reused Files

- `src/modules/serialCommunicator.js` — WebSerial communication (no changes)
- `src/modules/ui.js` — Status display, logging (no changes)
- `src/modules/tabs.js` — Tab switching (no changes)

## UI Design

### Tab Button

```
💡 灯板测试 (data-tab="ledboard")
```

### Tab Content Sections

1. **设备连接** — Connect/disconnect buttons, connection status, WebSerial hint
2. **设备状态** — "读取设备信息" button + status display panel
3. **LED 测试** — Color picker + 4 buttons:
   - 整个灯板颜色 (fills all 183 bytes with chosen RGB)
   - 左侧键颜色 (sets bytes 0-5, preserves rest)
   - 右侧键颜色 (sets bytes 177-182, preserves rest)
   - 重置灯板 (CMD_RESET, also clears state buffer)
4. **测试日志** — Log textarea

### State Buffer Behavior

The controller maintains a 183-byte `ledStateBuffer` initialized to all zeros.

- **Whole board color**: Fill entire buffer with chosen RGB, send.
- **Left keys color**: Set `buffer[0..5]` to chosen RGB, preserve rest, send.
- **Right keys color**: Set `buffer[177..182]` to chosen RGB, preserve rest, send.
- **Reset**: Send CMD_RESET (turns off LEDs on firmware side), clear buffer to zeros.

This allows setting different colors for left and right keys by clicking them sequentially.

### No-Response Handling

`CMD_EXT_BOARD_SET_LED_RGB_DIRECT` does not send a response. The controller sends the command and logs "command sent" without waiting for a response. All other commands expect a response and are processed through the streaming decoder.

## Constants

```js
export const LED_IO_SYNC_BYTE = 0xe0
export const LED_IO_ESCAPE_BYTE = 0xd0
export const LED_IO_CHECKSUM_SEED = 0x20

export const LED_IO_ACK_STATUS = {
  ACK_OK: 0x01,
  ACK_SUM_ERROR: 0x02,
  ACK_PARITY_ERROR: 0x03,
  ACK_FARMING_ERROR: 0x04,
  ACK_OVER_RUN_ERROR: 0x05,
  ACK_RECV_BUFFER_OVERFLOW: 0x06,
  ACK_INVALID: 0xff,
}

export const LED_IO_REPORT_STATUS = {
  REPORT_OK: 1,
  REPORT_BUSY: 2,
  REPORT_UNKNOWN_COMMAND: 3,
  REPORT_PARAM_ERROR: 4,
  REPORT_INVALID: 255,
}

export const LED_RGB_DATA_SIZE = 183
```

Command values reuse `CARD_IO_COMMANDS` (same enum in firmware).
