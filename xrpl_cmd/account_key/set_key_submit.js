///////////////////////////////////////////////////////////
//
// set_key_submit.js - assigns or changes the Regular Key pair associated with an account
// syntax: node set_key_submit [PUB|TEST|DEV] ACCOUNT NEW_SECRET_KEY_ADDRESS SEED_KEY
//
// Docs: https://xrpl.org/payment.html
//       https://js.xrpl.org/interfaces/Payment.html
///////////////////////////////////////////////////////////

'use strict';

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee } = require('../common/libs/common.js');
const { Submit } = require('../common/submit_send.js');
const { AddTransactionSequences, Sign, Wallet } = require('../common/sign.js');
const { SetRegularKey } = require('./set_key.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	new_key_address: { id: 3, default: '', required: true, desc: 'Address corresponding to the new secret key (NOT THE NEW SECRET ITSELF !)' },
	account_secret_key: { id: 4, default: '', required: true, desc: 'secret seed / mnemonic phrase', scramble: true },
}

async function buildTransaction() {
	const tx = SetRegularKey({
		account: main_params.account.value,
		newKeyAddress: main_params.new_key_address.value,
		feeDrops: networkMinFee(main_params.network.value) // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
	});

	await AddTransactionSequences(
		tx,
		{
			account: main_params.account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	console.log('\nTRANSACTION DETAILS:');
	console.log(tx);
	console.log('\n=========');
	console.log(`Fee: ${tx.Fee} drops`);
	console.log('=========');

	const transaction = Sign({ wallet: Wallet(main_params.account_secret_key.value), transaction: tx, addLedgerMaxSequence: true });
	console.log('\nSIGNED TRANSACTION:');
	console.log(transaction);

	return transaction;
}

async function signAndSubmit() {
	const transaction = await buildTransaction();

	await Submit(transaction.tx_blob, { network: main_params.network.value });
}

async function main(){
	await defineMainParams(main_params);

	await signAndSubmit();
}

main();
