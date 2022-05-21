import { isObject } from './utils'

export function validateFilter(filter) {
  if (!isObject(filter)) return null

  let filterKeys = Object.keys(filter)
    .map(k => k.trim())
    .filter(k => k.length > 0)
  if (filterKeys.length < 1) return null

  let hasAtleastOne = false
  let validated = filterKeys.reduce((acc, k) => {
    let label = k
    let value = filter[k]
    if (typeof value === 'string') {
      let trimmed = value.trim()
      if (trimmed.length > 0) {
        acc[label] = value
        hasAtleastOne = true
      }
    }
    return acc
  }, {})

  return hasAtleastOne ? validated : null
}

export function iterateOverObjectTree(obj, fn, level = 0) {
  if (isObject(obj)) {
    let allKeys = Object.keys(obj)
    allKeys.forEach(k => {
      let v = obj[k]
      iterateOverObjectTree(v, fn, level + 1)
    })
    fn(obj, allKeys, level)
  }

  if (Array.isArray(obj)) {
    obj.forEach(o => {
      iterateOverObjectTree(o, fn, level)
    })
  }

  return obj
}

export function createFiltersTree({
  data,
  keys = [],
  path = [],
  keysSort = [],
}) {
  let res = {}

  keys.forEach((k, keyIndex) => {
    let isLastKeyIndex = keyIndex === keys.length - 1

    data.forEach(item => {
      if (!item) return

      let obj = path.reduce((x, k) => x[k], item)
      if (!obj) return

      let value = obj[k]
      if (typeof value == 'number') value = value.toString()
      if (typeof value !== 'string' || value === '') return

      let resInnerObj = keys.slice(0, keyIndex).reduce((x, k) => x[obj[k]], res)
      if (!resInnerObj) return

      resInnerObj[value] = isLastKeyIndex ? item : {}
    })
  })

  return Object.keys(res).length > 0
    ? iterateOverObjectTree(res, (obj, keys, levelIndex) => {
        if (!obj._tag) {
          const desc = keysSort[levelIndex]?.desc

          obj._keys_ = keys.sort((a, b) =>
            desc ? b.localeCompare(a) : a.localeCompare(b)
          )
        }
      })
    : res
}

export function isFilterSelectable(selectedValues, index) {
  if (index < 0 || index >= selectedValues.length) return false

  let slice = selectedValues.slice(0, index)
  const isTuple = Array.isArray(selectedValues[0])
  return isTuple
    ? slice.every(([key, value]) => !!value)
    : slice.every(v => !!v)
}

export function getCurrentFilterObject({ selectedValues, index, filterTree }) {
  let selectable = isFilterSelectable(selectedValues, index)

  if (!selectable) return null
  if (selectable) {
    const isTuple = Array.isArray(selectedValues[0])
    let res = selectedValues.slice(0, index).reduce((x, maybeTuple) => {
      let value = isTuple ? maybeTuple[1] : maybeTuple
      return x[value]
    }, filterTree)

    return res
  }
}

export function getSelectedItem({ keys, filterTree, activeFilters }) {
  return keys.reduce((value, label) => {
    let filterValue = activeFilters.get(label)
    if (!filterValue) return null
    return value?.[filterValue] || null
  }, filterTree)
}
