/**
 * Snapback is a DOM undo and redo library. It uses
 * a MutationObserver to observe changes to a DOM Element's sub tree.
 * When at least one mutation has been stored in the mutations array,
 * these mutations can be grouped together and saved as an undo.
 * Snapback can then be used to traverse back and forth in the undo history.
 *
 * @module snapback
 */

/**
 * Creates a new Snapback instance that will handle undo's and redo's for `element`s DOM sub tree
 *
 * @class
 * @constructor
 * @alias module:snapback
 * @param {Element} element - The element who's subTree we want to observe for changes
 * @param {Object} options - Should contain a store and restore function to save custom data.
 **/
const Snapback = function (element, options) {
  // determine which version of MutationObserver to use
  const MO = typeof MutationObserver !== 'undefined' ? MutationObserver : (typeof WebKitMutationObserver !== 'undefined' ? WebKitMutationObserver : undefined)

  // stop everything if no MutationObserver is found
  if (!MO) return

  /* bind `this` to the instance snapback instance inside addMutation,
   * register
   * see line 54 & 68
   */
  this.register = this.register.bind(this)
  this.addMutation = this.addMutation.bind(this)

  // extend the current instance of snapback with some properties
  Object.assign(this, {
    // this is the observe pass to the observe function on the Mutation Observer
    observe: { subtree: true, attributes: true, attributeOldValue: true, childList: true, characterData: true, characterDataOldValue: true },
    element,
    // if timeout > 0, mutations will automatically be registered as undo's
    // after [timeout] ms of inactivity (no new mutations)
    timeout: 0,
    // the undo stack is a collection of Undo objects
    undos: [],
    // the mutations stack holds all mutations that have not yet been registered in an undo
    mutations: [],
    // pointer to where in the undo history we are
    undoIndex: -1,
  }, options)

  // instantiate a MutationObserver (this will be started and stopped in this.enable and this.disable respectively
  this.observer = new MO((mutations) => {
    mutations.forEach(this.addMutation)
  })
}

Snapback.prototype = {
  /**
   * Adds a mutation to the mutation array
   *
   * @param {MutationRecord} mutation - The mutation to the mutations array
   */
  addMutation (mutation) {
    if (this.timeout) {
      clearTimeout(this._timeout)

      this._timeout = setTimeout(this.register, this.timeout)
    }

    switch (mutation.type) {
      case 'characterData':
        // save the new value of the textNode
        mutation.newValue = mutation.target.textContent

        const lastMutation = this.mutations[this.mutations.length - 1]

        if (lastMutation && lastMutation.type === 'characterData' && lastMutation.target === mutation.target && lastMutation.newValue === mutation.oldValue) {
          // current and last mutations were characterData mutations on the same textNode.
          // simply set newValue of lastMutation to newValue of current
          lastMutation.newValue = mutation.newValue
          return
        }
        break
      case 'attributes':
        // save new value of the updated attribute
        mutation.newValue = mutation.target.getAttribute(mutation.attributeName)
        break
    }

    // add a new mutation to the stack
    this.mutations.push(mutation)
  },

  /**
   * Stop observering mutations to the DOM. This does not register
   * any mutations in the mutation stack. Essentially
   * this just callc MutationObserver.disconnect().
   */
  disable () {
    if (this.enabled) {
      this.observer.disconnect()
      this.enabled = false
    }
  },

  /**
   * Enable observering mutations to the DOM. Essentially
   * just calls MutationObserver.observe().
   */
  enable () {
    if (!this.enabled) {
      this.observer.observe(this.element, this.observe)
      this.enabled = true
    }
  },

  /**
   * Registers any mutations in the mutation stack as an undo
   */
  register () {
    if (this.mutations.length > 0) {
      // only register a new undo if there are mutations in the stack
      if (this.undoIndex < this.undos.length - 1) {
        // remove any undos after undoIndex, ie the user
        // has undo'd and a new undo branch/tree is needed
        this.undos = this.undos.slice(0, this.undoIndex + 1)
      }

      // push a new Undo object to the undo stack
      this.undos.push({
        data: this.store instanceof Function ? {
          before: this.data,
          after: this.store(),
        } : undefined,
        mutations: this.mutations,
      })

      // reset the mutations stack
      this.mutations = []

      // update the undoIndex
      this.undoIndex = this.undos.length - 1
    }
  },

  /**
   * Redo (if we are not already at the newest change)
   */
  redo () {
    if (this.enabled && this.undoIndex < this.undos.length - 1) {
      this.undoRedo(this.undos[++this.undoIndex], false)
    }
  },

  /**
   * Undo (if we are not already at the oldest change)
   */
  undo () {
    this.register()

    if (this.enabled && this.undoIndex >= 0) {
      this.undoRedo(this.undos[this.undoIndex--], true)
    }
  },

  /**
   * This is the function that actually performs the mutations in Undo items and
   * then restores appropriate selection. It uses the undoIndex property to
   * determine which Undo to redo or undo.
   *
   * @param {Object} undo
   * @param {boolean} [isUndo] - Determines whether we should do undo or redo
   */
  undoRedo (undo, isUndo) {
    this.disable()

    /* reverse the mutation collection if we are doing undo (we want to
     * execute the mutations in the opposite order to undo them
     */
    const mutations = isUndo ? undo.mutations.slice(0).reverse() : undo.mutations

    mutations.forEach((mutation) => {
      switch (mutation.type) {
        case 'characterData':
          // update the textContent
          mutation.target.textContent = isUndo ? mutation.oldValue : mutation.newValue
          break
        case 'attributes':
          // update the attribute
          const value = isUndo ? mutation.oldValue : mutation.newValue

          if (value || value === false || value === 0) { mutation.target.setAttribute(mutation.attributeName, value) } else { mutation.target.removeAttribute(mutation.attributeName) }

          break
        case 'childList':
          // set up correctly what nodes to be added and removed
          const addNodes = isUndo ? mutation.removedNodes : mutation.addedNodes
          const removeNodes = isUndo ? mutation.addedNodes : mutation.removedNodes

          Array.from(addNodes).forEach(mutation.nextSibling ? (node) => {
            mutation.nextSibling.parentNode.insertBefore(node, mutation.nextSibling)
          } : (node) => {
            mutation.target.appendChild(node)
          })

          // remove all nodes to be removed
          Array.from(removeNodes).forEach(function (node) {
            node.parentNode.removeChild(node)
          })

          break
      }
    })

    /* use `isUndo` to determine whether we should use selection before (undo)
     * or after mutations (redo)
     */
    if (this.restore instanceof Function) {
      this.restore(isUndo ? undo.data.before : undo.data.after)
    }

    // reenable
    this.enable()
  },
}

export default Snapback
