///////////////////////////////////////////////////////////
//
// crypto_condition.js - Implements PREIMAGE-SHA-256 crypto-conditions
//
// Docs: https://tools.ietf.org/html/draft-thomas-crypto-conditions-04
//       https://tools.ietf.org/html/draft-thomas-crypto-conditions-02#section-8.1.4
//       https://github.com/interledgerjs/five-bells-condition/blob/master/src/lib/condition.js
//       https://github.com/interledgerjs/five-bells-condition/blob/master/src/lib/fulfillment.js
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'crypto_condition';

const { MissingDataError } = require('./errors.js');

const TYPES = {
	0: {
		name: 'preimage-sha-256',
		asn1Condition: 'preimageSha256Condition',
		asn1Fulfillment: 'preimageSha256Fulfillment',
		category: 'simple'
	}
};

var asn, asn1Schemas = {};

function requireAsnLibrary () {
	asn = asn || require('asn1.js'); // https://github.com/indutny/asn1.js
	return asn;
}

class Condition {
	constructor({ hash, typeId, cost, subtypes }) {
		this.hash = hash;
		this.typeId = Number(typeId);
		this.cost = Number(cost);
		this.subtypes = subtypes;
		this.type = TYPES[this.typeId];
	}

	serializeBinary () {
		const asn1Json = this.getAsn1Json();
		return this.getAsn1Scheme('condition').encode(asn1Json);
	}

	getAsn1Json () {
		const type = this.getType();
		const asn1Json = {
			type: type.asn1Condition,
			value: {
				fingerprint: this.getHash(),
				cost: this.getCost()
			}
		};

		if (type.category === 'compound') {
			// Convert the subtypes set of type names to an array of type IDs
			const subtypeIds = Array.from(this.getSubtypes()).map(typeName => Object.keys(TYPES).find(key => TYPES[key].name === typeName));

			// Allocate a large enough buffer for the subtypes bitarray
			const maxId = subtypeIds.reduce((a, b) => Math.max(a, b), 0);
			const subtypesBuffer = Buffer.alloc(1 + (maxId >>> 3));
			for (let id of subtypeIds) {
				subtypesBuffer[id >>> 3] |= 1 << (7 - id % 8);
			}

			// Determine the number of unused bits at the end
			const trailingZeroBits = 7 - maxId % 8;

			asn1Json.value.subtypes = { unused: trailingZeroBits, data: subtypesBuffer };
		}

		return asn1Json;
	}

	getType () {
		if (isNaN(this.typeId)) { throw new MissingDataError('typeId not set or not a number'); }
		if (!this.type) { throw new MissingDataError(`unknown type for typeId "${this.typeId}"`); }

		return this.type;
	}

	getHash () {
		if (!this.hash) { throw new MissingDataError('Hash not set'); }

		return this.hash;
	}

	getCost () {
		if (isNaN(this.cost)) { throw new MissingDataError('Cost not set'); }

		return this.cost;
	}

	getSubtypes () {
		return this.subtypes || [];
	}

	getAsn1Scheme (name) {
		return Asn1SchemasConditions()[name];
	}
}

class Fulfillment {
	constructor({ preimage, typeId }) {
		if (!Buffer.isBuffer(preimage)) {
			throw new TypeError(`Preimage must be a Buffer, was: ${typeof preimage === 'object' ? `${typeof preimage} ${JSON.stringify(preimage)}` : typeof preimage}`);
		}

		this.preimage = preimage;
		this.typeId = Number(typeId);
		this.type = TYPES[this.typeId];
	}

	serializeBinary () {
		const asn1Json = this.getAsn1Json();
		return this.getAsn1Scheme('fulfillment').encode(asn1Json);
	}

	getAsn1Json () {
		const type = this.getType();

		return {
			type: type.asn1Fulfillment,
			value: this.getAsn1JsonPayload()
		};
	}

	getAsn1JsonPayload () {
		return {
			preimage: this.getPreimage()
		};
	}

	getAsn1Scheme (name) {
		return Asn1SchemasFulfillments()[name];
	}

	getPreimage () {
		if (!this.preimage) { throw new MissingDataError('Preimage not set'); }

		return this.preimage;
	}

	getType () {
		if (isNaN(this.typeId)) { throw new MissingDataError('typeId not set or not a number'); }
		if (!this.type) { throw new MissingDataError(`unknown type for typeId "${this.typeId}"`); }

		return this.type;
	}
}


function Asn1SchemasConditions () {
	if (asn1Schemas.conditions) { return asn1Schemas.conditions; }

	requireAsnLibrary();

	const schemas = {
		simple256Condition: asn.define('Simple256Condition', function () {
			this.seq().obj(
				this.key('fingerprint').implicit(0).octstr(),
				this.key('cost').implicit(1).int()
			);
		}),
		compound256Condition: asn.define('Compound256Condition', function () {
			this.seq().obj(
				this.key('fingerprint').implicit(0).octstr(),
				this.key('cost').implicit(1).int(),
				this.key('subtypes').implicit(2).bitstr()
			);
		})
	};

	schemas.condition = asn.define('Condition', function () {
		this.choice({
			preimageSha256Condition: this.implicit(0).use(schemas.simple256Condition),
			prefixSha256Condition: this.implicit(1).use(schemas.compound256Condition),
			thresholdSha256Condition: this.implicit(2).use(schemas.compound256Condition),
			rsaSha256Condition: this.implicit(3).use(schemas.simple256Condition),
			ed25519Sha256Condition: this.implicit(4).use(schemas.simple256Condition)
		});
	});

	asn1Schemas.conditions = schemas;
	return asn1Schemas.conditions;
}

function Asn1SchemasFulfillments () {
	if (asn1Schemas.fulfillments) { return asn1Schemas.fulfillments; }

	requireAsnLibrary();

	const schemas = {
		preimageFulfillment: asn.define('PreimageFulfillment', function () {
			this.seq().obj(
				this.key('preimage').implicit(0).octstr()
			);
		}),
		rsaSha256Fulfillment: asn.define('RsaSha256Fulfillment', function () {
			this.seq().obj(
				this.key('modulus').implicit(0).octstr(),
				this.key('signature').implicit(1).octstr()
			);
		}),
		ed25519Sha256Fulfillment: asn.define('Ed25519Sha256Fulfillment', function () {
			this.seq().obj(
				this.key('publicKey').implicit(0).octstr(),
				this.key('signature').implicit(1).octstr()
			);
		})
	};
	schemas.prefixFulfillment = asn.define('PrefixFulfillment', function () {
		this.seq().obj(
			this.key('prefix').implicit(0).octstr(),
			this.key('maxMessageLength').implicit(1).int(),
			this.key('subfulfillment').explicit(2).use(schemas.fulfillment)
		);
	});
	schemas.thresholdFulfillment = asn.define('ThresholdFulfillment', function () {
		this.seq().obj(
			this.key('subfulfillments').implicit(0).setof(schemas.fulfillment),
			this.key('subconditions').implicit(1).setof(Asn1SchemasConditions().condition)
		);
	});

	schemas.fulfillment = asn.define('Fulfillment', function () {
		this.choice({
			preimageSha256Fulfillment: this.implicit(0).use(schemas.preimageFulfillment),
			prefixSha256Fulfillment: this.implicit(1).use(schemas.prefixFulfillment),
			thresholdSha256Fulfillment: this.implicit(2).use(schemas.thresholdFulfillment),
			rsaSha256Fulfillment: this.implicit(3).use(schemas.rsaSha256Fulfillment),
			ed25519Sha256Fulfillment: this.implicit(4).use(schemas.ed25519Sha256Fulfillment)
		});
	});

	asn1Schemas.fulfillments = schemas;
	return asn1Schemas.fulfillments;
}

if (require.main !== module) {
	console.log(MODULE_NAME + ' module loaded');

	exports.Condition = Condition;
	exports.Fulfillment = Fulfillment;
}
