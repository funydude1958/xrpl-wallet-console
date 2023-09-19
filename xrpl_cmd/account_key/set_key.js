///////////////////////////////////////////////////////////
//
// set_key.js - assigns, changes, or removes the Regular Key pair associated with an account.
// syntax: node set_key [PUB|TEST|DEV] ACCOUNT NEW_SECRET_KEY_ADDRESS
//
//
// The "master key pair" of an account is intrinsically linked to the account's address.
// Only the master key pair can send an account's very first transaction, because accounts cannot be initialized with another way of authorizing transactions.
//
// You cannot change or remove the master key pair, but you can disable it.
// Because changing a master key pair is impossible, you should treat it with care proportionate to the value it holds.
// A good practice is to keep your master key pair offline and set up a regular key pair to sign transactions from your account instead.
//
// The XRP Ledger allows an account to authorize a secondary key pair, called a "regular key pair".
// You can protect your account by assigning a regular key pair to it and using it instead of the master key pair to sign transactions whenever possible.
// If your regular key pair is compromised, but your master key pair is not, you can use a SetRegularKey transaction to regain control of your account.
//
// David Schwartz (Ripple CTO) about Quantum Security on July 27, 2022:
//   If you move your XRP to a wallet that has never performed a transaction, you are safe from quantum attacks.
//   If you disable your master key and change the regular key, you are also safe.
//   But you're almost certainly safe for the next five to eight years anyway.
//
//
// You should only use keypairs that were generated with devices and software you trust.
// Compromised applications can expose your secret to malicious users who can then send transactions from your account later.
//
// You generate a regular key pair the same way as master key.
// The only difference is that a regular key pair is not intrinsically tied to the account it signs transactions for.
// It is possible (but not a good idea) to use the master key pair from one account as the regular key pair for another account.
//
// It is important that you test your regular key before you take any additional steps such as disabling the master key pair.
// If you make a mistake and lose access to your account, no one can restore it for you.
//
// !!! Never submit a secret key to a server you do not control !!!
// !!!! Do not send a secret key unencrypted over the network. !!!!
// ================================================================
//
//
// Docs:
//   https://xrpl.org/assign-a-regular-key-pair.html
//   https://xrpl.org/setregularkey.html
//   https://js.xrpl.org/interfaces/SetRegularKey.html
//   https://xrpl.org/cryptographic-keys.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'set_key';

const { AccountSetAsfFlags } = require('xrpl');

const { quit, fail, defineMainParams, ledgerIndexMinTimeout, networkMinFee } = require('../common/libs/common.js');
const { AddTransactionSequences } = require('../common/sign.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	new_key_address: { id: 3, default: '', required: true, desc: 'Address corresponding to the new secret key (NOT THE NEW SECRET ITSELF !)' },
}

function SetRegularKey ({ account, newKeyAddress, feeDrops }) {
	let error;

	if (!account) { console.error("Must specify 'account' in call SetRegularKey()"); error = true; }
	if (!newKeyAddress?.trim()) { console.error("Must specify 'newKeyAddress' in call SetRegularKey()"); error = true; }
	if (newKeyAddress === account) { console.error("'newKeyAddress' must not match the master key pair in call SetRegularKey()"); error = true; }
	if (!feeDrops || feeDrops <= 0) { console.error("Must specify 'feeDrops' greater than zero in call SetRegularKey()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'SetRegularKey',
		Account: account,
		RegularKey: newKeyAddress, // A base-58 encoded Address that indicates the regular key pair to be assigned to the account.
															 // If omitted, removes any existing regular key pair from the account.
															 // Must not match the master key pair for the address.
		Fee: feeDrops.toString()
	};

	return cmd;
}

function RemoveRegularKey ({ account, feeDrops }) {
	let error;

	if (!account) { console.error("Must specify 'account' in call RemoveRegularKey()"); error = true; }
	if (!feeDrops || feeDrops <= 0) { console.error("Must specify 'feeDrops' greater than zero in call RemoveRegularKey()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'SetRegularKey',
		Account: account,
		Fee: feeDrops.toString()
		// RegularKey, // If omitted, removes any existing regular key pair from the account.
	};

	return cmd;
}

function DisableMasterKey ({ account, feeDrops }) {
	// To disable the master key pair, you must use the master key pair.
	// You should be sure you can use one of the other ways of authorizing transactions,
	// such as with a regular key or by multi-signing, before you disable the master key pair.
	let error;

	if (!account) { console.error("Must specify 'account' in call DisableMasterKey()"); error = true; }
	if (!feeDrops || feeDrops <= 0) { console.error("Must specify 'feeDrops' greater than zero in call DisableMasterKey()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'AccountSet',
		Account: account,
		SetFlag: AccountSetAsfFlags.asfDisableMaster,
		Fee: feeDrops.toString()
	};

	return cmd;
}

function EnableMasterKey ({ account, feeDrops }) {
	// To disable the master key pair, you must use the master key pair.
	// You should be sure you can use one of the other ways of authorizing transactions,
	// such as with a regular key or by multi-signing, before you disable the master key pair.
	let error;

	if (!account) { console.error("Must specify 'account' in call EnableMasterKey()"); error = true; }
	if (!feeDrops || feeDrops <= 0) { console.error("Must specify 'feeDrops' greater than zero in call EnableMasterKey()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'AccountSet',
		Account: account,
		ClearFlag: AccountSetAsfFlags.asfDisableMaster,
		Fee: feeDrops.toString()
	};

	return cmd;
}

async function commandTxParams() {
	let txData = SetRegularKey({
		account: main_params.account.value,
		newKeyAddress: main_params.new_key_address.value,
		feeDrops: networkMinFee(main_params.network.value)
	});

	await AddTransactionSequences(
		txData,
		{
			account: main_params.account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	return txData;
}

async function main(){
	await defineMainParams(main_params);

	const txParams = await commandTxParams();

	console.log('\nTRANSACTION DETAILS:');
	console.log(txParams);

	quit(`\nJSON to be used on 'sign' script call:\n\n${JSON.stringify(txParams)}\n`);
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.SetRegularKey = SetRegularKey;
	exports.RemoveRegularKey = RemoveRegularKey;
	exports.DisableMasterKey = DisableMasterKey;
	exports.EnableMasterKey = EnableMasterKey;
}
