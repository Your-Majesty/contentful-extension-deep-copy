import { log } from './log'

let references = {}
let referenceCount = 0
let newReferenceCount = 0
let updatedReferenceCount = 0

const statusUpdateTimeout = 3000
const waitTime = 100

async function wait (ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function updateEntry (space, entry) {
  await wait(waitTime)
  return await space.updateEntry(entry)
}

async function createEntry (space, type, data) {
  await wait(waitTime)
  return await space.createEntry(type, data)
}

async function getEntry (space, entryId) {
  await wait(waitTime)
  return await space.getEntry(entryId)
}

async function inspectField (space, field) {
  if (field && Array.isArray(field)) {
    return await Promise.all(field.map(async (f) => {
      return await inspectField(space, f)
    }))
  }
  
  if (field && field.sys && field.sys.type === 'Link' && field.sys.linkType === 'Entry') {
    await findReferences(space, field.sys.id)
  }
}

async function findReferences (space, entryId) {
  if (references[entryId]) {
    return
  }

  const entry = await getEntry(space, entryId)

  referenceCount++

  references[entryId] = entry

  for (let fieldName in entry.fields) {
    const field = entry.fields[fieldName]

    for (let lang in field) {
      const langField = field[lang]
      
      await inspectField(space, langField)
    }
  }
}

async function createNewEntriesFromReferences (space, tag) {
  const newEntries = {}

  for (let entryId in references) {
    const entry = references[entryId]
    if (entry.fields.title && entry.fields.title['en-US']) entry.fields.title['en-US'] = entry.fields.title['en-US'] + ' ' + tag
    const newEntry = await createEntry(space, entry.sys.contentType.sys.id, { fields: entry.fields })
    newReferenceCount++
    newEntries[entryId] = newEntry
  }
  
  return newEntries
}

async function updateReferencesOnField(field, newReferences) {
  if (field && Array.isArray(field)) {
    return await Promise.all(field.map(async (f) => {
      return await updateReferencesOnField(f, newReferences)
    }))
  }

  if (field && field.sys && field.sys.type === 'Link' && field.sys.linkType === 'Entry') {
    const oldReference = references[field.sys.id]
    const newReference = newReferences[field.sys.id]
    field.sys.id = newReference.sys.id
  }
}

async function updateReferenceTree(space, newReferences) {
  for (let entryId in newReferences) {
    const entry = newReferences[entryId]

    for (let fieldName in entry.fields) {
      const field = entry.fields[fieldName]
  
      for (let lang in field) {
        const langField = field[lang]
        
        await updateReferencesOnField(langField, newReferences)
      }
    }

    await updateEntry(space, entry)
    updatedReferenceCount++
  }
}

async function recursiveClone (space, entryId, tag) {
  references = {}
  referenceCount = 0
  newReferenceCount = 0
  updatedReferenceCount = 0
  log(`Starting clone...`)

  let statusUpdateTimer = null

  log('')
  log(`Finding references recursively...`)

  statusUpdateTimer = setInterval(() => {
    log(` - found ${referenceCount} entries so far...`)
  }, statusUpdateTimeout)

  await findReferences(space, entryId)
  clearInterval(statusUpdateTimer)
  log(` -- Found ${referenceCount} reference(s) in total`)

  log('')
  log(`Creating new entries...`)

  statusUpdateTimer = setInterval(() => {
    log(` - created ${newReferenceCount}/${referenceCount} - ${Math.round((newReferenceCount / referenceCount) * 100)}%`)
  }, statusUpdateTimeout)

  const newReferences = await createNewEntriesFromReferences(space, tag)
  clearInterval(statusUpdateTimer)
  log(` -- Created ${newReferenceCount} reference(s)`)

  log('')
  log(`Updating reference-tree...`)
  statusUpdateTimer = setInterval(() => {
    log(` - updated ${updatedReferenceCount}/${referenceCount} - ${Math.round((updatedReferenceCount / referenceCount) * 100)}%`)
  }, statusUpdateTimeout)
  await updateReferenceTree(space, newReferences)
  clearInterval(statusUpdateTimer)

  log('')
  log(`Updating done.`)
  return newReferences[entryId]
}

export {
  recursiveClone
}