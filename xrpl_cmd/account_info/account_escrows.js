///////////////////////////////////////////////////////////
//
// account_escrows.js - common functions
// syntax: node account_escrows [PUB|TEST|DEV] ACCOUNT SEARCH_OFFER_SEQUENCE
//
// Note that the response includes all pending escrow objects with <Account> as the sender or destination address,
// where the sender address is the Account value and the destination address is the Destination value.
//
//
// Docs:
//   https://xrpl.org/escrow-object.html
//   https://xrpl.org/look-up-escrows.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_escrows';

const { rippleTimeToISOTime, dropsToXrp, unixTimeToRippleTime } = require('xrpl');

const { quit, fail, defineMainParams, showLoadedModules, ColoredText } = require('../common/libs/common.js');
const { AccountObjects } = require('./account_objects.js');
const { AccountTransactions } = require('./account_transactions.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	search_offer_sequence: { id: 3, default: 'No', required: true, example: '[Y]es / [N]o' },
}

const AccountEscrows = async function ({ account, network, xrplAddress, client }) {
	const info = await AccountObjects({ account, network, xrplAddress, client });

	if (!info?.result?.account_objects) { fail('Unable to fetch Account Escrows'); }

	return info.result.account_objects.filter(item => (item.LedgerEntryType === 'Escrow'));
}

async function FindAccountEscrow({ account, txHash, txSequence, client, network, xrplAddress }) {
	const data = await AccountTransactions({ account, txHash, txSequence, txType: 'escrow', client, network, xrplAddress });
	if (!data.result?.transactions?.length) { return; }

	if (data.result.transactions.length > 1) {
		console.log('FOUND ESCROW TRANSACTIONS:');
		console.log(data.result.transactions);
		return;
	}

	const txInfo = data.result.transactions[0];

	const allEscrows = await AccountEscrows({ account, client, network, xrplAddress });
	const foundEscrows = allEscrows.filter(item => {
		if (item.Amount !== txInfo.tx.Amount) { return false; }
		if (!txInfo.tx.CancelAfter && item.CancelAfter) { return false; }
		if (!txInfo.tx.FinishAfter && item.FinishAfter) { return false; }
		if (txInfo.tx.CancelAfter && item.CancelAfter != txInfo.tx.CancelAfter) { return false; }
		if (txInfo.tx.FinishAfter && item.FinishAfter != txInfo.tx.FinishAfter) { return false; }
		if (item.PreviousTxnID && txInfo.tx.hash && item.PreviousTxnID !== txInfo.tx.hash) { return false; }
		if (item.PreviousTxnLgrSeq && (txInfo.tx.inLedger || txInfo.tx.ledger_index)) {
			if (txInfo.tx.inLedger && item.PreviousTxnLgrSeq !== txInfo.tx.inLedger) { return false; }
			if (txInfo.tx.ledger_index && item.PreviousTxnLgrSeq !== txInfo.tx.ledger_index) { return false; }
		}
		return true;
	});

	if (!foundEscrows.length) { return; }

	return {
		TransactionResult: txInfo.meta.TransactionResult,
		Amount: txInfo.tx.Amount,
		Destination: txInfo.tx.Destination,
		DestinationTag: txInfo.tx.DestinationTag,
		SourceTag: txInfo.tx.SourceTag,
		Condition: txInfo.tx.Condition,
		CancelAfter: txInfo.tx.CancelAfter,
		FinishAfter: txInfo.tx.FinishAfter,
		Flags: txInfo.tx.Flags,
		Sequence: txInfo.tx.Sequence,
		date: txInfo.tx.date,
		hash: txInfo.tx.hash,
		self: account === txInfo.tx.Destination
	};
}

async function FindCreateEscrowTransactions(txnHashes, { escrows, account, client, network, xrplAddress }) {
	txnHashes = txnHashes.map((item) => item.toUpperCase()); 

	const txData = await AccountTransactions({ account, txHash: txnHashes, txType: 'escrow', client, network, xrplAddress });
	if (!escrows) { return txData; }
	if (!txData.result?.transactions?.length) { return txData; }

	escrows.forEach((escrowItem) => {
		if (!escrowItem.PreviousTxnID) { return; }

		const escrowHash = txnHashes[0]; //escrowItem.PreviousTxnID.toUpperCase();
		if (!txnHashes.some((hash) => escrowHash.match(hash))) { return; }

		const foundTx = txData.result.transactions.filter(txItem => txItem.tx.hash.match(escrowHash));
		if (foundTx.length !== 1) { return; }

		if (foundTx[0].tx?.OfferSequence) { escrowItem._OfferSequence = foundTx[0].tx.OfferSequence; }
	})
}

function showEscrows(escrows) {
	let amount = 0, amountToFinish = 0, amountToCancel = 0, countToFinish = 0, countToCancel = 0;

	console.log(`\nACCOUNT ESCROWS (${escrows.length}):`);

	escrows.forEach((item, idx) => {
		const currentRippleTimestamp = unixTimeToRippleTime(new Date().getTime());

		console.log(`\n===== [${idx + 1}] =====`);
		console.log(`Amount: ${dropsToXrp(item.Amount)} XRP ${ (item.Account === item.Destination) ? 'on self' : 'to another account' }`);
		if (item.FinishAfter) {
			countToFinish++; amountToFinish += Number(item.Amount);
			console.log(`Finish after: ${rippleTimeToISOTime(item.FinishAfter)} (yy-mm-dd) ${currentRippleTimestamp > item.FinishAfter ? ' <[ READY TO FINISH ]>' : ''}`);
		}
		if (item.CancelAfter) {
			countToCancel++; amountToCancel += Number(item.Amount);
			console.log(`Cancel after: ${rippleTimeToISOTime(item.CancelAfter)} (yy-mm-dd) ${currentRippleTimestamp > item.CancelAfter ? ' <[ READY TO CANCEL ]>' : ''}`);
		}
		if (item._OfferSequence) {
			const value = ColoredText(`${item._OfferSequence}`, { color: 'FgYellow' });
			console.log(`\nEscrow TX Sequence: ${value} (use this Sequence value to cancel/finish the escrow)`);
			delete item['_OfferSequence'];
		}

		console.log(item);
		amount += Number(item.Amount);
	})

	console.log(`===== [END] =====`);
	console.log(`\nTOTAL AMOUNT IN ESCROWS: ${dropsToXrp(amount)} XRP (${amount} drops)`);

	if (countToFinish !== 0) { console.log(`\nReady to Finish: ${countToFinish} escrows with total ${dropsToXrp(amountToFinish)} XRP (${amountToFinish} drops)`); }
	if (countToCancel !== 0) { console.log(`\nReady to Cancel: ${countToCancel} escrows with total ${dropsToXrp(amountToCancel)} XRP (${amountToCancel} drops)`); }
}

async function main(){
	await defineMainParams(main_params);

	const escrows = await AccountEscrows({ account: main_params.account.value, network: main_params.network.value });
	if (!escrows.length) { quit(`\nACCOUNT HAS NO ESCROWS`); }

	if (['y', 'yes'].includes(main_params.search_offer_sequence.value.toLowerCase())) {
		const txnHashes = escrows.map((item) => item.PreviousTxnID);

		await FindCreateEscrowTransactions(txnHashes, { escrows, account: main_params.account.value, network: main_params.network.value });
	}

	showEscrows(escrows);
	quit();
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.AccountEscrows = AccountEscrows;
	exports.FindAccountEscrow = FindAccountEscrow;
}
