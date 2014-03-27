"use strict";

function Cell(x, y) {
	this.x = x;
	this.y = y;
	this.value = 0;
}

Cell.prototype = {

	isEmpty: function() {
		return this.value === 0;
	},
	eq: function(other) {
		// ignore 0?
		return other.value === this.value;
	},
	toString: function() {
		return this.x + ', '+this.y +': '+this.value;
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
	}

};


function Matrix (size) {
	this.size = size;
	this.rows = [];
	for (var i=0; i<size; i++) {
		var row = [];
		this.rows.push(row);
		for (var j=0; j<size; j++) {
			row.push(new Cell(j, i));
		}
	}
}

Matrix.prototype = {

	// toggle some direction, return true if change
	toggle: function(direction) {
		var index = 1;
		var self = this;
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
		this.move(direction);
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
	reset: function() {
		this.each(function(cell) {cell.value= 0;});
	},
	score: function() {
		var score = 0;
		this.each(function(cell) {
			score += cell.value;
		});
		return score;
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
		var valueRandom = Math.random()*4;
		var value = valueRandom > 1 ? 2 : 4;	// 25% 4, other 2
		var index = Math.floor(cells.length * Math.random());
		var cell = cells[index];
		cell.value = value;
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
		var near = this.nextCell(cell, direction);
		if (!near) return false;
		return near.value === cell.value;
	},

	merge: function(cell, direction) {
		var near = this.nextCell(cell, direction);
		if (near.value !== cell.value) {
			throw new Error('Invalid call merge: ' +cell+', near='+near);
		}
		near.value = near.value + cell.value;
		cell.value = 0;
	},

	move: function(direction) {
		var moved = false;
		var self = this;
		var cells = this.digitCells();
		cells.forEach(function(cell) {
			var near = self.nextCell(cell, direction);
			if (near && near.isEmpty()) {
				moved = true;
				near.value = cell.value;
				cell.value = 0;
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

function MatrixView(matrix, el, options) {
	this.matrix = matrix;
	this.options = options;
	this.element = el;
}

MatrixView.prototype = {
	render: function() {
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
		var fn = this.arrowEvent.bind(this);
		if (document.addEventListener) {
			document.addEventListener('keydown', fn);
		} else {
			window.attachEvent('keydown', fn);
		}
		this.update();
	},
	update: function() {
		var values = this.matrix.rows;
		var cells = this.rows;
		var size = this.matrix.size;
		for (var i=0; i<size; i++) {
			for (var j=0; j<size; j++) {
				var cell = cells[j][i];
				var value = values[j][i];
				cell.innerText = value.isEmpty() ? '' : value.value;
			}
		}
	},
	arrowEvent: function(event) {
		if (this.matrix.isDead()) {
			alert('Game Over, Total score '+this.matrix.score());
			this.matrix.reset();
			this.update();
			return ;
		}
		var code = event.keyCode;
		switch (code) {
			case 37: this.matrix.toggle(3); break;	// left
			case 38: this.matrix.toggle(0); break;	// up
			case 39: this.matrix.toggle(1); break;	// right
			case 40: this.matrix.toggle(2); break;	// down

			// test
			case 13: this.matrix.next(); break;
			default: return true;
		}
		this.update();
		var self = this;
		setTimeout(function() {
			self.next();
		}, 500);
	},
	next: function() {
		if (this.matrix.isDead()) {
			alert('Game Over, Total score '+this.matrix.score());
			this.matrix.reset();
			this.update();
		}
		this.matrix.next();
		this.update();
	}
};

window.onload = function() {
	var viewEl = document.getElementById('gamecells');
	var model = new Matrix(4);
	var view = new MatrixView(model, viewEl, {});
	// test code here
	//model.rows[0][0].value = 2;
	//model.rows[1][2].value = 4;
	//model.rows[2][3].value = 2048;
	view.render();

};

