import { log } from './log'

async function getUpdatedField(space, field, tag, depth) {
  if (field && Array.isArray(field)) {
    return await Promise.all(field.map(async (f) => {
      return await getUpdatedField(space, f, tag, depth + 1)
    }))
  }
  
  if (field && field.sys && field.sys.type === 'Link' && field.sys.linkType === 'Entry') {
    log(`------ Field contains reference, performing clone...`)
    const clonedEntry = await recursiveClone(space, field.sys.id, tag, depth + 1)
    field.sys.id = clonedEntry.sys.id
  }

  return field
}

async function getUpdatedFields(space, fields, tag, depth) {
  for (let fieldName in fields) {
    const field = fields[fieldName]

    for (let lang in field) {
      log(`---- Getting fields for ${lang}...`)
      fields[fieldName][lang] = await getUpdatedField(space, fields[fieldName][lang], tag, depth)
    }
  }

  return fields
}

async function createNewEntry (space, type, data) {
  log(`------ + Creating new entry of type "${type}"...`)
  return await space.createEntry(type, data)
}

async function getEntry (space, id) {
  return await space.getEntry(id)
}

async function recursiveClone (space, id, tag, depth) {
  log(`Cloning ${id}...`)
  const entry = await getEntry(space, id)

  log(`-- Getting fields for ${id}...`)
  const newFields = await getUpdatedFields(space, entry.fields, tag, depth + 1)
  if (newFields.title && newFields.title['en-US']) {
    newFields.title['en-US'] = newFields.title['en-US'] + ' ' + tag
  }
  const newEntry = await createNewEntry(space, entry.sys.contentType.sys.id, {fields: newFields})

  log(`Clone of ${id} completed.`)

  return newEntry
}

export {
  recursiveClone
}

//  Find all references
//    if a reference is already "seen", ignore
//  Create new entries from all saved references
//  Update all new entries with new references