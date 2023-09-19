///////////////////////////////////////////////////////////
//
// submit_send.js - submit transaction and send it to XRPL blockchain
// syntax: node submit_send [PUB|TEST|DEV] TRANSACTION_ENCODED_STRING
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'submit_send';

const { Client, decode } = require('xrpl');

const { quit, fail, prompt, defineMainParams, XrplServerAddress, isOffline, showLoadedModules, ShowTransactionDetails, ColoredText } = require('./libs/common.js');
const { ShowMemos } = require('./libs/memo.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	transaction_blob_hex_string: { id: 2, default: '', required: true },
};

const Submit = async function (transaction, { network, address, validateSequence, failHard }) {
	// If "failHard" is true, and the transaction fails locally, do not retry or relay the transaction to other servers.
	// This flag helps on "AccountDelete" to greatly reduce the chances of paying the high transaction cost if the account cannot be deleted.
	let client;

	console.log(); // an empty line
	if (!address && network) { address = XrplServerAddress(network); console.log(`XRPL NETWORK: ${network?.toUpperCase()}`); }
	if (!address) { fail('XRPL Network or Address must be specified in call submit()'); }
	console.log(`XRPL ADDRESS: ${address}`);

	if (isOffline()) { fail("\nOFFLINE mode enabled in `common.js`\n\nDenied to connect to XRPL in offline mode"); }

	const confirmationTime = new Date();
	const answer = await prompt('\nType [Y]es to continue and submit this transaction to blockchain: ');
	if (!['y', 'yes'].includes(answer.toLowerCase())) {
		fail('Aborted');
	}

	try{
		const txDecoded = decode(transaction);

		console.log('Connecting to XRPL...');
		client = new Client(address);
		await client.connect();

		const verifySequencesValid = validateSequence || (new Date().getTime() - confirmationTime.getTime() > 6_000);
		if (verifySequencesValid && txDecoded.Account) {
			const validation = await validateAccountLedgerSequences(txDecoded, client);

			if (validation.accountSeq?.expired) {
				const title = ColoredText("Transaction account Sequence has expired", { color: 'FgRed', bgColor: 'BgYellow' });
				console.log(`\n${title}\nActual sequence: ${validation.accountSeq.current}\nTx sequence: ${txDecoded.Sequence}`);
			}
			if (validation.ledgerSeq?.expired) {
				const title = ColoredText("Transaction Last Ledger Sequence has expired", { color: 'FgRed', bgColor: 'BgYellow' });
				console.log(`\n${title}\nActual ledger index: ${validation.ledgerSeq.current}\nTx max value: ${txDecoded.LastLedgerSequence}\nExceeded value: ${validation.ledgerSeq.exceeded}`);
			} else {
				console.log(`\nTransaction Last Ledger Sequence remaining value: ${validation.ledgerSeq.remaining}`);
			}

			if (validation.expired) {
				const title = ColoredText("!!! Warning! This transaction may be rejected due to expiration errors !!!", { color: 'FgMagenta', bgColor: 'BgYellow' });
				const msg = ColoredText('\nMost likely you should re-sign the transaction\nwith updated values of Last Ledger Sequence or/and Account Sequence', { color: 'FgCyan' });
				console.log(`\n${title}\n${"=".repeat(75)}`);
				console.log(msg);

				const awr = await prompt('\n\nType [Y]es to continue and submit this transaction to blockchain anyway: ');
				if (!['y', 'yes'].includes(awr.toLowerCase())) {
					fail('Aborted');
				}
			}
		}

		console.log('Submitting the transaction...\n');
		const response = client.submit(transaction, { failHard }); // submit returns Promise<TxResponse>

		console.log(`[${new Date()}]\nTransaction sent\n`);
		response.then(
							result => {
								console.log('RESULT:');
								console.log(result);
								console.log(`\n${JSON.stringify(result)}`);

								if (result.result.engine_result === 'tesSUCCESS') {
									console.log(`\n${ColoredText('[ SUCCEEDED ]', { color: 'FgGreen' })}\nPlease wait for transaction validation within 3..60 seconds.\n\nTo find detailed information use "account_transactions" script with 'tx_json -> hash' and 'validated_ledger_index' listed above in transaction details.\n`);

									if (txDecoded.TransactionType === 'EscrowCreate') { console.log(`Remember the Sequence (${txDecoded.Sequence}) of this Escrow Create transaction. It is necessary for its cancellation or finish.\n\n`); }
								} else {
									if (!result.result.applied || !result.result.queued || result.result.kept) { console.log('\n'); }
									if (!result.result.applied) { console.log('NOT APPLIED To current open ledger'); }
									if (!result.result.queued) { console.log('NOT QUEUED To future ledger version'); }
									if (result.result.kept) { console.log('KEPT TO BE RETRIED Later'); }

									fail(`\nError: ${result.result.engine_result} - ${result.result.engine_result_message}`);
								}
							},
							error => {
								fail(`Error: ${error}`);
							}
						)
		await response;

	} catch(err) {
		fail(err);

	} finally {
		if (client) { client.disconnect(); }
	}

	quit();
}

async function validateAccountLedgerSequences(decodedTransaction, client) {
	const { AccountLastSequence, SequencesExpiration } = require('./sign.js');
	const info = await AccountLastSequence({ account: decodedTransaction.Account, client });

	return SequencesExpiration(info, { accountSeq: decodedTransaction.Sequence, ledgerSeq: decodedTransaction.LastLedgerSequence });
}

function decodeAndSubmit() {
	const tx = decode(main_params.transaction_blob_hex_string.value);

	ShowTransactionDetails(tx);

	Submit(main_params.transaction_blob_hex_string.value, { network: main_params.network.value, validateSequence: true });
}

async function main(){
	await defineMainParams(main_params);

	decodeAndSubmit();
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.Submit = Submit;
}
