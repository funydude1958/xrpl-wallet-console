///////////////////////////////////////////////////////////
//
// escrow.js - XRPL account escrow functions
//
// Every Escrow adds 2 XRP to your account reserve.
// Those 2 XRP are inaccessible as long as the Escrow exists.
// When the Escrow is finished or cancelled, the 2 XRP are returned to your available balance.
//
// You must supply FinishAfter, Condition, or both.
// With condition specified, the funds can only be delivered to the recipient if this condition is fulfilled.
// If the EscrowFinish transaction has no fulfillment, the transaction cost is the standard 10 drops.
// If the EscrowFinish transaction contains a fulfillment, the transaction cost is 330 drops of XRP plus another 10 drops for every 16 bytes in size of the preimage.
//
// The binary format for a condition is specified in the cryptoconditions RFC. See:
//   https://tools.ietf.org/html/draft-thomas-crypto-conditions-02#section-7.2
//   https://datatracker.ietf.org/doc/html/draft-thomas-crypto-conditions-02#section-6.1
//   https://xrpl.org/send-a-conditionally-held-escrow.html
//
//
// !!! Be careful !!!
// !!! You could lock away your funds for years !!!
// ================================================
//
// Docs:
//   https://xrpl.org/escrow-object.html
//   https://xrpl.org/escrowcreate.html
//   https://xrpl.org/escrowfinish.html
//   https://xrpl.org/send-a-time-held-escrow.html
//   https://xrpl.org/use-an-escrow-as-a-smart-contract.html
//   https://xrpl.org/use-specialized-payment-types.html
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'escrow';

const { fail, showLoadedModules, rippleEpochTimestamp, validateRippleEpochTimestamp } = require('../common/libs/common.js');

function selfEscrowGeneralParams({ account, releaseTimeString, amountDropsToEscrow, feeDrops }) {
	const releaseTimestamp = rippleEpochTimestamp(releaseTimeString);

	if (!validateRippleEpochTimestamp(releaseTimestamp, releaseTimeString)) { fail("Invalid Ripple Epoch calculation"); return {}; }

	return {
		cancelAfter: releaseTimestamp + 1, // If both are included, the FinishAfter time must be before the CancelAfter time.
		finishAfter: releaseTimestamp,
		accountSrc: account,
		accountDest: account,
		amountDropsToEscrow,
		feeDrops
	};
}

function escrowCreate({ accountSrc, accountDest, cancelAfter, finishAfter, amountDropsToEscrow, feeDrops, finishConditionSha256PublicHash, tagSrc, tagDest }) {
	// Docs: https://js.xrpl.org/interfaces/EscrowCreate.html
	//       https://xrpl.org/escrow.html
	//       https://xrpl.org/escrow-object.html
	let error;

	if (finishConditionSha256PublicHash?.length) { finishConditionSha256PublicHash = finishConditionSha256PublicHash.trim(); }

	if (!accountSrc){ console.error("Must specify 'accountSrc' in call escrowCreate()"); error = true; }
	if (!accountDest){ console.error("Must specify 'accountDest' in call escrowCreate()"); error = true; }
	if (!finishAfter && !finishConditionSha256PublicHash){ console.error("Must specify 'finishAfter', 'finishConditionSha256PublicHash' or both in call escrowCreate()"); error = true; }
	if (!amountDropsToEscrow || amountDropsToEscrow <= 0){ console.error("Must specify 'amountDropsToEscrow' greater than zero in call escrowCreate()"); error = true; }
	if (!feeDrops || feeDrops <= 0){ console.error("Must specify 'feeDrops' greater than zero in call escrowCreate()"); error = true; }
	if (typeof finishConditionSha256PublicHash !== 'undefined' && !finishConditionSha256PublicHash.length){ console.error("Must not specify empty 'finishConditionSha256PublicHash' in call escrowCreate()"); error = true; }
	if (typeof tagSrc !== 'undefined' && tagSrc !== null && isNaN(tagSrc)){ console.error("Source Tag 'tagSrc' must be a Number in call escrowCreate()"); error = true; }
	if (typeof tagDest !== 'undefined' && tagDest !== null && isNaN(tagDest)){ console.error("Destination Tag 'tagDest' must be a Number in call escrowCreate()"); error = true; }

	// Either CancelAfter or FinishAfter must be specified.
	// If both are included, the FinishAfter time must be before the CancelAfter time.
	if (cancelAfter && finishAfter && cancelAfter <= finishAfter){ console.error("FinishAfter time must be before the CancelAfter time"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmdEscrow = {
		TransactionType: 'EscrowCreate',
		Account: accountSrc,
		Destination: accountDest, // Address to receive escrowed XRP.
		Fee: feeDrops.toString(),
		Amount: amountDropsToEscrow.toString(), // Amount of XRP, in drops, to deduct from the sender's balance and escrow.
																						// Once escrowed, the XRP can either go to the Destination address (after the FinishAfter time)
																						// or returned to the sender (after the CancelAfter time).
																						// Amount can be a hash:
																						//   keys[0] = 'currency'
																						//   keys[1] = 'issuer'
																						//   keys[2] = 'value'

		// LastLedgerSequence: // Highest ledger index this transaction can appear in. Specifying this field places a strict upper limit on how long the transaction can wait to be validated or rejected.
		// Sequence: // The sequence number of the account sending the transaction. A transaction is only valid if the Sequence number is exactly 1 greater than the previous transaction from the same account. The special case 0 means the transaction is using a Ticket instead.
	}

	if (finishAfter) {
		// The time, in seconds since the Ripple Epoch, when the escrowed XRP can be released to the recipient.
		// This value is immutable; the funds cannot move until this time is reached.
		// You must supply FinishAfter, Condition, or both.
		cmdEscrow.FinishAfter = finishAfter;
	}

	if (cancelAfter) {
		// !!! The held payment can be canceled if and only if this field is present and the time it specifies has passed !!!
		// The time, in seconds since the Ripple Epoch, when this escrow expires.
		// This value is immutable; the funds can only be returned the sender after this time.
		cmdEscrow.CancelAfter = cancelAfter;
	}

	if (finishConditionSha256PublicHash?.length > 0) { cmdEscrow.Condition = finishConditionSha256PublicHash.toUpperCase(); }

	if (typeof tagSrc !== 'undefined' && tagSrc !== null) { cmdEscrow.SourceTag = Number(tagSrc); } // Arbitrary integer used to identify the reason for this payment, or a sender on whose behalf this transaction is made.
	if (typeof tagDest !== 'undefined' && tagDest !== null) { cmdEscrow.DestinationTag = Number(tagDest); } // Arbitrary tag to further specify the destination for this escrowed. payment, such as a hosted recipient at the destination address.

	return cmdEscrow;
}

async function main(){
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	console.log('Use "escrow_self" to freeze a funds on the account.');
	console.log('Use "escrow_create" to create the escrow on the account.');
	console.log('Use "escrow_cancel" to cancel the escrow on any account.');
	console.log('Use "escrow_finish" to finish the escrow and release the funds back to source account.');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.escrowCreate = escrowCreate;
	exports.selfEscrowGeneralParams = selfEscrowGeneralParams;
}
