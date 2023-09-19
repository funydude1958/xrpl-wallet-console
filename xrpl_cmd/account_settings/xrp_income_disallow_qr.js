///////////////////////////////////////////////////////////
//
// xrp_income_disallow_qr.js - XRP should not be sent to this account. (Enforced by client applications, not by rippled)
//                             Sets the corresponding account flag through offline QR-code with signed transaction
//
// syntax: node xrp_income_disallow_qr [PUB|TEST|DEV] ACCOUNT SEED_KEY SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT
//
// The DisallowXRP flag indicates that an account should not receive XRP.
// This is a softer protection than Deposit Authorization, and is not enforced by the XRP Ledger.
// Client applications should honor this flag or at least warn about it.
//
///////////////////////////////////////////////////////////

'use strict';

const { AccountSetAsfFlags } = require('xrpl');

const { defineMainParams, networkMinFee, ledgerIndexMinTimeout } = require('../common/libs/common.js');
const { Wallet, AddTransactionSequences } = require('../common/sign.js');
const { SignQR } = require('../common/sign_qr.js');
const { AccountSetFlag, DescribeSetFlag } = require('../account_settings/account_set.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	account_secret_key: { id: 3, default: '', mandatory_required: true, desc: 'secret seed / mnemonic phrase', scramble: true },

	account_sequence: { id: 4, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 5, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 6, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },
}

async function buildTransaction() {
	const tx = AccountSetFlag({
		account: main_params.account.value,
		feeDrops: networkMinFee(main_params.network.value), // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
		flag: AccountSetAsfFlags.asfDisallowXRP
	});

	await AddTransactionSequences(
		tx,
		{
			accSequence: main_params.account_sequence.value,
			ledgerSeqIndex: main_params.ledger_current_index.value,
			ledgerTimeout: main_params.ledger_index_timeout.value
		}
	);

	showTransactionDetails(tx);

	return tx;
}

function showTransactionDetails (tx) {
	console.log('\nTRANSACTION DETAILS - DISALLOW XRP INCOME:');
	console.log(tx);
	console.log('\n=========');
	console.log(`SetFlag: ${DescribeSetFlag(tx.SetFlag).name}`);
	console.log(`Fee: ${tx.Fee} drops`);
	console.log('=========');
}

async function signWithQR() {
	const transaction = await buildTransaction();

	await SignQR({
		wallet: Wallet(main_params.account_secret_key.value),
		transaction,
		qrTxFields: ['SetFlag'],
		qrAddtnFields: [{ name: 'Transaction kind', value: 'Disallow XRP Income' }]
	});
}

async function main(){
	await defineMainParams(main_params);

	await signWithQR();
}

main();
