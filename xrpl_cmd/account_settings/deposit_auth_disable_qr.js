///////////////////////////////////////////////////////////
//
// deposit_auth_disable_qr.js - disables Deposit Authorization on this account through offline QR-code with signed transaction
//
// syntax: node deposit_auth_disable_qr [PUB|TEST|DEV] ACCOUNT SEED_KEY SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT
//
//
// Docs: https://xrpl.org/depositauth.html
///////////////////////////////////////////////////////////

'use strict';

const { AccountSetAsfFlags } = require('xrpl');

const { defineMainParams, networkMinFee, ledgerIndexMinTimeout } = require('../common/libs/common.js');
const { Wallet, AddTransactionSequences } = require('../common/sign.js');
const { SignQR } = require('../common/sign_qr.js');
const { AccountClearFlag, DescribeSetFlag } = require('../account_settings/account_set.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	account_secret_key: { id: 3, default: '', mandatory_required: true, desc: 'secret seed / mnemonic phrase', scramble: true },

	account_sequence: { id: 4, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 5, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 6, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },
}

async function buildTransaction() {
	const tx = AccountClearFlag({
		account: main_params.account.value,
		feeDrops: networkMinFee(main_params.network.value), // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
		flag: AccountSetAsfFlags.asfDepositAuth
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
	console.log('\nTRANSACTION DETAILS - DISABLE DEPOSIT AUTH:');
	console.log(tx);
	console.log('\n=========');
	console.log(`ClearFlag: ${DescribeSetFlag(tx.ClearFlag).name}`);
	console.log(`Fee: ${tx.Fee} drops`);
	console.log('=========');
}

async function signWithQR() {
	const transaction = await buildTransaction();

	await SignQR({
		wallet: Wallet(main_params.account_secret_key.value),
		transaction,
		qrTxFields: ['ClearFlag'],
		qrAddtnFields: [{ name: 'Transaction kind', value: 'Disable Deposit Authorization' }]
	});
}

async function main(){
	await defineMainParams(main_params);

	await signWithQR();
}

main();
