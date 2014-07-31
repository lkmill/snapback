var Snapback = function(element) {
	var that = this;
	function addMutation(mutation) {
		if(mutation.oldValue) {
			mutations.push({ target: mutation.target, oldValue: mutation.oldValue, newValue: mutation.target.textContent });
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
			mutations.push(obj);
		}
	}
	function undoRedo(undo, isUndo) {
		that.toggle();
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
		//if(isUndo) u.selectionBefore.load();
		//else u.selectionAfter.load();
		that.toggle();
	}
	var config = { subtree: true, childList: true, characterData: true, characterDataOldValue: true };

	var timeout = null;
	var isTyping = false;
	var oldValue = null;
	var newValue = null;
	var observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			function finishedTyping() {
				clearTimeout(timeout);
				var undo = { target: target, oldValue: oldValue, newValue: newValue }; 
				addMutation(undo);
				setUndo();
				oldValue = null;
				newValue = null;
				isTyping = false;
			}
			var fix = false;
			switch(mutation.type) {
				case 'childList':
					if(isTyping) finishedTyping();
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
								addMutation({ addedNodes: [ p ], removedNodes: [], target: mutation.target, next: p.nextSibling, prev: p.previousSibling });
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
										addMutation({ target: prev, oldValue: oldValue, newValue: prev.textContent});
										S.caret({ start: { node: prev, offset: oldValue.length }}, true);
									} else {
										node.remove();
									}
								}
							}
						});
					}
					if(!fix) addMutation(mutation);
					break;
				case 'characterData':
					console.log('characterData');
					var undo = { target: mutation.target, oldValue: mutation.oldValue, newValue: mutation.target.textContent }; 
					addMutation(undo);
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

	var undoStack = [];
	var mutations = [];
	var undoIndex = -1;
	var active = false;

	this.size = function() {
		return undoStack.length;
	};
	this.isActive = function() {
		return active;
	};
	this.toggle = function() {
		if(active) observer.disconnect();
		else observer.observe(element, config);
		active = !active;
	};
	this.register = function() {
		console.log('adding to undoStack');
		if(active && mutations.length > 0) {
			if(undoIndex < undoStack.length - 1) {
				console.log('clearing some undos');
				undoStack = undoStack.slice(0, undoIndex + 1);
			}
			//undoStack.push({ selectionBefore: selectionBefore, selectionAfter: S.save(), mutations: mutations });
			undoStack.push(mutations);
			mutations = [];
			undoIndex = undoStack.length -1;
		}
		//selectionBefore = S.save();
	};
	this.undo = function() {
		if(active && undoIndex >= 0) {
			undoRedo(undoStack[undoIndex], true);
			undoIndex--;
		} else {
			console.log('undo: nothing to do');
			console.log(undoIndex);
		}
	};
	this.redo = function() {
		if(active && undoIndex < undoStack.length - 1) {
			undoIndex++;
			undoRedo(undoStack[undoIndex], false);
		} else {
			console.log('redo: nothing to do');
			console.log(undoIndex);
		}
	};
};
