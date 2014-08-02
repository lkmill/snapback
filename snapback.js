var Snapback = function(element, config) {
	var that = this;

	this.config = typeof config === 'string' ? this.presets[config] : config;
	this.element = element;
	this.undos = [];
	this.mutations = [];
	this.undoIndex = -1;
	this.active = false;
	this.selection = null;

	this.timeout = null;
	this.isTyping = false;
	this.oldValue = null;
	this.newValue = null;
	this.observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			function finishedTyping() {
				clearTimeout(timeout);
				var undo = { target: target, oldValue: oldValue, newValue: newValue }; 
				this.addMutation(undo);
				setUndo();
				oldValue = null;
				newValue = null;
				isTyping = false;
			}
			var fix = false;
			switch(mutation.type) {
				case 'childList':
					//if(isTyping) finishedTyping();
					if (mutation.target === element) {
						_.each(mutation.addedNodes, function(node) {
							if(node.nodeType === 3 || node.nodeName.toLowerCase() === 'div') {
								fix = true;
								var content = node.textContent !== '' ? node.textContent : '<br />';
								var p = O('<p>' + content + '</p>');
								that.toggle();
								node.replaceWith(p);
								that.toggle();
								S.caret(p, false);
								that.addMutation({ addedNodes: [ p ], removedNodes: [], target: mutation.target, next: p.nextSibling, prev: p.previousSibling });
							}
						});
					} else {
						_.each(mutation.addedNodes, function(node) {
							if(node.nodeType ===1 ) {
								node.removeAttribute('style');
								if(node.nodeName.toLowerCase() === 'span') {
									fix = true;
									if(node.firstChild) {
										var prev = node.previousSibling;
										var oldValue = prev.textContent;
										that.toggle();
										prev.textContent = prev.textContent + node.textContent;
										node.remove();
										that.toggle();
										that.addMutation({ target: prev, oldValue: oldValue, newValue: prev.textContent});
										S.caret({ start: { node: prev, offset: oldValue.length }}, true);
									} else {
										node.remove();
									}
								}
							}
						});
					}
					if(!fix) that.addMutation(mutation);
					break;
				case 'characterData':
					var undo = { target: mutation.target, oldValue: mutation.oldValue, newValue: mutation.target.textContent }; 
					that.addMutation(undo);
					//if(!isTyping) {
					//	oldValue = mutation.oldValue;
					//	isTyping = true;
					//	target = mutation.target;
					//} else {
					//	clearTimeout(timeout);
					//	newValue = mutation.target.textContent;
					//}
					//timeout = setTimeout(function() {
					//	finishedTyping();
					//}, 1000);
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
			type: false
		},
		spytext: {
			mutationObserver: { subtree: true, childList: true, characterData: true, characterDataOldValue: true },
			selection: true,
			type: true
		}
	},
	addMutation: function(mutation) {
		if(mutation.oldValue) {
			this.mutations.push({ target: mutation.target, oldValue: mutation.oldValue, newValue: mutation.target.textContent });
		} else {
			var addedNodes = [];
			_.each(mutation.addedNodes, function(node) {
				addedNodes.push({ target: node, next: mutation.nextSibling, prev: mutation.previousSibling, parent: mutation.target });
			});
			var removedNodes = [];
			_.each(mutation.removedNodes, function(node) {
				var next = mutation.nextSibling;
				var prev = mutation.previousSibling;
				removedNodes.push({ target: node, next: next, prev: prev, parent: mutation.target });
			});
			var obj = { addedNodes: addedNodes, removedNodes: removedNodes};
			this.mutations.push(obj);
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
	register: function() {
		if(this.active && this.mutations.length > 0) {
			if(this.undoIndex < this.undos.length - 1) {
				this.undos = this.undos.slice(0, this.undoIndex + 1);
			}
			//undos.push({ selectionBefore: selectionBefore, selectionAfter: S.save(), mutations: mutations });
			this.undos.push(this.mutations);
			this.mutations = [];
			this.undoIndex = this.undos.length -1;
		}
		//selectionBefore = S.save();
	},
	setSelection: function(selection) {
		this.selection = selection ? selection : S.save();
		console.log(this.selection);
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
		//var mutations = isUndo ? undo.mutations.slice(0).reverse() : undo.mutations;
		var mutations = isUndo ? undo.slice(0).reverse() : undo;
		for(var s = 0; s < mutations.length; s++) {
			if(mutations[s].oldValue) {
				mutations[s].target.textContent = isUndo ? mutations[s].oldValue : mutations[s].newValue;
			} else {
				var addNodes = isUndo ? mutations[s].removedNodes : mutations[s].addedNodes;
				var removeNodes = isUndo ? mutations[s].addedNodes : mutations[s].removedNodes;
				for(var j = 0; j < addNodes.length; j++) {
					var node = addNodes[j];
					if (node.next) {
						node.parent.insertBefore(node.target, node.next);
					} else {
						node.parent.append(node.target);
					}
				}
				for(var i in removeNodes) {
					removeNodes[i].target.remove();
				}
			}
		}
		this.toggle();
	}
};
