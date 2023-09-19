///////////////////////////////////////////////////////////
//
// sign_qr.js - sign a transaction and show TX data as QR code in offline.
// syntax: node escrow [PUB|TEST|DEV] ACCOUNT XRP_ESCROW ESCROW_RELEASE_TIME
//
// Docs: https://xrpl.org/secure-signing.html
//       https://xrpl.org/set-up-secure-signing.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'sign_qr';

const { dropsToXrp } = require("xrpl");

const { fail, defineMainParams } = require('./libs/common.js');
const { Sign, Wallet } = require('./sign.js');
const { ShowHtmlQR } = require('./qr.js');
const { DescribeSetFlag } = require('../account_settings/account_set.js');

const main_params = {
	tx: { id: 1, default: '', required: true, desc: 'transaction in json string format' },
	key: { id: 2, default: '', mandatory_required: true, desc: 'secret seed/mnemonic to sign with', scramble: true },
};

const SignQR = async function ({ transaction, multisign, wallet, qrTxFields, qrAddtnFields }) {
	const tx = Sign({ transaction, multisign, wallet });
	const skipAddtnFields = ['Account', 'Destination', 'DestinationTag', 'SourceTag', 'Amount', 'Fee', 'Sequence', 'LastLedgerSequence', 'SetFlag', 'ClearFlag'];

	console.log('\nSIGNED TRANSACTION:');
	console.log(tx);
	console.log('\nUse "hash" value to search detailed information in call `account_transactions` script after the transaction is sent to XRPL.\n');

	const descriptionFieldsTop = [];

	const srcAccText = (transaction.Destination ? 'Source Account' : 'Account');
	if (transaction.Account) { descriptionFieldsTop.push({ name: srcAccText, value: transaction.Account }); }
	if (transaction.Destination) { descriptionFieldsTop.push({ name: 'Destination Account', value: transaction.Destination }); }
	if (transaction.DestinationTag) { descriptionFieldsTop.push({ name: 'Destination Tag', value: transaction.DestinationTag }); }
	if (transaction.SourceTag) { descriptionFieldsTop.push({ name: 'Source Tag', value: transaction.SourceTag }); }
	if (transaction.Amount) { descriptionFieldsTop.push({ name: 'Amount', value: `${dropsToXrp(Number(transaction.Amount))} XRP (${transaction.Amount} drops)` }); }
	if (transaction.Fee) { descriptionFieldsTop.push({ name: 'Fee', value: `${transaction.Fee} drops` }); }
	if (transaction.ClearFlag) { descriptionFieldsTop.push({ name: 'ClearFlag', value: `[${transaction.ClearFlag}] ${DescribeSetFlag(transaction.ClearFlag).name}` }); }
	if (transaction.SetFlag) { descriptionFieldsTop.push({ name: 'SetFlag', value: `[${transaction.SetFlag}] ${DescribeSetFlag(transaction.SetFlag).name}` }); }

	if (qrTxFields) {
		for (let idx in qrTxFields) {
			const fieldName = qrTxFields[idx];
			if (skipAddtnFields.includes(fieldName)) { continue; }
			if (transaction[fieldName]) { descriptionFieldsTop.push({ name: fieldName, value: transaction[fieldName] }); }
		}
	}
	if (qrAddtnFields) {
		for (let idx in qrAddtnFields) {
			const fieldName = qrAddtnFields[idx].name;
			if (skipAddtnFields.includes(fieldName)) { continue; }
			descriptionFieldsTop.push({ name: fieldName, value: qrAddtnFields[idx].value });
		}
	}

	const descriptionFieldsBottom = [
		{ name: 'Data', value: tx.tx_blob },
		{ name: 'Hash', value: tx.hash }
	];
	if (transaction.Sequence) { descriptionFieldsBottom.push({ name: 'Source Account Sequence', value: transaction.Sequence }); }
	if (transaction.LastLedgerSequence) { descriptionFieldsBottom.push({ name: 'Max Ledger Index', value: transaction.LastLedgerSequence }); }

	await ShowHtmlQR(tx.tx_blob, {
		title: `Signed Transaction [${transaction.TransactionType}]`,
		descriptionFieldsTop,
		descriptionFieldsBottom,
	});

	return tx;
}

function parsedTransactionParams(str) {
	return JSON.parse(str);
}

async function main(){
	await defineMainParams(main_params);

	const parsedTx = parsedTransactionParams(main_params.tx.value);
	const transaction = SignQR({ wallet: Wallet(main_params.key.value), transaction: parsedTx });
	console.log(transaction);
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');
	exports.SignQR = SignQR;
}
