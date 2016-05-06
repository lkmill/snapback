# snapback

DOM Undo/Redo library.

## Demo

There is a demo plunker. You can view it at
<https://embed.plnkr.co/Dl84lxM1fYyldOkkZv9a/>.

## Install

It is highly recommended to use NPM and a bundler like browserify, webpack or
lasso.

```
npm install snapback
```

If you want, you can use npmcdn (<https://npmcdn.com/snapback@latest/dist/snapback.min.js>, or
<https://npmcdn.com/snapback@latest/dist/snapback.js>).

## Use

```js
const Snapback = require('snapback');

const snapback = new Snapback(document.body);

// snapback needs to be enabled to listen for mutations
snapback.enable();

// register mutations as an Undo/Redo object`
snapback.register();

// undo
snapback.undo();

// redo
snapback.redo();

// mutations observers are pretty intense. try to have as few active as possible
snapback.disable();
```

When snapback is enabled, it will store all mutations to a mutations array
(`snapback.mutations`). As soon as you want to create an Undo/Redo object from
the mutation array, you need to call `snapback.register()` (calling
`snapback.undo()` should automatically register any unregistered mutations
before doing an undo.

If you pass a `{ timeout: Number }` to the constructor, snapback will
register any undos if no new mutations are added before timeout.

## Configuration

The main thing you want to configure is probably what the MutationObserver
should be observing. By default, it watches pretty much everything. IE,
the default is:

```js
{
  subtree: true,
  attributes: true,
  attributeOldValue: true,
  childList: true,
  characterData: true,
  characterDataOldValue: true
}
```

NOTE: if you observe attributes or characterData, you HAVE to add the option
for their old value.

So, to create a snapback instance that only watches for node insertions
and removals, and automatically registers undos after 1 sec:

```js
const snapback = new Snapback(someElement, {
  observe: { subtree: true, childList: true },
  timout: 1000
});
```

## Custom Stores

If you need to store and restore some custom data, you can to pass two methods
as options, `store` and `restore`. The store function needs to save any data
to `this.data`. When an Undo gets created, it will grab the current value in
`this.data` as the data "before" the undo, and will make a new call to
`this.store()` to calculate the data "after" the undo.

When `snapback.undo()` or `snapback.redo()` is called, `this.restore` will be
called with the before or after data respectively.

This functionality was implemented to allow storing and restoring text
selections before and after undos (using [selektr](http://github.com/lohfu/selektr)).

NOTE: You will probably need to call `snapback.store()` manually to
ensure the correct data is set. With selektr, this is done on any movement
keystrokes or mouse up (selections).

```js
const snapback = new Snapback(this.el, {
	/**
   * This has to save to `this.data`!
	 */
	store: function(data) {
		return (this.data = (data || selektr.get()));
	},

	restore: function(data) {
		selektr.restore(data, true);

    // restored selection is now current selection, ie save it.
    this.store(data);
	},
});
```

The actual code that does this simply looks like this:

```
this.undos.push({
  data: isFunction(this.store) ? {
    before: this.data,
    after: this.store()
  } : undefined,
  mutations: this.mutations
});
```

And then, inside `undoRedo` it is applied with

```
isFunction(this.restore) && this.restore(isUndo ? undo.data.before : undo.data.after);
```
