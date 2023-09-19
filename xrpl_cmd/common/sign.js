///////////////////////////////////////////////////////////
//
// sign.js - sign a transaction
// syntax: node sign TRANSACTION_JSON_STRING SEED_KEY
//
// The most secure way to sign a transaction is to sign locally with a client library.
//
// Alternatively, if you run your own rippled node you can sign the transaction using the sign method,
// but this must be done through a trusted and encrypted connection, or through a local (same-machine) connection.
//
//
// Docs: https://xrpl.org/secure-signing.html
//       https://xrpl.org/set-up-secure-signing.html
//       https://xrpl.org/assign-a-regular-key-pair.html#sign-your-transaction
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'sign';

const { quit, prompt, defineMainParams, isOffline, showLoadedModules } = require('./libs/common.js');
const { PromptWalletKey } = require('../common/libs/cli_args.js');
const { Wallet } = require('../common/libs/wallet.js');
const { AccountInfo } = require('../account_info/account_info.js');

const main_params = {
	tx: { id: 1, default: '', required: true, desc: 'transaction in json string format' },
	key: { id: 2, default: '', mandatory_required: true, desc: 'secret seed/mnemonic to sign with', scramble: true },
};

function parsedTransactionParams(str) {
	return JSON.parse(str);
};

const Sign = function ({ transaction, multisign, wallet } = { multisign: false }) {
	return wallet.sign(
		transaction
	); // wallet.sign returns: { tx_blob: serialized, hash: hashSignedTx(serialized) }
};

const SignWithKeyPrompt = async function ({ transaction, secretKey, secretKeyPromptOpts, promptAccountAddress, promptParamName }) {
	if (!secretKey) {
		secretKey = await PromptWalletKey(secretKeyPromptOpts, promptParamName, promptAccountAddress);
	}

	const wallet = Wallet(secretKey);
	const signed = Sign({ wallet, transaction, addLedgerMaxSequence: true });
	return signed;
}

const AccountLastSequence = async function ({ network, xrplAddress, client, account } = {}) {
	const info = await AccountInfo({ network, xrplAddress, client, account });

	return {
		accountSequence: info.result.account_data.Sequence,
		ledgerLastIndex: info.result.ledger_index || info.result.ledger_current_index // `ledger_index` in PUB, `ledger_current_index` in DEV
	};
}

async function AddTransactionSequences(txData, { account, ledgerTimeout, ledgerSeqIndex, accSequence, network, xrplAddress, client }) {
	let seqInfo;
	const offline = isOffline();
	const manually = offline || !account || (!client && !network && !xrplAddress);
	const validInput = !isNaN(ledgerSeqIndex) && !isNaN(accSequence);

	ledgerTimeout = (isNaN(ledgerTimeout) ? 1 : Number(ledgerTimeout));

	if (validInput) {
		seqInfo = { accountSequence: Number(accSequence), ledgerLastIndex: Number(ledgerSeqIndex) };

	} else {
		if (offline) { console.log(`\n${"=".repeat(35)}`); console.log("OFFLINE mode enabled in `common.js`\n\nUnable to auto detect account sequence and ledger index."); console.log("=".repeat(35)); }

		if (!manually) {
			seqInfo = await AccountLastSequence({ account, network, xrplAddress, client });

		} else {
			console.log('\nYou have to specify "account sequence" and "ledger index" manually now or later on `sign` script call.');
			console.log("Run `account_info` script on a network connected device to retrieve necessary values.");
			seqInfo = {};

			const accountSequence = await prompt('\nAccount Sequence: ');
			const ledgerLastIndex = await prompt('\nLedger Current Index: ');

			if (accountSequence) { seqInfo.accountSequence = accountSequence; }
			if (ledgerLastIndex && !isNaN(ledgerLastIndex)) {
				const ledgerIndexTimeout = await prompt(`\nLedger Index Timeout (default: ${ledgerTimeout}): `);
				if (ledgerIndexTimeout?.length && !isNaN(ledgerIndexTimeout)) { ledgerTimeout = Number(ledgerIndexTimeout); } 

				seqInfo.ledgerLastIndex = Number(ledgerLastIndex);
			}
		}
	}

	addLastLedgerIndexTimeout(txData, seqInfo, { indexTimeout: ledgerTimeout });
	addAccountSequence(txData, seqInfo);
}

const addLastLedgerIndexTimeout = async function (data, sequenceData, { indexTimeout }) {
	// LastLedgerSequence is an optional parameter of all transactions.
	// This instructs the XRP Ledger that a transaction must be validated on or before a specific ledger version.
	// LastLedgerSequence is a highest ledger index this transaction can appear in.
	// Specifying this field places a strict upper limit on how long the transaction can wait to be validated or rejected.

	if (data.LastLedgerSequence || !sequenceData.ledgerLastIndex) { return; }

	data.LastLedgerSequence = Number(sequenceData.ledgerLastIndex) + Number(indexTimeout);
}

const addAccountSequence = async function (data, sequenceData) {
	// The sequence number of the account sending the transaction.
	// A transaction is only valid if the Sequence number is exactly 1 greater than the previous transaction from the same account.
	// The special case 0 means the transaction is using a Ticket instead.

	if (data.Sequence || !sequenceData.accountSequence) { return; }

	data.Sequence = Number(sequenceData.accountSequence);
}

const SequencesExpiration = function (sequenceData, { accountSeq, ledgerSeq }) {
	// 1) verify LastLedgerSequence is valid
	// Highest ledger index this transaction can appear in.
	// Specifying this field places a strict upper limit on how long
	// the transaction can wait to be validated or rejected.
	//
	// 2) verify Sequence is valid
	// A transaction is only valid if the Sequence number is exactly 1 greater
	// than the previous transaction from the same account.
	// The special case 0 means the transaction is using a Ticket instead.

	const result = {};

	if (accountSeq) {
		result.accountSeq = {
			expired: Number(accountSeq) != Number(sequenceData.accountSequence),
			current: sequenceData.accountSequence
		};
	}

	if (ledgerSeq){
		const diff = Number(ledgerSeq) - Number(sequenceData.ledgerLastIndex);
		result.ledgerSeq = {
			expired: diff < 0,
			current: sequenceData.ledgerLastIndex,
			remaining: diff > 0 ? diff : 0,
			exceeded: diff < 0 ? -1 * diff : 0
		};
	}

	result.expired = result.accountSeq?.expired || result.ledgerSeq?.expired;

	return result;
}

async function main(){
	await defineMainParams(main_params);

	const parsedTx = parsedTransactionParams(main_params.tx.value);
	const transaction = Sign({ wallet: Wallet(main_params.key.value), transaction: parsedTx });

	console.log('\nSIGNED TRANSACTION:');
	console.log(transaction);

	console.log('\nUse "tx_blob" value in call `submit_send` script to send this transaction to XRP Ledger blockchain.');
	console.log('\nUse "hash" value to search detailed information in call `account_transactions` script after the transaction is sent to XRPL.\n');
	quit();
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.Wallet = Wallet;
	exports.Sign = Sign;
	exports.SignWithKeyPrompt = SignWithKeyPrompt;
	exports.AccountLastSequence = AccountLastSequence;
	exports.AddTransactionSequences = AddTransactionSequences;
	exports.SequencesExpiration = SequencesExpiration;
	exports.addLastLedgerIndexTimeout = addLastLedgerIndexTimeout;
	exports.addAccountSequence = addAccountSequence;
}
