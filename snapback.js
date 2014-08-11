var Snapback = function(element, config) {
	var that = this;

	this.config = typeof config === 'string' ? this.presets[config] : config;
	this.element = element;
	this.undos = [];
	this.mutations = [];
	this.undoIndex = -1;
	this.enabled = false;
	this.selectron = null;

	this.observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			switch(mutation.type) {
				case 'childList':
					var fix = (that.config.typing) ? that.fixType(mutation) : false;
					if(!fix) that.addMutation(mutation);
					break;
				case 'attributes':
					that.addMutation(mutation);
					break;
				case 'characterData':
					that.addMutation(mutation);
					break;
			}
		});    
	});
};
Snapback.prototype = {
	presets: {
		standard: {
			mutationObserver: { subtree: true, childList: true },
			selectron: false,
			typing: false
		},
		spytext: {
			mutationObserver: { subtree: true, attributeFilter: [ 'style' ], attributes: true, attributeOldValue: true, childList: true, characterData: true, characterDataOldValue: true },
			selectron: true,
			typing: true
		}
	},
	addMutation: function(mutation) {
		switch(mutation.type) {
			case 'characterData': 
				mutation.newValue = mutation.target.textContent;
				var lastIndex = this.mutations.length - 1;
				if(lastIndex > -1 && this.mutations[lastIndex].type === 'characterData' && this.mutations[lastIndex].target === mutation.target && this.mutations[lastIndex].newValue === mutation.oldValue) {
					this.mutations[lastIndex].newValue = mutation.newValue;
				} else {
					this.mutations.push(mutation);
				}
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
	redo: function() {
		if(this.enabled && this.undoIndex < this.undos.length - 1) {
			this.undoIndex++;
			this.undoRedo(this.undos[this.undoIndex], false);
		}
	},
	fixType: function(mutation){
		var fix = false;
		var that = this;
		this.disable();
		if (mutation.target === this.element) {
			_.each(mutation.addedNodes, function(node) {
				if(node.nodeType === 3 || node.nodeName.toLowerCase() === 'div') {
					fix = true;
					var content = node.textContent !== '' ? node.textContent : '<br />';
					var p = O('<p>' + content + '</p>');
					node.replaceWith(p);
					S.caret(p, true);
					that.addMutation({ type: 'childList', addedNodes: [ p ], removedNodes: [], target: p.parentNode, nextSibling: p.nextSibling, previousSibling: p.previousSibling });
				}
			});
		} else {
			_.each(mutation.addedNodes, function(node) {
				if(node.nodeType ===1 ) {
					node.removeAttribute('style');
					if(node.nodeName.toLowerCase() === 'span') {
						var selectron = that.getSelectron();
						fix = true;
						if(node.firstChild && node.textContent.length > 0) {
							var prev = node.previousSibling;
							var next = node.nextSibling;
							node.remove();
							if(prev) {
								var oldValue = prev.textContent;
								prev.textContent = oldValue + node.textContent;
								that.addMutation({ type: 'characterData', target: prev, oldValue: oldValue, newValue: prev.textContent});
							} else {
								while(node.firstChild) {
									var child = node.firstChild;
									if(next) {
										next.before(node.firstChild);
									} else {
										mutation.target.append(child);
									}
									that.addMutation({ type: 'childList', addedNodes: [ child ], removedNodes: [], target: mutation.target, previousSibling: null, nextSibling: next });
								}
							}
						} else {
							node.remove();
						}
						selectron.load();
					}
				}
			});
		}
		this.enable();
		return fix;
	},
	register: function() {
		if(this.enabled && this.mutations.length > 0) {
			if(this.undoIndex < this.undos.length - 1) {
				this.undos = this.undos.slice(0, this.undoIndex + 1);
			}
			var selectron;
			if(this.config.selectron) {
				var currentSelectron = this.getSelectron();
				selectron = {};
				selectron.before = this.selectron;
				selectron.after = currentSelectron;
				this.setSelectron(currentSelectron);
			} else {
				selectron = null;
			}
			this.undos.push({ selectron: selectron, mutations: this.mutations });
			this.mutations = [];
			this.undoIndex = this.undos.length -1;
		}
	},
	setSelectron: function(selectron) {
		this.selectron = selectron || this.getSelectron();
	},
	getSelectron: function() {
		if(S.s().rangeCount > 0) {
			//return S.save(this.element);
			return S.save('[spytext-field] > *, [spytext-field]');
		} else {
			return S.save(this.element, 0);
		}
	},
	size: function() {
		return this.undos.length;
	},
	enable: function() {
		if(!this.enabled) {
			this.observer.observe(this.element, this.config.mutationObserver);
			this.enabled = true;
		}
	},
	disable: function() {
		if(this.enabled) {
			this.observer.disconnect();
			this.enabled = false;
		}
	},
	undo: function() {
		if(this.enabled && this.undoIndex >= 0) {
			this.undoRedo(this.undos[this.undoIndex], true);
			this.undoIndex--;
		}
	},
	undoRedo: function(undo, isUndo) {
		this.disable();
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
		if(this.config.selectron) {
			if(isUndo) undo.selectron.before.load();
			else undo.selectron.after.load();
		}
		this.enable();
	}
};
