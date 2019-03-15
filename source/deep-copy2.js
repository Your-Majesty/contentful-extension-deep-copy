import { log } from './log'

let references = {}

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
  const entry = await space.getEntry(entryId)

  if (references[entryId]) {
    return
  }
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
    const newEntry = await space.createEntry(entry.sys.contentType.sys.id, { fields: entry.fields })
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

    await space.updateEntry(entry)
  }
}

async function recursiveClone (space, entryId, tag) {
  references = {}
  log(`Starting clone...`)

  log('')
  log(`Finding references recursively...`)
  await findReferences(space, entryId)
  const numReferences = Object.keys(references).length
  log(` -- Found ${numReferences} reference(s)`)

  log('')
  log(`Creating new entries...`)
  const newReferences = await createNewEntriesFromReferences(space, tag)
  const numNewReferences = Object.keys(newReferences).length
  log(` -- Created ${numNewReferences} reference(s)`)

  log('')
  log(`Updating reference-tree...`)
  await updateReferenceTree(space, newReferences)

  log('')
  log(`Updating done.`)
  return newReferences[entryId]
}

export {
  recursiveClone
}