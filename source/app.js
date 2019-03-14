import { init as initContentfulExtension } from 'contentful-ui-extensions-sdk'

let space = null
let entry = null

initContentfulExtension(extension => {
  console.log('im am inited')
  space = extension.space
  entry = extension.entry
})

function doLog (str) {
  const ev = new CustomEvent('deepclonelog', {
    detail: {
      log: str
    }
  })

  window.dispatchEvent(ev)
}

async function getUpdatedField(field, tag, depth) {
  if (field && Array.isArray(field)) {
    doLog(getLine(depth) + '| Field is Array, looping through')
    return await Promise.all(field.map(async (f) => {
      return await getUpdatedField(f, tag, depth + 1)
    }))
  }
  
  if (field && field.sys && field.sys.type === 'Link' && field.sys.linkType === 'Entry') {
    doLog(getLine(depth) + '| Field is Entry Link, cloning')
    const clonedEntry = await recursiveClone(field.sys.id, tag, depth + 1)
    field.sys.id = clonedEntry.sys.id
  }

  return field
}

async function getUpdatedFields(fields, tag, depth) {
  doLog(getLine(depth) + '| Get fields')
  for (let fieldName in fields) {
    const field = fields[fieldName]

    for (let lang in field) {
      fields[fieldName][lang] = await getUpdatedField(fields[fieldName][lang], tag, depth)
    }
  }

  return fields
}

async function createNewEntry (type, data) {
  return await space.createEntry(type, data)
}

async function getEntry (id) {
  return await space.getEntry(id)
}

function getLine (depth) {
  return Array(depth).join('--')
} 

async function recursiveClone (id, tag, depth) {
  doLog(getLine(depth) + '| Recursive clone ' + id)
  const entry = await getEntry(id)

  const newFields = await getUpdatedFields(entry.fields, tag, depth + 1)
  if (newFields.title && newFields.title['en-US']) {
    newFields.title['en-US'] = newFields.title['en-US'] + ' (copy ' + tag + ')'
  }
  const newEntry = await createNewEntry(entry.sys.contentType.sys.id, {fields: newFields})

  return newEntry
}
async function performDeepCopy (id) {
  doLog('DEEEP COPY: ' + id)

  const tag = new Date().toUTCString()
  const depth = 0

  return await recursiveClone(id, tag, depth)
}

window.addEventListener('deepclonelog', (event) => {
  document.body.innerHTML += `<div>${event.detail.log}</div>`
  window.scrollTo(0, 100000)
})

window.doTheDeepCopy = async function() {
  const sys = entry.getSys()
  alert('Deep Copying this entry.')
  document.body.style.background = 'green'
  document.body.innerHTML = 'LOADING...'
  const clonedEntry = await performDeepCopy(sys.id)
  alert('Done!')

  doLog('-')
  doLog('+++++++++++++++++++++++++++++++++++')
  doLog(' + We are finished +')
  doLog('+++++++++++++++++++++++++++++++++++')

  document.body.style.background = 'white'

  document.body.innerHTML += `<a target="_top" href="https://app.contentful.com/spaces/${sys.space.sys.id}/entries/${clonedEntry.sys.id}">https://app.contentful.com/spaces/${sys.space.sys.id}/entries/${sys.id}</a>`

  // window.top.location.href = `https://app.contentful.com/spaces/${sys.space.sys.id}/entries/${sys.id}`
}