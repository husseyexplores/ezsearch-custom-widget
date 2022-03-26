export function remove(key) {
  window.localStorage.removeItem(key)
  window.localStorage.removeItem(key + '_expiresIn')

  return true
}

export function get(key) {
  let now = Date.now()
  let expiresIn = Number(window.localStorage.getItem(key + '_expiresIn') || '0')

  if (expiresIn < now) {
    remove(key)
    return null
  } else {
    return window.localStorage.getItem(key)
  }
}

export function set(key, value, expires = 60 * 5) {
  expires = Math.abs(expires) //make sure it's positive

  let now = Date.now() //millisecs since epoch time, lets deal only with integer
  let expiry = now + expires * 1000
  window.localStorage.setItem(key, value)
  window.localStorage.setItem(key + '_expiresIn', expiry)
  return true
}
