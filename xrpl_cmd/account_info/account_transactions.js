///////////////////////////////////////////////////////////
//
// account_transactions.js - retrieves a list of transactions that involved the specified account.
// syntax: node account_transactions [PUB|TEST|DEV] ACCOUNT TX_LEDGER_INDEX TX_HASH
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_transactions';

const { rippleTimeToISOTime } = require('xrpl');

const { quit, fail, defineMainParams, XrplClient, showLoadedModules } = require('../common/libs/common.js');
const { ShowXrplHighlitedError } = require('../common/libs/errors.js');

const main_params = {
	network: { id: 1, default: '', required: true },
	account: { id: 2, default: '', required: true },
	ledger:  { id: 3, required: false, desc: 'ledger index or transaction hash' },
	tx_hash: { id: 4, required: false },
}

const AccountTransactions = async function ({ account, network, xrplAddress, client, ledgerIndex, txHash, txSequence, txType, limit }) {
	let lclient, info;

	if (txType) { txType = txType.toLowerCase(); }
	if (txSequence && typeof txSequence === 'string') { txSequence = [txSequence]; }
	if (txHash) {
		if (typeof txHash === 'string') { txHash = [txHash.toUpperCase()]; }
		else { txHash = txHash.map((item) => item.toUpperCase()); }
	}

	let reqParams = { account, command: 'account_tx', limit: limit || 1000 };
	if (ledgerIndex) {
		reqParams.ledger_index_min = Number(ledgerIndex);
	} else {
		reqParams.ledger_index_min = -1;
	}

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Account Transactions...');
			lclient = await XrplClient({ network, xrplAddress });
		}

		const response = lclient.request(reqParams);
		response.then(
			result => {
				info = result;
				// const continueTransactionsRequests = searchInTransactions({ info: result, txHash, txSequence, txType });
			},
			error => {
				if (ShowXrplHighlitedError(error) && error?.data) { fail(error.data); }
				else fail(`Error: ${error}`);
			}
		)
		await response;

	} catch(err) {
		fail(err);

	} finally {
		if (!client && lclient) { lclient.disconnect(); }
	}

	// if (!info) { fail('Unable to fetch Account Transactions'); }
	// if (!txHash && !txSequence && !txType) { return info; }
	// if (!info.result?.transactions?.length) { return info; }

	// if (txType) {
	// 	info.result.transactions = info.result.transactions.filter(item => item.tx.TransactionType.toLowerCase().match(txType));
	// }

	// if (txSequence) {
	// 	info.result.transactions = info.result.transactions.filter(item => {
	// 		txSequence.some((seq) => item.tx.Sequence == seq);
	// 	});
	// }

	// if (txHash) {
	// 	info.result.transactions = info.result.transactions.filter(item => {
	// 		txHash.some((hash) => item.tx.hash.match(hash));
	// 	});
	// }

	searchInTransactions({ info, txHash, txSequence, txType });

	return info
}

const searchInTransactions = function ({ info, txHash, txSequence, txType }) {
	// let continueTransactionsRequests = false;

	if (!info) { fail('Unable to fetch Account Transactions'); }
	if (!txHash && !txSequence && !txType) { return info; }
	if (!info.result?.transactions?.length) { return info; }

	if (txType) {
		info.result.transactions = info.result.transactions.filter(item => item.tx.TransactionType.toLowerCase().match(txType));
	}

	if (txSequence) {
		info.result.transactions = info.result.transactions.filter(item => txSequence.some((seq) => item.tx.Sequence == seq));
	}

	if (txHash) {
		info.result.transactions = info.result.transactions.filter(item => txHash.some((hash) => item.tx.hash.match(hash)));
	}

	return info;
}

async function main(){
	await defineMainParams(main_params);

	const ledgerIndex = (isNaN(main_params.ledger.value) ? null : Number(main_params.ledger.value));
	const txHash = (main_params.tx_hash.value ? main_params.tx_hash.value : (isNaN(main_params.ledger.value) ? main_params.ledger.value : null));

	const info = await AccountTransactions({
		account: main_params.account.value,
		network: main_params.network.value,
		ledgerIndex,
		txHash
	})

	console.log(info);
	if (!info?.result?.transactions?.length) { quit(`NO TRANSACTIONS${ledgerIndex ? ' filtered by ledger index and/or tx_hash' : ''}`); }

	console.log(`\nACCOUNT TRANSACTIONS (${info.result.transactions.length})${ledgerIndex ? ` filtered by ledger ${ledgerIndex}` : ''}:`);

	info.result.transactions.forEach((item, idx) => {
		console.log(`\n===== [${idx + 1}] =====`);
		if (item.tx?.date) { console.log(`TX Date: ${rippleTimeToISOTime(item.tx.date)} (yy-mm-dd)`); }
		if ('validated' in item) { console.log(`${item.validated ? 'VALIDATED' : 'NOT VALIDATED'}`); }
		console.log(item);
	})
	console.log(`===== [END] =====`);

	// quit(`\n${JSON.stringify(info)}`)
	quit()
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.AccountTransactions = AccountTransactions;
}
