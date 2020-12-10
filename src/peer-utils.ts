import PeerId from "peer-id";
import fs from "fs";
import {decryptDERPrivateKey, decryptPrivateKey} from "./crypto";
import cryptoS from "libp2p-crypto";
import KeyEncoder from 'key-encoder'

const secp256k1 = require('secp256k1')


export function isValidPeerId (peerId: PeerId): boolean {
    return (
        peerId.isValid() &&
        Boolean(peerId.toB58String()) &&
        Boolean(peerId.privKey) &&
        Boolean(peerId.pubKey)
    )
}

export function loadEncryptedPeerId(keyFile: URL, keyType: string, password: string, isOpenSSL: boolean): Promise<PeerId> {
    //Import the test key file created with OpenSSL
    //Test using a secp256k1 private key imported from OpenSSL
    const keyEncoder: KeyEncoder = new KeyEncoder('secp256k1')
    const privateKey: Buffer = fs.readFileSync(keyFile);
    let privKeyArray = null;

    if (keyType == "PEM") {
        if (password == "") { //unencrypted
            privKeyArray = new Uint8Array(Buffer.from(keyEncoder.encodePrivate(privateKey.toString(), 'pem', 'raw'), 'hex'));
        }
        else {
            if (isOpenSSL) {
                throw new Error('OpenSSL encrypted keys must be in DER');
            }
            else {
                privKeyArray = new Uint8Array(decryptPrivateKey(privateKey.toString(), password));
            }
        }
    }
    else {
        //DER
        if (password == "") { //not encrypted
            privKeyArray = new Uint8Array(Buffer.from(keyEncoder.encodePrivate(privateKey.toString(), 'der', 'raw'), 'hex'));
        }
        else {
            console.log("Loading encrypted DER key");
            privKeyArray = new Uint8Array(decryptDERPrivateKey(privateKey, password));
        }
    }


    //Calculate public key from the private key
    let pubKey: Uint8Array = secp256k1.publicKeyCreate(privKeyArray)

    //Instantiate the libp2p-formatted private key
    const libp2pPrivKey = new cryptoS.keys.supportedKeys.secp256k1.Secp256k1PrivateKey(privKeyArray, pubKey);


    return PeerId.createFromPrivKey(libp2pPrivKey.bytes);
}