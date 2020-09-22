import { exportKey, decryptPrivateKey, decryptDERPrivateKey} from './crypto'
import PeerId, { create } from 'peer-id'
import KeyEncoder from 'key-encoder'
import cryptoS from 'libp2p-crypto'
import fs from 'fs'
import { util, pki, asn1 } from 'node-forge'
//const asn1js = require("asn1js");
//const pkijs = require("pkijs");
const secp256k1 = require('secp256k1')



const keyEncoder: KeyEncoder = new KeyEncoder('secp256k1')
//import { Crypto } from "node-webcrypto-ossl";

//const crypto = new Crypto();

function testLibp2pkey(password: string) {
    create({ keyType: "secp256k1" }).then((peer: PeerId) => {
        console.log(peer.toJSON());
        console.log(Buffer.from(peer.privKey.marshal()).toString("base64"));
        let encryptedKey: Buffer = exportKey(peer, password);
        console.log("Your encrypted key is");
        console.log(encryptedKey.toString());

        let decryptedKey = decryptPrivateKey(encryptedKey.toString(), password);
        console.log("Your decrypted key is");
        console.log(decryptedKey.toString("base64"));

        let privKeyArray = new Uint8Array(decryptedKey);
        let pubKey: Uint8Array = secp256k1.publicKeyCreate(privKeyArray)
        const libp2pPrivKey = new cryptoS.keys.supportedKeys.secp256k1.Secp256k1PrivateKey(privKeyArray, pubKey);
        PeerId.createFromPrivKey(libp2pPrivKey.bytes).then((peerID) => {
            console.log(peerID.toJSON());
        });


        console.log(keyEncoder.encodePrivate(decryptedKey.toString("hex"), "raw", "pem"));
    });
}


async function testOpenSSLKey(password: string) {

    const privateKey: Buffer = fs.readFileSync(new URL("file:///Users/raullaprida/RIF-Comms/rif-communications-pubsub-node/test/keys/openSSL/v2/ec_key_pkcs8_v2.der"));

    /*pkijs.setEngine("newEngine", crypto, new pkijs.CryptoEngine({ name: "", crypto: crypto, subtle: crypto.subtle }));
    
    
    var ab = new ArrayBuffer(privateKey.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < privateKey.length; ++i) {
        view[i] = privateKey[i];
    }
   
    let frBer = asn1js.fromBER(ab);

    let passwordBuff = Buffer.from("password");
    var ab2 = new ArrayBuffer(passwordBuff.length);

    var view2 = new Uint8Array(ab2);
    for (var i = 0; i < passwordBuff.length; ++i) {
        view2[i] = passwordBuff[i];
    }

    let fromSchema = await new pkijs.PKCS8ShroudedKeyBag({schema:frBer.result});
    await fromSchema.parseInternalValues({password:ab2});

    console.log(Buffer.from(fromSchema.parsedValue.privateKey.valueBlock.valueHex).toString('base64'));
*/

    const keyBuf:Buffer = decryptDERPrivateKey(privateKey, "password");

    console.log(keyBuf.toString('base64'));

}

const main = async () => {

    let password = '';
    if (process.argv.length >= 3) {
        password = process.argv[2];
    } else {
        password = '1234';
    }

    // testLibp2pkey(password);
    testOpenSSLKey(password);


}


main();