const getKey = key => `ezs_${key}`
const expiryKey = key => `${key}__expiresIn`

export function remove(key) {
  const _key = getKey(key)

  window.localStorage.removeItem(_key)
  window.localStorage.removeItem(expiryKey(_key))

  return true
}

export function get(key) {
  const _key = getKey(key)

  let now = Date.now()
  let expiresIn = Number(window.localStorage.getItem(expiryKey(_key)) || '0')

  if (expiresIn < now) {
    remove(_key)
    return null
  } else {
    return window.localStorage.getItem(_key)
  }
}

export function set(key, value, expires = 60 * 5) {
  const _key = getKey(key)

  expires = Math.abs(expires) //make sure it's positive

  let now = Date.now() //millisecs since epoch time, lets deal only with integer
  let expiry = now + expires * 1000
  window.localStorage.setItem(_key, value)
  window.localStorage.setItem(expiryKey(_key), expiry)
  return true
}
