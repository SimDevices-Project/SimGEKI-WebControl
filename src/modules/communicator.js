export class HIDCommunicator {
  constructor() {
    this.pendingRequests = new Map()
    this.requestId = 0
    this.device = null
  }

  setDevice(device) {
    this.device = device
    if (device && device.opened && !device._communicatorListenerSet) {
      device.addEventListener('inputreport', (event) => {
        this.handleIncomingReport(event.reportId, new Uint8Array(event.data.buffer))
      })
      device._communicatorListenerSet = true
    }
  }

  async send(reportId, data, timeout = 5000) {
    if (!this.device || !this.device.opened) {
      throw new Error('设备未连接或未打开')
    }

    const dataArray = data instanceof Uint8Array ? data : new Uint8Array(data)
    const requestId = ++this.requestId

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`通信超时 (${timeout}ms) - 报告ID: ${reportId}`))
      }, timeout)

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
        reportId,
        timestamp: Date.now(),
        originalData: dataArray,
      })

      this.device
        .sendReport(reportId, dataArray)
        .then(() => {
          console.debug(`HID报告已发送 (ID: ${reportId}, 请求: ${requestId})`)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          this.pendingRequests.delete(requestId)
          reject(new Error(`发送报告失败: ${error.message}`))
        })
    })
  }

  handleIncomingReport(reportId, data) {
    console.debug(
      `收到HID报告 (ID: ${reportId}):`,
      Array.from(data)
        .map((x) => x.toString(16).padStart(2, '0'))
        .join(' ')
    )

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
      clearTimeout(oldestRequest.timeoutId)
      this.pendingRequests.delete(oldestRequestId)
      console.debug(`匹配到请求 ${oldestRequestId}，自动解析Promise`)
      oldestRequest.resolve(data)
    } else {
      console.warn(`收到未期望的HID报告 (ID: ${reportId}):`, data)
    }
  }

  clearAllRequests() {
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeoutId)
      request.reject(new Error('通信被中断或设备断开'))
    }
    this.pendingRequests.clear()
    console.debug('已清理所有待处理的HID请求')
  }

  getPendingCount() {
    return this.pendingRequests.size
  }

  getDebugInfo() {
    const requests = []
    for (const [requestId, request] of this.pendingRequests) {
      requests.push({
        requestId,
        reportId: request.reportId,
        timestamp: request.timestamp,
        waitingTime: Date.now() - request.timestamp,
      })
    }
    return {
      device: this.device ? this.device.productName : 'None',
      pendingCount: this.pendingRequests.size,
      requests,
    }
  }
}
