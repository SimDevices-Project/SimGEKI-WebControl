export const createStatusDisplay = () => {
  const timers = new WeakMap()

  return (message, type = 'info', element) => {
    if (!element) return

    element.className = `status ${type}`
    element.textContent = message
    element.style.display = 'block'

    const previousTimer = timers.get(element)
    if (previousTimer) {
      clearTimeout(previousTimer)
    }

    const timerId = setTimeout(() => {
      element.style.display = 'none'
    }, 8000)

    timers.set(element, timerId)
  }
}

export const createProgressController = (container, fill, text) => {
  const hide = () => {
    if (container) {
      container.style.display = 'none'
    }
    update(0, '')
  }

  const show = () => {
    if (container) {
      container.style.display = 'block'
    }
  }

  const update = (percent, label) => {
    if (fill) {
      fill.style.width = `${percent}%`
    }
    if (text) {
      text.textContent = label || `${Math.round(percent)}%`
    }
  }

  return { show, hide, update }
}

export const appendLog = (output, message) => {
  if (!output) return
  output.value += `${message}\n`
  output.scrollTop = output.scrollHeight
}

export const renderDeviceList = (container, devices) => {
  if (!container) return
  container.innerHTML = ''
  devices.forEach((device) => {
    const li = document.createElement('li')
    li.textContent = device.productName
    container.appendChild(li)
  })
}

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
