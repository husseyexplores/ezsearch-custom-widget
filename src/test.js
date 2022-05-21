;(() => {
  let SA_ID = null
  const ORIGINAL_SA = window.ShopifyAnalytics
  let TEMP_ITEM_KEY = '__temp_item'
  let COL_HANDLE = window.ContactForm_CollectionHandle || 'all'
  const DELIMETER = '__DELIMETER__'

  /**
   * @description
   * Takes an Array<V>, and a grouping function,
   * and returns a Map of the array grouped by the grouping function.
   *
   * @param list An array of type V.
   * @param keyGetter A Function that takes the the Array type V as an input, and returns a value of type K.
   *                  K is generally intended to be a property key of V.
   *
   * @returns Map of the array grouped by the grouping function.
   */
  //export function groupBy<K, V>(list: Array<V>, keyGetter: (input: V) => K): Map<K, Array<V>> {
  //    const map = new Map<K, Array<V>>();
  function groupBy(list, keyGetter) {
    const map = {}
    list.forEach(item => {
      const key = keyGetter(item)
      const collection = map[key]
      if (!collection) {
        map[key] = [item]
      } else {
        collection.push(item)
      }
    })
    return map
  }

  function objectToFormData(obj) {
    let fd = new FormData()
    Object.keys(obj).forEach(key => {
      let value = obj[key]
      if (value != null) {
        fd.append(key, value)
      }
    })
    return fd
  }

  /**
   *
   * @param item {object} Shopify cart line item
   * @returns
   */
  function getUploadedUrlsFromCartItem(item) {
    let props = item.properties || {}

    return Object.keys(props).reduce((acc, key) => {
      const value = props[key]
      if (key !== TEMP_ITEM_KEY && value.startsWith('https://')) {
        acc.push({ key: key.split(DELIMETER)[0], url: value })
      }
      return acc
    }, [])
  }

  function addHiddenInput(form, name, value) {
    // Create a hidden input element, and append it to the form:
    let nameAttrEscaped = name.replace(/[[\]\s]/g, '\\$&')
    let input = form.querySelector(`[name=${nameAttrEscaped}]`)

    if (!input) {
      input = document.createElement('input')
      input.type = 'hidden'
      // input.name = name
      input.setAttribute('data-name', name)
      input.setAttribute('data-hidden-file-input', '')
      form.appendChild(input)
    }

    return input
  }

  /**
   *
   * @param inputField {HTMLInputElement}
   * @returns
   */
  const extractFileInputName = inputField => {
    let attr = inputField.dataset.actualFileAttr
    if (attr) return attr

    let name = inputField.name
    if (!name) return null

    attr = ((name.match(/^file\[([\w\d-_\s]+)\]$/) || [])[1] || '').trim()
    if (attr) {
      inputField.dataset.actualFileAttr = attr
    }
    return attr || null
  }

  function disableAnalytics() {
    clearTimeout(SA_ID)
    window.ShopifyAnalytics = null
    console.log('ShopifyAnalytics - Disabled')
  }

  function enableAnalytics() {
    SA_ID = setTimeout(_ => {
      window.ShopifyAnalytics = ORIGINAL_SA
      console.log('ShopifyAnalytics - Enabled')
    }, 200)
  }

  class ShopifyUploadableFrom {
    /**
     *
     * @param form {HTMLFormElement}
     * @param opts {object}
     */
    constructor(form, opts) {
      if (!form || form.nodeName !== 'FORM') {
        throw new Error('Missing `form` element.')
      }

      if (form._handlesUpload) {
        return
      }

      form._handlesUpload = true

      this.form = form
      this.fetch = opts.fetch || window.fetch
      this.validateFile = opts.validate || (() => true)
      this.uploadOnEvent = opts.uploadOn === 'submit' ? 'submit' : 'change'
      this.afterUpload =
        typeof opts.afterUpload === 'function'
          ? opts.afterUpload
          : this.uploadOnEvent === 'submit'
          ? () => {
              this.form.submit()
            }
          : null
      this.onError =
        typeof opts.onError === 'function' ? opts.onError : () => {}

      this.uploadedUrls = []
      this.retryCount = 0
      this.VARIANT = null

      const fileInputs = Array.from(
        form.querySelectorAll('[name^="file\\["]')
      ).filter(input => extractFileInputName(input))

      this.elements = {
        form: form,
        submitBtn: form.querySelector('[type="submit"]'),
        fileInputs: fileInputs,
      }
      this.fileUploadableForm()
      this.getValidVariant()
    }

    async getValidVariant() {
      if (this.VARIANT) return this.VARIANT

      this.retryCount++
      if (this.retryCount > 3) {
        throw new Error('Unable to find variant')
      }

      const variant = await this.fetch(
        `/collections/${COL_HANDLE}/products.json?limit=1`
      )
        .then(r => r.json())
        .then(d => d.products)
        .then(prods => prods[0].variants[0])

      if (!variant) {
        return this.getValidVariant()
      }

      this.VARIANT = variant
      return variant
    }

    async addToCart(obj) {
      disableAnalytics()
      return this.fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        body: objectToFormData(obj),
      })
        .then(r => {
          console.log(
            r.ok
              ? 'Successfully added the product to cart'
              : 'Error adding to cart'
          )
          return r.json()
        })
        .catch(e => {
          console.warn('Oops - caught error while adding to cart. ', e.message)
        })
        .finally(enableAnalytics)
    }

    async removeFromCart(id) {
      return this.fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ updates: { [id]: 0 } }),
      })
        .then(r => r.json())
        .then(c => {
          console.log('Removed temporary product from cart', id)
          return c
        })
    }

    /**
     *
     * @param obj {{ [key: string]: HTMLInputElement["files"][0] }} Key-value pair of name and file
     * @returns {string[]} url array
     */
    async uploadFiles(obj) {
      let variant = await this.getValidVariant()
      let data = {
        form_type: 'product',
        utf8: 'âœ“',
        id: variant.id,
        quantity: 1,
      }

      data[`properties[${TEMP_ITEM_KEY}]`] = 'Temporary item ' + +Date.now()

      Object.keys(obj).forEach(k => {
        const file = obj[k]
        data[`properties[${k}]`] = file
      })

      let addedItem = await this.addToCart(data)
      console.log('Added Item', addedItem)

      let urls = getUploadedUrlsFromCartItem(addedItem)
      this.removeFromCart(addedItem.key)
      this.uploadedUrls = urls
      return urls
    }

    /**
     *
     * @param event {Event}
     * @returns
     */
    async handleFileChange(event) {
      const target = event.target
      if (event.type === 'submit') {
        event.preventDefault()
      }

      const eventMatched = event.type === this.uploadOnEvent
      if (!eventMatched) {
        return
      }

      if (this.uploadOnEvent === 'change') {
        const elementMatched = this.elements.fileInputs.some(
          inp => inp === target
        )

        if (!elementMatched) {
          return
        }
      }

      const nameAttr = extractFileInputName(target)
      if (!nameAttr) {
        console.warn('Missing file `name` attribute')
        return
      }

      const inputWithFilesTuples =
        this.uploadOnEvent === 'change'
          ? [[target, Array.from(target.files || [])]]
          : this.elements.fileInputs.map((inp, i) => [
              inp,
              Array.from(inp.files || []),
            ])

      const noFilesAtall = inputWithFilesTuples.every(tuple => !tuple[1].length)
      if (noFilesAtall) {
        return
      }

      let validationErrors = []
      inputWithFilesTuples.forEach(tuple => {
        let validationError = null

        const inp = tuple[0]
        const files = tuple[1]
        if (!files.length) {
          console.log(`No files to upload for .. Clearing fields`, inp)
          inp._associatedActualInput.value = ''
          inp._associatedActualInput.name = ''
        }

        files.forEach(file => {
          if (validationError) return

          const isValidFile = this.validateFile(file)
          if (isValidFile === true || isValidFile == null) return

          if (isValidFile === false || typeof isValidFile === 'string') {
            validationError = isValidFile || 'File validation failed'
            validationErrors.push([inp, file, validationError])
          }
        })
      })

      if (validationErrors.length) {
        console.log('Validation faied', validationErrors)
        return
      }

      console.log('Uploading files..', inputWithFilesTuples)
      this.form.dispatchEvent(
        new CustomEvent('FileUpload', {
          detail: {
            form: this.elements.form,
            input: target,
            submitBtn: this.elements.submitBtn,
            files: inputWithFilesTuples,
            start: true,
            end: false,
          },
        })
      )

      inputWithFilesTuples.forEach(tuple => {
        const inp = tuple[0]
        inp.disabled = true
      })

      if (this.elements.submitBtn) {
        this.elements.submitBtn.disabled = true
      }

      // There are some files! Lets upload them
      // Accumulate files to make formdata
      const filesToUpload = inputWithFilesTuples.reduce((acc, tuple) => {
        const inp = tuple[0]
        const files = tuple[1]

        let nameAttr = extractFileInputName(inp)
        files.forEach((file, idx) => {
          nameAttr += `${DELIMETER}${idx}`
          acc[nameAttr] = file
        })

        return acc
      }, {})

      let uploadedUrls = null
      let errored = false
      try {
        uploadedUrls = await this.uploadFiles(filesToUpload)
        const grouped = groupBy(uploadedUrls, x => x.key)
        Object.keys(key => {
          const urls = grouped[key]
          const input = inputWithFilesTuples.find(tuple => {
            extractFileInputName(tuple[0]) === key
          })

          if (urls.length) {
            input._associatedActualInput.value =
              urls.length === 1
                ? urls[0]
                : urls.map((url, i) => `${i + 1} - ${url}`).join('\n')
            input._associatedActualInput.name =
              input._associatedActualInput.dataset.name
          }
        })

        if (this.afterUpload) {
          this.afterUpload(this.form)
        }
      } catch (e) {
        errored = e
        throw e
      } finally {
        inputWithFilesTuples.forEach(tuple => {
          const inp = tuple[0]
          inp.disabled = false
        })

        if (this.elements.submitBtn) {
          this.elements.submitBtn.disabled = false
        }

        this.form.dispatchEvent(
          new CustomEvent('FileUpload', {
            detail: {
              form: this.elements.form,
              input: target,
              submitBtn: this.elements.submitBtn,
              urls: uploadedUrls,
              start: false,
              end: true,
              error: errored,
            },
          })
        )
      }
    }

    fileUploadableForm() {
      this.elements.fileInputs.forEach(fileInput => {
        fileInput.disabled = false
        fileInput.removeAttribute('disabled')

        let attr = extractFileInputName(fileInput)
        let associatedActualInput = addHiddenInput(
          this.form,
          `contact[${attr}]`
        )
        fileInput._associatedActualInput = associatedActualInput
      })

      this.form.addEventListener(this.uploadOnEvent, this.handleFileChange, {
        capture: true,
      })
    }
  }

  function init(form, opts) {
    return new ShopifyUploadableFrom(form, opts)
  }

  window.shopifyUploadableForm = init

  return init
})()
