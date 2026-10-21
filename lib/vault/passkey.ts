import { config } from "@/lib/config";
import { fromHex, hex, sha256Hex, utf8, zero } from "@/lib/bytes";

const PRF_SALT = sha256Hex(utf8("zeep-vault-prf-v1"));

type PrfResults = {
  prf?: {
    enabled?: boolean;
    results?: { first?: ArrayBuffer };
  };
};

function credentialId(credential: PublicKeyCredential): string {
  return hex(new Uint8Array(credential.rawId));
}

function prfBytes(credential: PublicKeyCredential): Uint8Array | null {
  const results = credential.getClientExtensionResults() as PrfResults;
  const first = results.prf?.results?.first;
  if (!first) return null;
  return new Uint8Array(first);
}

export function passkeySupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export async function registerPasskey(): Promise<{ credentialId: string; prf: Uint8Array }> {
  if (!passkeySupported()) throw new Error("This browser has no fingerprint unlock.");
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const created = (await navigator.credentials.create({
    publicKey: {
      rp: { name: config.appName, id: config.passkeyRpId },
      user: { id: userId, name: "Zeep pass", displayName: "Zeep pass" },
      challenge,
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new Error("Fingerprint setup was cancelled.");

  const assertion = await assertPasskey(credentialId(created));
  const prf = prfBytes(assertion);
  if (!prf) throw new Error("This browser did not return a passkey secret.");
  return { credentialId: credentialId(created), prf };
}

export async function unlockPasskey(storedId: string): Promise<Uint8Array> {
  const assertion = await assertPasskey(storedId);
  const prf = prfBytes(assertion);
  if (!prf) throw new Error("Fingerprint unlock did not return a key.");
  return prf;
}

async function assertPasskey(storedId: string): Promise<PublicKeyCredential> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: config.passkeyRpId,
      userVerification: "required",
      timeout: 60_000,
      allowCredentials: [
        {
          type: "public-key",
          id: fromHex(storedId) as BufferSource,
        },
      ],
      extensions: {
        prf: { eval: { first: fromHex(PRF_SALT) } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("Fingerprint unlock was cancelled.");
  return assertion;
}

export function zeroPrf(bytes: Uint8Array | null) {
  zero(bytes);
}
