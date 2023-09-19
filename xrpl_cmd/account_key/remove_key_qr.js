///////////////////////////////////////////////////////////
//
// set_key_qr.js - assigns or changes the Regular Key pair associated with an account through offline QR-code with signed transaction
// syntax: node set_key_qr [PUB|TEST|DEV] ACCOUNT NEW_SECRET_KEY_ADDRESS SEED_KEY SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT
//
// Docs: https://xrpl.org/payment.html
//       https://js.xrpl.org/interfaces/Payment.html
///////////////////////////////////////////////////////////

'use strict';

const { fail, prompt, defineMainParams, networkMinFee, ledgerIndexMinTimeout } = require('../common/libs/common.js');
const { Wallet, AddTransactionSequences } = require('../common/sign.js');
const { SignQR } = require('../common/sign_qr.js');
const { RemoveRegularKey } = require('./set_key.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	account_secret_key: { id: 4, default: '', required: true, desc: 'secret seed / mnemonic phrase', scramble: true },

	account_sequence: { id: 5, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 6, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 7, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },
}

async function buildTransaction() {
	const tx = RemoveRegularKey({
		account: main_params.account.value,
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

	await SignQR({ wallet: Wallet(main_params.account_secret_key.value), transaction, qrTxFields: ['RegularKey'], qrAddtnFields: [{ name: 'Transaction kind', value: '[ REMOVE REGULAR KEY PAIR ]' }] });
}

async function main(){
	await defineMainParams(main_params);

	await signWithQR();
}

main();
