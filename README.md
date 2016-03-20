# snapback

DOM Undo/Redo library.

## Install

```
npm install snapback
```

## Use

```js
const Snapback = require('snapback');


const snapback = new Snapback(this.el);

snapback.register();

snapback.undo();

snapback.redo();

snapback.enable();

snapback.disable();
```

## Custom Stores

If you need to store and restore some other data,
pass option to the constructor:

```js
const snapback = new Snapback(this.el, {
	/**
	 * Saves and returns the positions of the current selection
	 *
	 * @return {Positions}
	 */
	store: function(data) {
		return (this.data = (data || selektr.get()));
	},

	restore: function(data) {
		this.store(data);

		selektr.restore(data, true);
	},
});
```
