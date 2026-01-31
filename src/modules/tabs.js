export const createTabController = ({ buttons, contents }) => {
  const switchTab = (tabName) => {
    buttons.forEach((button) => {
      if (button.dataset.tab === tabName) {
        button.classList.add('active')
      } else {
        button.classList.remove('active')
      }
    })

    contents.forEach((content) => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active')
      } else {
        content.classList.remove('active')
      }
    })
  }

  const bind = () => {
    buttons.forEach((button) => {
      button.addEventListener('click', () => switchTab(button.dataset.tab))
    })
  }

  return { switchTab, bind }
}
