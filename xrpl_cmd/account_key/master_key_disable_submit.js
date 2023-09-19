///////////////////////////////////////////////////////////
//
// master_key_disable_submit.js - disables master key pair that is mathematically associated with an account's address 
// syntax: node master_key_disable_submit [PUB|TEST|DEV] ACCOUNT SEED_KEY
//
// Docs:
//   https://xrpl.org/disable-master-key-pair.html
///////////////////////////////////////////////////////////

'use strict';

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee } = require('../common/libs/common.js');
const { Submit } = require('../common/submit_send.js');
const { AddTransactionSequences, Sign, Wallet } = require('../common/sign.js');
const { DescribeSetFlag } = require('../account_settings/account_set.js');
const { DisableMasterKey } = require('./set_key.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	account_secret_key: { id: 4, default: '', required: true, desc: 'secret seed / mnemonic phrase', scramble: true },
}

async function buildTransaction() {
	const tx = DisableMasterKey({
		account: main_params.account.value,
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

	console.log('\nTRANSACTION DETAILS of DISABLE MASTER KEY:');
	console.log(tx);
	console.log('\n=========');
	console.log(`SetFlag: ${DescribeSetFlag(tx.SetFlag).name}`);
	console.log(`Fee: ${tx.Fee} drops`);
	console.log('=========');

	const transaction = Sign({ wallet: Wallet(main_params.account_secret_key.value), transaction: tx, addLedgerMaxSequence: true });
	console.log('\nSIGNED TRANSACTION of DISABLE MASTER KEY:');
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
