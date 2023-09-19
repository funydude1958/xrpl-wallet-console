///////////////////////////////////////////////////////////
//
// bcrypt_sha256.js - Implements SHA-256 Condition through a composition of BCrypt + SHA256
//
// BCryptSHA256()
//   BCrypt does have one major limitation: password are truncated on the first NULL byte (if any),
//   and only the first 72 bytes of a password are hashed… all the rest are ignored.
//   Furthermore, bytes 55-72 are not fully mixed into the resulting hash (citation needed!).
//   To work around both these issues, many applications first run the password through a message digest such as (HMAC-) SHA2-256.
//
// https://passlib.readthedocs.io/en/stable/lib/passlib.hash.bcrypt.html#bcrypt-password-truncation
// https://github.com/kelektiv/node.bcrypt.js
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'bcrypt_sha256';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { fail } = require('assert');

const { Condition, Fulfillment } = require('./crypto_condition.js');
const { InternalError } = require('./errors.js');

const BASE64_CODE = Buffer.from("./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789");
const BCRYPT_MAXSALT = 16;
const _SALT_LEN = 32;
const BCRYPT_SALT_B64_LEN = 22;

const Sha256Fulfillment = function ({ preimage }) {
	return (new Fulfillment({ preimage, typeId: 0 }).serializeBinary().toString('hex'));
}

const Sha256condition = function ({ existingPreimage, bcryptFromSecret, bcryptExistingSalt, bcryptHashRounds, bcryptUsePermanentSaltFromSecret, bcryptPermanentSaltPepper, verbose } = {}) { // https://datatracker.ietf.org/doc/html/draft-thomas-crypto-conditions-02#section-8.1
	// If the EscrowFinish transaction contains a fulfillment (preimage),
	// the transaction cost is 330 drops of XRP plus another 10 drops for every 16 bytes in size of the preimage.

	let preimage;
  const response = {};
	const preimageBytesSize = 32; // EscrowFinish Fee = 10 drops for every 16 bytes in size of the preimage.
	const fulfillmentMinCostDrops = 330;
	const generateRandomSecret = (typeof bcryptFromSecret === 'undefined');

	if (existingPreimage?.length) {
		if (Buffer.isBuffer(existingPreimage)) { preimage = existingPreimage; }
		else preimage = Buffer.from(existingPreimage, 'hex');
	}

	if (!preimage && generateRandomSecret) {
		preimage = crypto.randomBytes(preimageBytesSize);

	} else if(!preimage) {
		if (!bcryptFromSecret?.trim()) { fail('Must not specify empty `bcryptFromSecret` in call Sha256condition()'); return; }

		const bcryptData = BCryptSHA256(bcryptFromSecret, { bcryptHashRounds, bcryptUsePermanentSaltFromSecret, bcryptExistingSalt, bcryptPermanentSaltPepper, verbose });
		if (bcryptData.fullhash.length < preimageBytesSize) {
			throw new InternalError(`BCryptSHA256() returns a hash length (${bcryptData.fullhash.length}) less than required preimage size "${preimageBytesSize}"`);
		}
		preimage = Buffer.from(bcryptData.fullhash.slice(-1 * preimageBytesSize));
		if (verbose) { console.log(`  preimage: ${preimage.toString()}`); }

		response.salt = bcryptData.salt;
		response.saltRandom = bcryptData.saltRandom;
		response.bcryptRounds = bcryptData.bcryptHashRounds;
	}
	if (preimage.length < preimageBytesSize) { throw new InternalError(`Preimage length ${preimage.length} is less than required size "${preimageBytesSize}"`); }
	
	const shaHash = crypto.createHash('sha256');
	shaHash.update(preimage);

	const condition = new Condition({ hash: shaHash.digest(), typeId: 0, cost: preimage.length, subtypes: [] }).serializeBinary();
	shaHash.end();

	response.hexSecretPreimage = preimage.toString('hex');
	response.hexCondition = condition.toString('hex');
	response.random = generateRandomSecret;
	response.preimageLength = preimage.length;
	response.preimageCostDrops = Math.ceil(preimage.length / 16) * 10; // 10 drops for every 16 bytes in size of the preimage
	response.fulfillmentCostDrops = fulfillmentMinCostDrops + response.preimageCostDrops; // the EscrowFinish transaction cost with fulfillment is 330 drops at least

	if (verbose) {
		const preimageRaw = JSON.parse(JSON.stringify(preimage)).data;

		console.log(`\nSHA-256:`);
		if (generateRandomSecret) { console.log(`  New Random secret generated`); }
		if (preimageRaw) { console.log(`  preimage bytes: ${preimageRaw}`); }
		console.log(`  preimage len: ${preimage.length}`);
		console.log(`  preimage hex: ${response.hexSecretPreimage}`);
		console.log(`  condition bytes (${condition.length}): ${JSON.parse(JSON.stringify(condition)).data}`);
		console.log(`  condition hex: ${response.hexCondition}\n`);
		console.log(`  Finish TX cost: ${response.fulfillmentCostDrops} drops of XRP  (${fulfillmentMinCostDrops} + ${response.preimageCostDrops})\n`);
	}
	
	return response;
}

// BCryptSHA256() Implements a composition of BCrypt + SHA256
const BCryptSHA256 = function (secret, { bcryptExistingSalt, bcryptUsePermanentSaltFromSecret, bcryptPermanentSaltPepper, bcryptHashRounds, verbose }) {
	const minSaltRoundsRequired = 10;
	let salt, saltRandom = false;

	if (!bcryptHashRounds || bcryptHashRounds < minSaltRoundsRequired) { bcryptHashRounds = minSaltRoundsRequired; }

	if (bcryptExistingSalt) { salt = bcryptExistingSalt; }
	else if (bcryptUsePermanentSaltFromSecret) {
		salt = bcryptPermanentSaltFromSecret({ secret, verbose, pepper: bcryptPermanentSaltPepper, saltRounds: bcryptHashRounds });
	}
	else { salt = bcrypt.genSaltSync(bcryptHashRounds); saltRandom = true; }

	const base64ShaDigest = sha256hmacDigestBase64(secret, salt);

	const fullhash = bcrypt.hashSync(base64ShaDigest, salt);
	const hash = fullhash.slice(salt.length);

	if (verbose) {
		console.log(`\nBCrypt+SHA256:\n  prehash (${base64ShaDigest.length}): ${base64ShaDigest}`);
		console.log(`  salt: ${salt}`);
		console.log(`  hash: ${hash}`);
		console.log(`  full: ${fullhash}`);
		console.log(`  salt random generated: ${saltRandom}`);
	}

	return { fullhash, hash, salt, saltRandom, bcryptHashRounds };
}

const sha256hmacDigestBase64 = function (secret, hmacKey) {
	const hmac = crypto.createHmac('sha256', hmacKey);
	hmac.update(secret);

	const digest = hmac.digest('base64'); // 44 chars length
	hmac.end();

	return digest;
}

const bcryptPermanentSaltFromSecret = function ({ secret, pepper, saltRounds, verbose }) {
	const hash = crypto.createHash('sha256');

	pepper = pepper?.trim();
	hash.update(`${secret}${pepper ? pepper : ''}`);

	const digest = hash.digest(); // hash.copy().digest()
	const digestArray = JSON.parse(JSON.stringify(digest)).data;
	const saltSeedArray = digestArray.slice(0, BCRYPT_MAXSALT);
	const saltBuffer = Buffer.alloc(_SALT_LEN);

	if (verbose) { 
		console.log(`BCrypt Permanent Salt:\n   Digest (${digest.length}): ${JSON.stringify(digest)}`);
		console.log(digestArray);
		console.log(`   Salt Seed (${saltSeedArray.length}): ${JSON.stringify(saltSeedArray)}`);
	}
	hash.end();

	bcryptEncodeBase64(saltBuffer, saltSeedArray, saltSeedArray.length);
	const saltB64 = saltBuffer.slice(0, BCRYPT_SALT_B64_LEN);
	const saltB64String = saltB64.toString();
	if (verbose) { console.log(`   saltBuffer (${saltB64.length}): ${JSON.stringify(saltB64)}\n   saltBase64: ${saltB64String}`) }

	const salt = bcryptPermanentSalt(saltB64String, saltRounds);
	if (!bcryptIsSaltValid(salt, verbose)) { fail('INVALID Permanent Salt generated'); }

	return salt;
}

const bcryptPermanentSalt = function (b64SaltBase, bcryptHashRounds) {
	let salt = bcrypt.genSaltSync(bcryptHashRounds);
	const arr = salt.split('$');
	const saltIndex = arr.length - 1;

	const permanentSalt = b64SaltBase.substring(0, arr[saltIndex].length);
	arr[saltIndex] = permanentSalt;

	return arr.join('$');
}

const bcryptIsSaltValid = function (salt, verbose) {
	const tmphash = bcrypt.hashSync('test', salt);
	const isValid = (tmphash.substring(0, 7 + 22) === salt);
	if (verbose) { console.log(`   test:\n     salt: ${salt}\n     hash: ${tmphash}\n     valid: ${isValid}`); }

	return isValid;
}

const bcryptEncodeBase64 = function (outBufferUint8, inDataUint8, dataLength) {
	// https://github.com/kelektiv/node.bcrypt.js/blob/master/src/bcrypt.cc#L288

	let c1 = 0, c2 = 0, idxp = 0, idxbp = 0;
	let p = Buffer.from(inDataUint8);
	let bp = outBufferUint8;

	while (idxp < dataLength) {
		c1 = p[idxp++];
		bp[idxbp++] = BASE64_CODE[(c1 >> 2)];
		c1 = (c1 & 0x03) << 4;
		if (idxp >= dataLength) {
			bp[idxbp++] = BASE64_CODE[c1];
			break
		}
		c2 = p[idxp++];
		c1 |= (c2 >> 4) & 0x0f;
		bp[idxbp++] = BASE64_CODE[c1];
		c1 = (c2 & 0x0f) << 2;
		if (idxp >= dataLength) {
			bp[idxbp++] = BASE64_CODE[c1];
			break
		}
		c2 = p[idxp++];
		c1 |= (c2 >> 6) & 0x03;
		bp[idxbp++] = BASE64_CODE[c1];
		bp[idxbp++] = BASE64_CODE[c2 & 0x3f];
	}
	if (bp[idxbp] !== 0) { bp[idxbp] = '\0'; }
}

if (require.main !== module) {
	console.log(MODULE_NAME + ' module loaded');

	exports.Sha256condition = Sha256condition;
	exports.Sha256Fulfillment = Sha256Fulfillment;
	// exports.BCryptSHA256 = BCryptSHA256
}
