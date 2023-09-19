///////////////////////////////////////////////////////////
//
// account_delete_qr.js - deletes an account and any objects it owns in the XRP Ledger.
//                        If possible, sending the account's remaining XRP to a specified destination account.
//
// syntax: node account_delete_qr [PUB|TEST|DEV] ACCOUNT DESTINATION_ACCOUNT SEED_KEY SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT
//
//
// Docs: https://xrpl.org/accounts.html#deletion-of-accounts
//       https://xrpl.org/reserves.html
//       https://xrpl.org/accountdelete.html
//       https://js.xrpl.org/interfaces/AccountDelete.html
///////////////////////////////////////////////////////////

'use strict';

const { fail, prompt, defineMainParams, networkMinFee, ledgerIndexMinTimeout } = require('../common/libs/common.js');
const { Wallet, AddTransactionSequences } = require('../common/sign.js');
const { SignQR } = require('../common/sign_qr.js');
const { AccountDelete } = require('./account_delete.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	destination_account: { id: 3, default: '', required: true, desc: 'account to receive remaining XRP' },
	account_secret_key: { id: 4, default: '', required: true, desc: 'secret seed / mnemonic phrase', scramble: true },

	account_sequence: { id: 5, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 6, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 7, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },
}

async function buildTransaction() {
	const tx = AccountDelete({
		account: main_params.account.value,
		accountDest: main_params.destination_account.value,
		feeDrops: networkMinFee(main_params.network.value) // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
	});

	await AddTransactionSequences(
		tx,
		{
			accSequence: main_params.account_sequence.value,
			ledgerSeqIndex: main_params.ledger_current_index.value,
			ledgerTimeout: main_params.ledger_index_timeout.value
		}
	);

	console.log('\nTRANSACTION DETAILS:');
	console.log(tx);
	console.log('\n=========');
	console.log(`Fee: ${tx.Fee} drops`);
	console.log('=========');

	return tx;
}

async function signWithQR() {
	const transaction = await buildTransaction();

	await SignQR({ wallet: Wallet(main_params.account_secret_key.value), transaction, qrAddtnFields: [{ name: 'Transaction kind', value: '[[ DELETE WALLET ACCOUNT ]]' }] });
}

async function main(){
	await defineMainParams(main_params);

	await signWithQR();
}

main();
