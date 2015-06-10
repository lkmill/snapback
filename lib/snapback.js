function merge() {
	function recurse(inObj, inMerge) {
		for(var property in inMerge) {
			if(!inMerge.hasOwnProperty(property)) continue;

			if(typeof inObj[property] === 'object' && typeof inMerge[property] === 'object') {
				recurse(inObj[property], inMerge[property]);
			} else {
				inObj[property] = inMerge[property];
			}
		}
	}
	var obj = arguments[0];

	for(var i = 1; i < arguments.length - 1; i++) {
		recurse(obj, arguments[i]);
	}

	return obj;
}
var Snapback = function(element, config) {
	var MO = typeof MutationObserver !== 'undefined' ? MutationObserver : (typeof WebKitMutationObserver !== 'undefined' ? WebKitMutationObserver : undefined);
	if(!MO) return;
	var that = this;

	//this.config = {};

	//var property;
	//if(config && typeof config.preset === 'string') 
	//	for(property in this.presets[config.preset]) 
	//		this.config[property] = this.presets[config.preset][property];
	//for(property in config) 
	//	this.config[property] = config[property];
	this.config = typeof config.preset === 'string' ? merge(this.presets[config.preset], config) : config;
	this.element = element;
	this.undos = [];
	this.mutations = [];
	this.undoIndex = -1;
	this.enabled = false;
	this.selectron = this.config.selectron ? this.config.selectron : null;
	this.positron = this.selectron ? this.getPositron() : null;

	this.observer = new MO(function(mutations) {
		mutations.forEach(function(mutation) {
			switch(mutation.type) {
				case 'childList':
				case 'attributes':
				case 'characterData':
					that.addMutation(mutation);
					break;
				//case 'childList':
				//	var fix = (that.config.typing) ? that.fixType(mutation) : false;
				//	if(!fix) that.addMutation(mutation);
				//	break;
				//case 'attributes':
				//	that.addMutation(mutation);
				//	break;
				//case 'characterData':
				//	that.addMutation(mutation);
				//	break;
			}
		});    
	});
};
Snapback.prototype = {
	presets: {
		standard: {
			mutationObserver: { subtree: true, childList: true }
			//typing: false
		},
		spytext: {
			mutationObserver: { subtree: true, attributeFilter: [ 'style' ], attributes: true, attributeOldValue: true, childList: true, characterData: true, characterDataOldValue: true }
			//typing: true
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
	//fixType: function(mutation){
	//	var fix = false;
	//	var that = this;
	//	this.disable();
	//	if (mutation.target === this.element) {
	//		_.each(mutation.addedNodes, function(node) {
	//			if(node.nodeType === 3 || node.nodeName.toLowerCase() === 'div') {
	//				console.log('fixing div');
	//				fix = true;
	//				var content = node.textContent !== '' ? node.textContent : '<br />';
	//				var p = O('<p>' + content + '</p>');
	//				node.replaceWith(p);
	//				that.selectron.set(p, p.textContent.length);
	//				that.addMutation({ type: 'childList', addedNodes: [ p ], removedNodes: [], target: p.parentNode, nextSibling: p.nextSibling, previousSibling: p.previousSibling });
	//			}
	//		});
	//	} else {
	//		_.each(mutation.addedNodes, function(node) {
	//			if(node.nodeType ===1 ) {
	//				node.removeAttribute('style');
	//				if(node.nodeName.toLowerCase() === 'span') {
	//					console.log('fixing span');
	//					var positron = that.getPositron();
	//					fix = true;
	//					if(node.firstChild && node.textContent.length > 0) {
	//						var prev = node.previousSibling;
	//						var next = node.nextSibling;
	//						node.vanish();
	//						if(prev) {
	//							var oldValue = prev.textContent;
	//							prev.textContent = oldValue + node.textContent;
	//							that.addMutation({ type: 'characterData', target: prev, oldValue: oldValue, newValue: prev.textContent});
	//						} else {
	//							while(node.firstChild) {
	//								var child = node.firstChild;
	//								if(next) {
	//									next.before(node.firstChild);
	//								} else {
	//									mutation.target.append(child);
	//								}
	//								that.addMutation({ type: 'childList', addedNodes: [ child ], removedNodes: [], target: mutation.target, previousSibling: null, nextSibling: next });
	//							}
	//						}
	//					} else {
	//						node.vanish();
	//					}
	//					positron.restore();
	//				}
	//			}
	//		});
	//	}
	//	this.enable();
	//	return fix;
	//},
	register: function() {
		if(!this.element) return;
		if(this.enabled && this.mutations.length > 0) {
			if(this.undoIndex < this.undos.length - 1) {
				this.undos = this.undos.slice(0, this.undoIndex + 1);
			}
			var positrons;
			if(this.selectron) {
				positrons = {};
				positrons.before = this.positron;
				positrons.after = this.getPositron();
			} else {
				positrons = null;
			}
			this.undos.push({ positrons: positrons, mutations: this.mutations });
			this.mutations = [];
			this.undoIndex = this.undos.length -1;
		}
		if(this.selectron) this.setPositron();
	},
	setPositron: function(positron) {
		if(!this.element) return;
		this.positron = positron || this.getPositron();
	},
	getPositron: function() {
		if(!this.element) return;
		return this.selectron.get();
	},
	size: function() {
		if(!this.element) return;
		return this.undos.length;
	},
	enable: function() {
		if(!this.element) return;
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
		if(!this.element) return;
		this.disable();
		if(this.mutations.length > 0) {
			this.register();
		}
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
						if (mutation.nextSibling) {
							mutation.nextSibling.before(addNodes[j]);
						} else {
							mutation.target.append(addNodes[j]);
						}
					}
					for(var i = 0; i < removeNodes.length; i++) {
						removeNodes[i].vanish();
					}
					break;
			}
		}
		if(this.config.selectron) {
			if(isUndo) undo.positrons.before.restore();
			else undo.positrons.after.restore();
		}
		this.enable();
	}
};
module.exports = Snapback;
