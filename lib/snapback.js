var bindAll = require('lodash/function/bindAll'),
	isFunction = require('lodash/lang/isFunction'),
	assign = require('lodash/object/assign'),
	toArray = require('lodash/lang/toArray'),
	last = require('lodash/array/last');

var Snapback = function(element, options) {
	var MO = typeof MutationObserver !== 'undefined' ? MutationObserver : (typeof WebKitMutationObserver !== 'undefined' ? WebKitMutationObserver : undefined);

	if(!MO) return;

	bindAll(this, 'addMutation');

	assign(this, {
		config: { subtree: true, attributeFilter: [ 'style' ], attributes: true, attributeOldValue: true, childList: true, characterData: true, characterDataOldValue: true },
		element: element,
		undos: [],
		mutations: [],
		undoIndex: -1,
	}, options);

	this.observer = new MO(function(mutations) {
		mutations.forEach(this.addMutation);    
	}.bind(this));
};

Snapback.prototype = {
	addMutation: function(mutation) {
		switch(mutation.type) {
			case 'characterData': 
				mutation.newValue = mutation.target.textContent;

				var lastMutation = last(this.mutations);

				if(lastMutation && lastMutation.type === 'characterData' && lastMutation.target === mutation.target && lastMutation.newValue === mutation.oldValue) {
					lastMutation.newValue = mutation.newValue;
					return;
				} 
				break;
			case 'attributes':
				mutation.newValue = mutation.target.getAttribute(mutation.attributeName);
				break;
		}

		this.mutations.push(mutation);
	},

	disable: function() {
		if(this.enabled) {
			this.observer.disconnect();
			this.enabled = false;
		}
	},

	enable: function() {
		if(!this.enabled) {
			this.observer.observe(this.element, this.config);
			this.enabled = true;
		}
	},

	register: function() {
		if(this.mutations.length > 0) {
			// only register a new undo if there are mutations in the stack
			if(this.undoIndex < this.undos.length - 1) {
				// remove any undos after undoIndex, ie the user
				// has undo'd and a new undo branch/tree is needed
				this.undos = this.undos.slice(0, this.undoIndex + 1);
			}

			this.undos.push({
				data: isFunction(this.store) ? {
					before: this.data,
					after: this.store()
				} : undefined,
				mutations: this.mutations
			});

			this.mutations = [];

			this.undoIndex = this.undos.length - 1;
		}
	},

	redo: function() {
		if(this.enabled && this.undoIndex < this.undos.length - 1) {
			this.undoRedo(this.undos[++this.undoIndex], false);
		}
	},

	undo: function() {
		this.register();

		if(this.enabled && this.undoIndex >= 0) {
			this.undoRedo(this.undos[this.undoIndex--], true);
		}
	},

	undoRedo: function(undo, isUndo) {
		this.disable();

		var mutations = isUndo ? undo.mutations.slice(0).reverse() : undo.mutations;

		mutations.forEach(function(mutation) {
			switch(mutation.type) {
				case 'characterData':
					mutation.target.textContent = isUndo ? mutation.oldValue : mutation.newValue;
					break;
				case 'attributes':
					var value = isUndo ? mutation.oldValue : mutation.newValue;

					if(value || value === false || value === 0)
						mutation.target.setAttribute(mutation.attributeName, value);
					else
						mutation.target.removeAttribute(mutation.attributeName);

					break;
				case 'childList':
					var addNodes = isUndo ? mutation.removedNodes : mutation.addedNodes;

					toArray(addNodes).forEach(mutation.nextSibling ? function(node) {
						mutation.nextSibling.parentNode.insertBefore(node, mutation.nextSibling);
					} : function(node) {
						mutation.target.appendChild(node);
					});

					toArray(isUndo ? mutation.addedNodes : mutation.removedNodes).forEach(function(node) {
						node.parentNode.removeChild(node);
					});

					break;
			}
		});

		isFunction(this.restore) && this.restore(isUndo ? undo.data.before : undo.data.after);

		this.enable();
	}
};

module.exports = Snapback;
