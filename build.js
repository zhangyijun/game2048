//!/usr/bin/node
"use strict";
var fs = require('fs');
var spawn = require('child_process').spawn;

function template(text, replacer) {
	var reg = /\{\{(.+)\}\}/m;
	return text.split('\n').map(function(line) {
		var match = line.match(reg);
		if (!match) return line;
		console.log(match[0]);
		return line.replace(match[0], replacer(match[1]));
	}).join('\n');
}

function fileTemplate(text) {
	return template(text, function(file) {
		return fs.readFileSync(file).toString();
	});
}

function mergeFile() {
	var data = fs.readFileSync('index.xhtml');
	fs.writeFileSync('index.html', fileTemplate(data.toString()));
}
function spawnOpt() {
	return {stdio: ['pipe', 'pipe', 'pipe']};
}
function release(comment) {
	var gitAdd = spawn('git', ['add', '.'], spawnOpt());
	gitAdd.on('exit', function() {
		var commit = spawn('git', ['commit', '-m', comment], spawnOpt());
		commit.on('exit', function() {
			var push = spawn('git', ['push', 'origin', 'gh-pages'], spawnOpt());
		});
	});
}

function main() {
	mergeFile();
	console.log('Success mergeFile');
	var comment = process.argv[0];
	if (!comment) {
		console.log('no comments, merge only');
		return 0;
	}
	release();
}

main();

// test only
// test();
function test() {
	function textTemplate(text) {
		return template(text, function(file) {
			return file;
		});
	}
	var data = fs.readFileSync('index.xhtml');
	console.log(textTemplate(data.toString()));
}