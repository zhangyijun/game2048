"use strict";

function Cell(x, y) {
	this.x = x;
	this.y = y;
	this._value = 0;
}

Cell.prototype = {

	isEmpty: function() {
		return this._value === 0;
	},
	eq: function(other) {
		// ignore 0?
		return other._value === this._value;
	},
	toString: function() {
		return this.x + ', '+this.y +': '+this._value;
	},
	near: function(direction) {
		var x = this.x;
		var y = this.y;
		switch (direction) {
			case 0: return new Cell(x, y-1);
			case 1: return new Cell(x+1, y);
			case 2: return new Cell(x, y+1);
			case 3: return new Cell(x-1, y);
			default: throw new Error('Invalid direction '+direction);
		}
	},
	isValid: function(size) {
		if (this.x < 0 || this.y < 0) return false;
		if (this.x >= size || this.y >= size) return false;
		return true;
	},
	value: function(val) {
		if (typeof val === 'undefined') return this._value;
		var old = this._value;
		this._value = val;
		this.fire('change', val, old);
	}

};

function Matrix (size) {
	this.size = size;
	this.rows = [];
	this.init();
}

Matrix.prototype = {
	init: function() {
		this.changes = [];
		var self = this;
		// hack, add ref avoid jshint warning
		var ref = {
			onChange: function (val, old) {
				var event = {value: val, old: old};
				event.cell = this;
				self.changes.push(event);
			}
		};
		
		for (var i=0; i<this.size; i++) {
			var row = [];
			this.rows.push(row);
			for (var j=0; j<this.size; j++) {
				var cell = new Cell(j, i);
				cell.on('change', ref.onChange);
				row.push(cell);
			}
		}
	},
	// toggle some direction, return true if change
	toggle: function(direction) {
		var index = 1;
		var self = this;
		this.clearChanges();
		while (index < this.size) {
			var rows = this.getLine(direction, index);
			for (var r in rows) {
				var cell = rows[r];
				if (self.canMerge(cell, direction)) {
					self.merge(cell, direction);
				}
			}
			//var cells = rows.filter(function(cell) {
			//	return self.canMerge(cell, direction);
			//});

			index++;
		}
		var change = {};
		change.merges = this.clearChanges();
		this.move(direction);
		change.moves = this.clearChanges();
		return change;
	},
	isChanged: function(cell) {
		for (var c in this.changes) {
			if (this.changes[c].cell === cell) return true;
		}
		return false;
	},
	clearChanges: function() {
		var old = this.changes;
		this.changes = [];
		return old;
	},
	vline: function(index) {
		var rows = [];
		for (var i=0; i<this.size; i++) {
			rows.push(this.rows[i][index]);
		}
		return rows;
	},
	
	getLine: function(direction, index) {
		switch (direction) {
			case 0: return this.rows[index];
			case 1: return this.vline(this.size-1-index);
			case 2: return this.rows[this.size-1-index];
			case 3: return this.vline(index);
			default: throw new Error('Invalid direction '+direction);
		}
	},
	cells: function() {
		var rs = [];
		this.each(function(c) {
			rs.push(c);
		});
		return rs;
	},
	each: function(fn) {
		for (var i=0; i<this.size; i++) {
			for (var j=0; j<this.size; j++) fn(this.rows[i][j], i, j);
		}
	},
	getStoreValues: function() {
		var values = [];
		this.each(function(cell) {
			values.push(cell.value());
		});
		return values.join(',');
	},
	setStoreValues: function(string) {
		//console.log('restore from values '+string);
		var index = 0;
		var values = string.split(',');
		this.each(function(cell) {
			var str = values[index++] || '0';
			cell.value(parseInt(str));
			//console.log(cell);
		});
		// clear init changes
		return this.clearChanges();
	},
	save: function(store) {
		store.setItem('values', this.getStoreValues());
		store.setItem('score', this.score);
	},
	restore: function(store) {
		this.setStoreValues(store.getItem('values') || '');
		this.score = store.getInt('score');
	},

	reset: function() {
		this.score = 0;
		this.each(function(cell) {cell.value(0);});
	},
	isFull: function() {
		return this.emptyCells().length === 0;
	},
	emptyCells: function() {
		return this.cells().filter(function(c) {return c.isEmpty();});
	},
	digitCells: function() {
		return this.cells().filter(function(c) {return !c.isEmpty();});
	},

	next: function() {
		var cells = this.emptyCells();
		if (cells.length === 0) {
			throw new Error('Game dead!');
		}
		var valueRandom = Math.random()*6;	// 1/6 4, other 2
		var value = valueRandom > 1 ? 2 : 4;
		var index = Math.floor(cells.length * Math.random());
		var cell = cells[index];
		cell.value(value);
		return cell;
	},

	isDead: function() {
		var cells = this.cells();
		for (var c in cells) {
			var cell = cells[c];
			if (cell.isEmpty() || this.canMerge(cell, 0) || this.canMerge(cell, 1)) return false;
		}
		return true;
	},
	
	canMerge: function(cell, direction) {
		if (cell.isEmpty()) return false;
		var near = this.nextDigit(cell, direction);
		if (!near) return false;
		if (near.value() !== cell.value()) return false;
		if (this.isChanged(near)) return false;
		return true;
	},

	merge: function(cell, direction) {
		var near = this.nextDigit(cell, direction);
		if (near.value() !== cell.value()) {
			throw new Error('Invalid call merge: ' +cell+', near='+near);
		}
		near.value(near.value() + cell.value());
		this.score += near.value();
		cell.value(0);
	},

	move: function(direction) {
		var moved = false;
		var self = this;
		var cells = this.digitCells();
		cells.forEach(function(cell) {
			var near = self.nextCell(cell, direction);
			if (near && near.isEmpty()) {
				moved = true;
				near.value(cell.value());
				cell.value(0);
			} 
		});
		if (moved) this.move(direction);
	},

	nextCell: function(cell, direction) {
		var pos = cell.near(direction);
		if (!pos.isValid(this.size)) return null;
		return this.rows[pos.y][pos.x];
	},
	nextDigit: function(cell, direction) {
		var next = this.nextCell(cell, direction);
		if (!next) return null;
		if (next.isEmpty()) return this.nextDigit(next, direction);
		return next;
	}
};

function MatrixView(matrix, options) {
	this.matrix = matrix;
	this.options = options;
	this.element = options.element;
	this.score = options.score;
	this.highestView = options.highest;
	this.store = options.store;
	this.touchSupport = {};
}

MatrixView.prototype = {
	render: function() {
		this.matrix.restore(this.store);
		this.initTable();
		this.events();
		this.highest = this.store.getInt('highest');
		this.update();
		if (!this.store.getInt('score') || !confirm('Continue last play?, yes contine, no start new game.')) {
			this.start();
		}
	},
	initTable: function() {
		this.rows = [];
		var table = document.createElement('table');
		var tb = document.createElement('tbody');
		table.appendChild(tb);
		var size = this.matrix.size;
		for (var i=0; i<size; i++) {
			var tr = document.createElement('tr');
			tb.appendChild(tr);
			var row = [];
			this.rows.push(row);
			for (var j=0; j<size; j++) {
				var cell = document.createElement('td');
				tr.appendChild(cell);
				row.push(cell);
			}
		}
		// todo clear el
		this.element.appendChild(table);
	},
	events: function() {
		var self = this;
		['keydown', 'touchstart', 'touchend', 'touchmove'].forEach(function(name) {
			self.listen(name);
		});
		window.onunload = this.listener('unload');
	},
	listen: function(name) {
		var fn = this.listener(name);
		if (document.addEventListener) {
			document.addEventListener(name, fn);
		} else {
			document.attachEvent(name, fn);
		}
	},
	listener: function(name) {
		return this[name].bind(this);
	},
	update: function(input) {
		var change = input || {};
		var values = this.matrix.rows;
		var cells = this.rows;
		var size = this.matrix.size;
		for (var i=0; i<size; i++) {
			for (var j=0; j<size; j++) {
				var cell = cells[j][i];
				var value = values[j][i];
				cell.innerText = value.isEmpty() ? '.' : value.value();
				cell.className = this.getViewClass(value.value());
				//cell.innerText = value.value();
			}
		}
		var merges = (change.merges || []).filter(function(e) {
			return 0 !== e.value;
		});
		var updater = this.cellMergeView.bind(this);
		merges.forEach(updater);

		this.score.innerText = this.matrix.score;
		this.highestView.innerText = this.highest;
	},
	getViewClass: function(value) {
		return 'class'+value;
	},
	cellMergeView: function(e) {
		console.log(e);
		var cell = e.cell;
		var view = this.rows[cell.y][cell.x];
		this.activeCell(view, 3);
	},
	activeCell: function(cell, times) {
		if (times <= 0) return ;
		cell.classList.add('active');
		var self = this;
		setTimeout(function() {
			cell.classList.remove('active');
			setTimeout(function() {
				self.activeCell(cell, times-1);
			}, 100);
		}, 100);
	},
	toggle: function(direction) {
		var change = this.matrix.toggle(direction);
		var changes = change.merges.concat(change.moves);
		this.update(change);
		if (changes.length !== 0) {
			var self = this;
			setTimeout(function() {
				self.next();
			}, 300);
		}
	},
	unload: function(event) {
		// keep last record
		this.matrix.save(this.store);
	},
	keydown: function(event) {
		if (this.matrix.isDead()) {
			return this.start();
		}
		var code = event.keyCode;
		switch (code) {
			case 37: this.toggle(3); break;	// left
			case 38: this.toggle(0); break;	// up
			case 39: this.toggle(1); break;	// right
			case 40: this.toggle(2); break;	// down
			case 27: this.start(); break;	// esc
			// test
			//case 13: this.matrix.next(); break;	// enter
			default: return true;
		}
	},
	touchstart: function(e) {
		e.preventDefault();
		var touch = e.touches[0];
		this.touchSupport.startX = touch.pageX;
		this.touchSupport.startY = touch.pageY;
	},
	touchmove: function(e) {
		e.preventDefault();
		var touch = e.touches[0];
		this.touchSupport.endX = touch.pageX;
		this.touchSupport.endY = touch.pageY;
	},
	touchend: function(e) {
		e.preventDefault();
		//var touch = e.touches[0];
		this.doTouch(this.touchSupport);
	},
	doTouch: function(pos) {
		//document.getElementById('debug').innerText = [pos.startX, pos.startY, pos.endX, pos.endY].join(', ');
		//console.log(pos);
		var GAP = 20;
		var x = pos.endX - pos.startX;
		var y = pos.endY - pos.startY;
		if (Math.abs(x) < GAP && Math.abs(y) < GAP) return ;
		if (Math.abs(Math.abs(x) -Math.abs(y)) < GAP) return ;
		if (Math.abs(x) > Math.abs(y)) {
			this.toggle(x > 0 ? 1 : 3);
		}
		else {
			this.toggle(y > 0 ? 2 : 0);
		}
	},
	dead: function() {
		var highest = this.store.getInt('highest');
		var times = this.store.getInt('times');
		if (this.matrix.score > highest) {
			this.highest = highest;
			this.store.setItem('highest', this.matrix.score);
		}
		this.store.setItem('times', times + 1);
		// show final result
		//this.update();
		alert('Game Over, Total score '+this.matrix.score);
		this.start();
	},
	start: function() {
		this.matrix.reset();
		this.matrix.next();
		this.update();
	},
	next: function() {
		this.matrix.next();
		this.update();
		if (this.matrix.isDead()) {
			this.dead();
		}
	}
};

var EventMix = {
	on: function(event, handler) {
		if (!this._listeners) this._listeners = {};
		if (!this._listeners[event]) this._listeners[event] = [];
		this._listeners[event].push(handler);
	},
	fire: function(event) {
		var args = Array.prototype.slice.call(arguments, 1);
		var fns = (this._listeners && this._listeners[event]) || [];
		for (var f in fns) {
			fns[f].apply(this, args);
		}
	}
};
Cell.prototype.on = EventMix.on;
Cell.prototype.fire = EventMix.fire;
Matrix.prototype.on = EventMix.on;
Matrix.prototype.fire = EventMix.fire;
MatrixView.prototype.on = EventMix.on;
MatrixView.prototype.fire = EventMix.fire;


function Store() {
}

Store.prototype = {
	getItem: function(key) {
		if (window.localStorage) {
			return window.localStorage.getItem(key);
		}
		return null;
	},
	setItem: function(key, value) {
		if (window.localStorage) {
			//var type = typeof(value);
			window.localStorage.setItem(key, value);
		}
		return this;
	},
	getInt: function(key) {
		var val = this.getItem(key);
		if (!val) return 0;
		return parseInt(val, 10);
	}
};

window.onload = function() {
	var model = new Matrix(4);
	var view = new MatrixView(model, {
		element: document.getElementById('gamecells'),
		score: document.getElementById('score'),
		highest: document.getElementById('highest'),
		store: new Store()
	});
	// test code here
	//model.rows[0][0].value = 2;
	//model.rows[1][2].value = 4;
	//model.rows[2][3].value = 2048;
	view.render();

	//test();
function test() {
	function buildEvent(touch) {
		return {
			preventDefault: function() {},
			touches: [touch]
		};
	}

	setTimeout(function() {
		view.touchstart(buildEvent({pageX: 100, pageY: 100}));
		view.touchend(buildEvent({pageX: 120, pageY: 200}));

		setTimeout(function() {
			view.touchstart(buildEvent({pageX: 100, pageY: 100}));
			view.touchend(buildEvent({pageX: 110, pageY: 40}));

			setTimeout(function() {
				view.touchstart(buildEvent({pageX: 200, pageY: 100}));
				view.touchend(buildEvent({pageX: 110, pageY: 90}));

			}, 2000);
		}, 2000);
	}, 2000);
}

};

