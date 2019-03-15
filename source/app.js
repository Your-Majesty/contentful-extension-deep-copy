import { init as initContentfulExtension } from 'contentful-ui-extensions-sdk'
import { recursiveClone } from './deep-copy2'

let space = null
let entry = null
let extension = null
let state = 'idle'

const activationButton = document.querySelector('button')
const logWindow = document.querySelector('.log-window')

initContentfulExtension(getExtension => {
  space = getExtension.space
  entry = getExtension.entry
  extension = getExtension

  if (extension.window.updateHeight) extension.window.updateHeight()
})


function addToLog (str) {
  logWindow.innerHTML += `<p>${str}</p>`
  logWindow.scrollTo(0, 999999999)
}
window.addEventListener('deepcopylog', (event) => {
  addToLog(event.detail.log)
})

window.doTheDeepCopy = async function() {
  if (state != 'idle') return

  state = 'cloning'

  activationButton.classList.add('cf-is-loading')
  activationButton.disabled = true
  logWindow.style.display = 'block'

  const tag = document.querySelector('.clone-tag').value

  if (extension.window.updateHeight) extension.window.updateHeight()

  const sys = entry.getSys()
  const clonedEntry = await recursiveClone(space, sys.id, tag)
  addToLog('')
  addToLog('<strong>Clone successful!<strong>')
  addToLog('New entry at:')
  addToLog(`<a target="_top" href="https://app.contentful.com/spaces/${sys.space.sys.id}/entries/${clonedEntry.sys.id}">https://app.contentful.com/spaces/${sys.space.sys.id}/entries/${sys.id}</a>`)

  activationButton.classList.remove('cf-is-loading')
}

document.querySelector('.clone-tag').value = `(${new Date().toUTCString()})`

window.toggleConfirmModal = function (flag) {
  document.querySelector('.confirm').style.display = flag ? 'flex' : 'none'
}