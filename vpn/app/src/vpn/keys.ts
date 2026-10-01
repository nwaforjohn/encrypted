/**
 * Device WireGuard keypair.
 *
 * WireGuard keys ARE Curve25519 (X25519) keys — exactly what tweetnacl's
 * box.keyPair() produces. So we can generate a real, valid WireGuard keypair
 * on-device with no native code. The PRIVATE key is stored in the OS secure
 * enclave / keystore (expo-secure-store) and NEVER sent to the server; only the
 * public key is uploaded. The native tunnel reads the private key locally to
 * bring the interface up.
 */
import nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';

const PRIV_KEY = 'wg_private_key';
const PUB_KEY = 'wg_public_key';

export interface WgKeyPair {
  privateKey: string; // base64
  publicKey: string; // base64
}

/** Return the device keypair, generating + persisting one on first run. */
export async function getOrCreateKeyPair(): Promise<WgKeyPair> {
  const [existingPriv, existingPub] = await Promise.all([
    SecureStore.getItemAsync(PRIV_KEY),
    SecureStore.getItemAsync(PUB_KEY),
  ]);
  if (existingPriv && existingPub) {
    return { privateKey: existingPriv, publicKey: existingPub };
  }
  const kp = nacl.box.keyPair();
  const privateKey = naclUtil.encodeBase64(kp.secretKey);
  const publicKey = naclUtil.encodeBase64(kp.publicKey);
  await SecureStore.setItemAsync(PRIV_KEY, privateKey);
  await SecureStore.setItemAsync(PUB_KEY, publicKey);
  return { privateKey, publicKey };
}

export async function getPublicKey(): Promise<string> {
  return (await getOrCreateKeyPair()).publicKey;
}
export async function getPrivateKey(): Promise<string> {
  return (await getOrCreateKeyPair()).privateKey;
}
