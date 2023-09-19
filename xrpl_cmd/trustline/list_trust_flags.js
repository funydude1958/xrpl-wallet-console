///////////////////////////////////////////////////////////
//
// list_trust_flags.js - lists TrustSet Flags
// syntax: node list_trust_flags
//
//
// Docs:
//   https://js.xrpl.org/interfaces/TrustSetFlagsInterface.html
//   https://github.com/XRPLF/xrpl.js/blob/main/packages/xrpl/src/models/transactions/trustSet.ts
///////////////////////////////////////////////////////////

'use strict';

const { AvailableFlags } = require('./trustline_set.js');

function listAvailableFlags () {
	AvailableFlags().forEach((item) => console.log(item));
}

async function main(){
	console.log('\nTrustSet Flags:\n');
	listAvailableFlags();
}

main();
