///////////////////////////////////////////////////////////
//
// memo.js - Memo field support
//
// The Memos field includes arbitrary messaging data with the transaction.
// It is presented as an array of objects.
// Each object has only one field, Memo, which in turn contains another object with
// one or more of the following variable-length fields: MemoData, MemoType, MemoFormat.
//
// MemoType or MemoData are both optional, as long as one of them is present.
//
// The Memos field is limited to no more than 1 KB in size (when serialized in binary format).
//
// The MemoType and MemoFormat fields should only consist of the following characters:
// ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~:/?#[]@!$&'()*+,;=%
//
//
// Docs:
//  https://xrpl.org/transaction-common-fields.html?q=memo#memos-field
////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'memo';

const { ShowLoadedModules } = require('../common_settings.js');

const TYPE_FORMAT_FIELDS_INVALID_REGEX = /[^A-Za-z0-9\-\.\_\~\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\%]/g;

const AddTransactionMemo = function (tx, { data, type, format }) {
	const newMemo = {};

	if (typeof data !== 'undefined') { addMemoData(newMemo, data); }
	if (typeof type !== 'undefined') { addMemoType(newMemo, type); }
	if (typeof format !== 'undefined') { addMemoFormat(newMemo, format); }

	if (Object.keys(newMemo).length === 0) { return false; }

	if (!Array.isArray(tx.Memos)) { tx.Memos = []; }

	tx.Memos.push({ Memo: newMemo });
	return true;
}

const ShowMemos = function (memos, { indent, title } = {}) {
	const list = MapMemos(memos);
	if (!list) { return; }
	if (list.length === 1) { ShowMemoItem(list[0], 0, { title, totalItemsCount: 1 }); return list; }

	list.forEach(function(item, idx){
		ShowMemoItem(item, idx, { indent, title, totalItemsCount: list.length });
	})
	return list;
}

const ShowMemoItem = function (memo, idx, { indent, title, totalItemsCount }) {
	const keys = Object.keys(memo);

	if (keys.length == 0) { return; }
	if (keys.length == 1 && totalItemsCount == 1) { showMemoString(memo[keys[0]], title); return; }

	idx++;
	indent = indent || 0;
	let firstline = true;

	if (title && idx == 1) { console.log(title); }
	keys.forEach(function(key){
		showMemoString(memo[key], '', indent, key, idx, firstline);
		firstline = false;
	})
}

const MapMemos = function (memos) {
	if (!Array.isArray(memos)) { return; }

	const list = [];
	memos.forEach(function(item){
		if (typeof item !== 'object' || !item?.Memo) { return; }

		const mem = {};
		if (item.Memo.MemoData) { mem.data = item.Memo.MemoData; }
		if (item.Memo.MemoType) { mem.type = item.Memo.MemoType; }
		if (item.Memo.MemoFormat) { mem.format = item.Memo.MemoFormat; }

		if (Object.keys(mem).length) { list.push(mem); }
	})
	return list;
}

function showMemoString(hexString, title, indent, memoKey, index, showIndex) {
	const strMaxLen = 128;
	const strDecoded = Buffer.from(hexString, 'hex').toString().substring(0, strMaxLen);
	const showHex = Math.floor(hexString.length * 0.47) > strDecoded.length;

	const indexStr = (index ? `${index}) ` : '');
	const outIndex = (showIndex ? indexStr : '');
	const keyStr = (memoKey ? `${memoKey}: ` : '');
	const firstlineIndent = (indent || 0) + (showIndex ? 0 : indexStr.length);
	const otherlinesIndent = firstlineIndent + (title?.length || 0) + outIndex.length;
	const output = (showHex ? `${hexString}\n${' '.repeat(otherlinesIndent)}${strDecoded}` : strDecoded);

	console.log(`${' '.repeat(firstlineIndent)}${title}${outIndex}${keyStr}\x1b[32m${output}\x1b[0m`);
}

function addMemoData(memo, value) {
	return setMemoField(memo, 'MemoData', value);
}

function addMemoType(memo, value) {
	if (TYPE_FORMAT_FIELDS_INVALID_REGEX.test(value)) { return false; }

	return setMemoField(memo, 'MemoType', value);
}

function addMemoFormat(memo, value) {
	if (TYPE_FORMAT_FIELDS_INVALID_REGEX.test(value)) { return false; }

	return setMemoField(memo, 'MemoFormat', value);
}

function setMemoField(memo, key, value) {
	if (['number', 'boolean'].includes(typeof value)) { value = value.toString(); }
	if (value?.length && !Buffer.isBuffer(value)) { value = Buffer.from(value); }
	if (!value?.length) { return false; }

	memo[key] = value.toString('hex').toUpperCase();
	return true;
}

if (require.main !== module) {
	if (ShowLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.AddTransactionMemo = AddTransactionMemo;
	exports.ShowMemos = ShowMemos;
	exports.MapMemos = MapMemos;
}
