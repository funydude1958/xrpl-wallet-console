///////////////////////////////////////////////////////////
//
// list_set_flags.js - lists AccountSet Flags
// syntax: node list_set_flags
//
//
// Docs:
//   https://xrpl.org/accountset.html#accountset-flags
///////////////////////////////////////////////////////////

'use strict';

const { AvailableFlags } = require('./account_set.js');

function listAvailableFlags () {
	AvailableFlags().forEach((item) => console.log(item));
}

async function main(){
	console.log('\nAccountSet Flags:\n');

	listAvailableFlags();
}

main();
