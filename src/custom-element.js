import { hydrateEZSearch, validateOptions } from './ez-search'
import './styles.scss'

const IS_PROD = import.meta.env.MODE !== 'development'

window.EZSearchDefaultInstances = []

if (!window.customElements.get('x-ezsearch')) {
  class EZSearchCustomWidget extends HTMLElement {
    connectedCallback() {
      this._disposables = []
      this._hydrated = false

      this._options = validateOptions({
        rootNode: this,
        onEvent: IS_PROD
          ? null
          : (ev, data) => {
              let value = data?.select?.value
              value ? console.log(ev, data, value) : console.log(ev, data)
            },
      })

      document.dispatchEvent(
        new CustomEvent('EZSearch_Loading', {
          detail: { element: this },
        }),
      )

      hydrateEZSearch(this._options).then(instance => {
        this._instance = instance
        window.EZSearchDefaultInstances.push(instance)

        document.dispatchEvent(
          new CustomEvent('EZSearch_Loaded', {
            detail: { element: this },
          }),
        )

        this.removeAttribute('dehydrated')
        this._hydrated = true
      })
    }

    disconnectedCallback() {
      this._hydrated = false
      this._disposables.splice(0).forEach(dispose => {
        dispose()
      })
    }
  }

  EZSearchCustomWidget.cache = Object.create(null)
  EZSearchCustomWidget.fetch = {
    get: url => {
      if (!EZSearchCustomWidget.cache[url]) {
        EZSearchCustomWidget.cache[url] = fetch(url)
          .then(r => r.text())
          .then(JSON.parse)
      }

      return EZSearchCustomWidget.cache[url]
    },
  }

  window.customElements.define('x-ezsearch', EZSearchCustomWidget)
}

export default {
  hydrate: hydrateEZSearch,
}
