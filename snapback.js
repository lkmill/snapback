var Snapback = function(element, config) {
	var that = this;

	this.config = typeof config === 'string' ? this.presets[config] : config;
	this.element = element;
	this.undos = [];
	this.mutations = [];
	this.undoIndex = -1;
	this.active = false;
	this.selection = null;
	this.captureTyping = this.config.typing || false;

	var timeout = null;
	var isTyping = false;
	var target = null;
	var oldValue = null;
	var newValue = null;
	var typeSelection = null;

	function addTypeMutation() {
		var undo = { type: 'characterData', target: target, oldValue: oldValue, newValue: newValue }; 
		that.addMutation(undo);
		oldValue = null;
		newValue = null;
		isTyping = false;
	}
	function finishedTyping() {
		clearTimeout(timeout);
		if(isTyping) addTypeMutation();
		that.register(typeSelection);
	}
	this.observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			var fix = false;
			switch(mutation.type) {
				case 'childList':
					if(isTyping) addTypeMutation();
					if (mutation.target === element) {
						_.each(mutation.addedNodes, function(node) {
							if(node.nodeType === 3 || node.nodeName.toLowerCase() === 'div') {
								fix = true;
								that.toggle();
								var svd = S.save(that.element);
								var content = node.textContent !== '' ? node.textContent : '<br />';
								var p = O('<p>' + content + '</p>');
								node.replaceWith(p);
								that.toggle();
								that.addMutation({ type: 'childList', addedNodes: [ p ], removedNodes: [], target: p.parentNode, nextSibling: p.nextSibling, previousSibling: p.previousSibling });
								svd.load();
							}
						});
					} else {
						_.each(mutation.addedNodes, function(node) {
							if(node.nodeType ===1 ) {
								node.removeAttribute('style');
								if(node.nodeName.toLowerCase() === 'span') {
									fix = true;
									if(node.firstChild && node.textContent.length > 0) {
										var prev = node.previousSibling;
										var oldValue = prev.textContent;
										var svd = S.save(that.element);
										that.toggle();
										prev.textContent = oldValue + node.textContent;
										node.remove();
										that.toggle();
										svd.load();
										that.addMutation({ type: 'characterData', target: prev, oldValue: oldValue, newValue: prev.textContent});
									} else {
										node.remove();
									}
								}
							}
						});
					}
					if(!fix && !isTyping) that.addMutation(mutation);
					break;
				case 'attributes':
					that.addMutation(mutation);
					break;
				case 'characterData':
					if(that.captureTyping) {
						if(!isTyping) {
							oldValue = mutation.oldValue;
							isTyping = true;
							target = mutation.target;
						} else {
							clearTimeout(timeout);
							newValue = mutation.target.textContent;
						}
						typeSelection = S.save(that.element);
						timeout = setTimeout(function() {
							finishedTyping();
						}, 500);
					} else {
						var undo = { type: mutation.type, target: mutation.target, oldValue: mutation.oldValue, newValue: mutation.target.textContent }; 
						that.addMutation(undo);
					}
					break;
			}
		});    
	});

};
Snapback.prototype = {
	presets: {
		standard: {
			mutationObserver: { subtree: true, childList: true },
			selection: false,
			typing: false
		},
		spytext: {
			mutationObserver: { subtree: true, attributeFilter: [ 'style' ], attributes: true, attributeOldValue: true, childList: true, characterData: true, characterDataOldValue: true },
			selection: true,
			typing: true
		}
	},
	enableCaptureTyping: function() {
		if(this.config.typing) {
			this.captureTyping = true;
		}
	},
	disableCaptureTyping: function() {
		if(this.config.typing) {
			this.captureTyping = false;
		}
	},
	addMutation: function(mutation) {
		switch(mutation.type) {
			case 'characterData': 
				mutation.newValue = mutation.target.textContent;
				this.mutations.push(mutation);
				break;
			case 'attributes':
				mutation.newValue = mutation.target.getAttribute(mutation.attributeName);
				this.mutations.push(mutation);
				break;
			case 'childList':
				this.mutations.push(mutation);
				break;
		}
	},
	isActive: function() {
		return this.active;
	},
	redo: function() {
		if(this.active && this.undoIndex < this.undos.length - 1) {
			this.undoIndex++;
			this.undoRedo(this.undos[this.undoIndex], false);
		}
	},
	register: function(selectionAfter) {
		if(this.active && this.mutations.length > 0) {
			if(this.undoIndex < this.undos.length - 1) {
				this.undos = this.undos.slice(0, this.undoIndex + 1);
			}
			var selection;
			if(this.config.selection) {
				var svd = S.save(this.element);
				selection = {};
				selection.before = this.selection || svd;
				selection.after = selectionAfter || svd;
			} else {
				selection = null;
			}
			this.undos.push({ selection: selection, mutations: this.mutations });
			this.mutations = [];
			this.undoIndex = this.undos.length -1;
		}
		this.setSelection();
	},
	setSelection: function() {
		this.selection = S.save(this.element);
	},
	size: function() {
		return this.undos.length;
	},
	toggle: function() {
		if(this.active) this.observer.disconnect();
		else this.observer.observe(this.element, this.config.mutationObserver);
		this.active = !this.active;
	},
	undo: function() {
		if(this.active && this.undoIndex >= 0) {
			this.undoRedo(this.undos[this.undoIndex], true);
			this.undoIndex--;
		}
	},
	undoRedo: function(undo, isUndo) {
		this.toggle();
		var mutations = isUndo ? undo.mutations.slice(0).reverse() : undo.mutations;
		for(var s = 0; s < mutations.length; s++) {
			var mutation = mutations[s];
			switch(mutation.type) {
				case 'characterData':
					mutation.target.textContent = isUndo ? mutation.oldValue : mutation.newValue;
					break;
				case 'attributes':
					mutation.target.attr(mutation.attributeName, isUndo ? mutation.oldValue : mutation.newValue);
					break;
				case 'childList':
					var addNodes = isUndo ? mutation.removedNodes : mutation.addedNodes;
					var removeNodes = isUndo ? mutation.addedNodes : mutation.removedNodes;
					for(var j = 0; j < addNodes.length; j++) {
						var node = addNodes[j];
						if (mutation.nextSibling) {
							mutation.nextSibling.before(addNodes[j]);
							//node.parent.insertBefore(node.target, node.next);
						} else {
							mutation.target.append(addNodes[j]);
						}
					}
					for(var i = 0; i < removeNodes.length; i++) {
						removeNodes[i].remove();
					}
					break;
			}
		}
		if(this.config.selection) {
			if(isUndo) undo.selection.before.load();
			else undo.selection.after.load();
		}
		this.toggle();
	}
};
