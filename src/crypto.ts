import KeyEncoder from 'key-encoder'
import { util, pki, asn1 } from 'node-forge'

const keyEncoder: KeyEncoder = new KeyEncoder('secp256k1')

/* Password-based encryption implementation. */

function decryptDERPrivateKey (der: Buffer, password: string) {
  if (password === '') {
    throw new Error('Decryption password cannot be blank')
  }
  const keyFromDer = asn1.fromDer(der.toString('binary'))

  const rval = pki.decryptPrivateKeyInfo(
    keyFromDer,
    password
  )

  if (typeof rval.value[2] === 'string') {
    throw new Error(
      'Unexpected type string in the decrypted private key, expected ANS.1'
    )
  }

  if (typeof rval.value[2].value !== 'string') {
    throw new Error(
      `Inner part of the key should be a string, instead got ${typeof rval
        .value[2].value}`
    )
  }

  const privKeyDer = new util.ByteStringBuffer(rval.value[2].value)
  const rawPrivKey = keyEncoder.encodePrivate(privKeyDer.toHex(), 'der', 'raw')
  const rawPrivBuf = Buffer.from(rawPrivKey, 'hex')
  return rawPrivBuf
}

/**
 * Decrypts an  private key.
 *
 * @param pem the PEM-formatted EncryptedPrivateKeyInfo to decrypt.
 * @param password the password to use.
 *
 * @return the key on success, null on failure.
 */
function decryptPrivateKey (pem: string, password: string) {
  if (password === '') {
    throw new Error('Decryption password cannot be blank')
  }
  const rval = pki.decryptPrivateKeyInfo(
    pki.encryptedPrivateKeyFromPem(pem),
    password
  )

  if (typeof rval.value[2] === 'string') {
    throw new Error(
      'Unexpected type string in the decrypted private key, expected ANS.1'
    )
  }

  if (typeof rval.value[2].value !== 'string') {
    throw new Error(
      `Inner part of the key should be a string, instead got ${typeof rval
        .value[2].value}`
    )
  }

  const privKeyDer = new util.ByteStringBuffer(rval.value[2].value)

  const rawPrivKey = keyEncoder.encodePrivate(privKeyDer.toHex(), 'der', 'raw')

  return Buffer.from(rawPrivKey, 'hex')
}

function generateRawKeyFromKeyInfo (privateKeyInfo: any) {
  return keyEncoder.encodePrivate(privateKeyInfo, 'pem', 'raw')
}

function createPrivateKeyInfo (peerId: any) {
  const pkinfo = keyEncoder.encodePrivate(
    peerId.privKey.marshal().toString('hex'),
    'raw',
    'der'
  )

  // return asn1version;
  // PrivateKeyInfo
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    // version (0)
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, '\0'),
    // privateKeyAlgorithm
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        asn1.oidToDer('1.2.840.10045.2.1').getBytes()
      ),
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        asn1.oidToDer('1.3.132.0.10').getBytes()
      )
    ]),
    // PrivateKey
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.OCTETSTRING,
      false,
      new util.ByteStringBuffer(
        Buffer.from(pkinfo, 'hex').toString('binary')
      ).getBytes()
    )
  ])
}

/**
 * Exports the key into a password protected DER format
 *
 * @param {string} password - The password to read the encrypted PEM.
 * If the password is blank or null then no encryption is used
 * @param {string} [format] - Defaults to 'pkcs-8'.
 */
function exportKey (
  peerId: any,
  password: string | undefined,
  format = 'pkcs-8'
): Buffer {
  if (password && password !== '') {
    // eslint-disable-line require-await
    let encrypted = null

    if (format === 'pkcs-8') {
      // Create privateKeyInfo
      const pkinfo = createPrivateKeyInfo(peerId)
      encrypted = pki.encryptPrivateKeyInfo(pkinfo, password, {
        algorithm: 'aes256',
        count: 10000,
        saltSize: 128 / 8,
        prfAlgorithm: 'sha512'
      })
    } else {
      throw new Error(`Unknown export format '${format}'. Must be pkcs-8`)
    }

    return Buffer.from(pki.encryptedPrivateKeyToPem(encrypted))
  } else {
    return Buffer.from(
      keyEncoder.encodePrivate(
        peerId.privKey.marshal().toString('hex'),
        'raw',
        'pem'
      )
    )
  }
}

export { exportKey, decryptPrivateKey, decryptDERPrivateKey, generateRawKeyFromKeyInfo }
