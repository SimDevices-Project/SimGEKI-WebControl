export const createTabController = ({ buttons, contents }) => {
  const switchTab = (tabName) => {
    buttons.forEach((button) => {
      const isActive = button.dataset.tab === tabName
      button.classList.toggle('active', isActive)
      button.setAttribute('aria-selected', String(isActive))
    })

    contents.forEach((content) => {
      const isActive = content.id === `${tabName}-tab`
      content.classList.toggle('active', isActive)
      content.hidden = !isActive
    })

    document.body.dataset.activeTab = tabName
    window.dispatchEvent(new CustomEvent('simgeki:tabchange', { detail: { tabName } }))
  }

  const bind = () => {
    buttons.forEach((button) => {
      button.addEventListener('click', () => switchTab(button.dataset.tab))
    })

    const initialButton = Array.from(buttons).find((button) =>
      button.classList.contains('active')
    )
    switchTab(initialButton?.dataset.tab || buttons[0]?.dataset.tab || 'config')
  }

  return { switchTab, bind }
}
