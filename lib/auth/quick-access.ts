const QUICK_ACCESS_STORAGE_KEY = "vuei_quick_access_v1"
const PIN_HASH_ITERATIONS = 120_000

interface QuickAccessRecord {
  version: number
  ownerUserId: string
  pinEnabled: boolean
  pinHash?: string
  pinSalt?: string
  pinIterations?: number
  biometricEnabled: boolean
  webAuthnCredentialId?: string
  updatedAt: string
}

interface QuickAccessState {
  records: QuickAccessRecord[]
}

export interface QuickAccessMethods {
  configured: boolean
  pinEnabled: boolean
  biometricEnabled: boolean
  biometricSupported: boolean
}

function getWindowCrypto() {
  if (typeof window === "undefined") return null
  return window.crypto ?? null
}

function readState(): QuickAccessState {
  if (typeof window === "undefined") return { records: [] }

  try {
    const raw = window.localStorage.getItem(QUICK_ACCESS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      records: Array.isArray(parsed?.records) ? parsed.records : [],
    }
  } catch {
    return { records: [] }
  }
}

function writeState(state: QuickAccessState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(QUICK_ACCESS_STORAGE_KEY, JSON.stringify(state))
}

function upsertRecord(nextRecord: QuickAccessRecord) {
  const state = readState()
  const nextRecords = state.records.filter((record) => record.ownerUserId !== nextRecord.ownerUserId)
  nextRecords.push(nextRecord)
  writeState({ records: nextRecords })
}

function getRecord(ownerUserId: string) {
  return readState().records.find((record) => record.ownerUserId === ownerUserId) ?? null
}

function removeRecord(ownerUserId: string) {
  const state = readState()
  writeState({
    records: state.records.filter((record) => record.ownerUserId !== ownerUserId),
  })
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function createRandomBase64(size = 16) {
  const resolvedCrypto = getWindowCrypto()
  if (!resolvedCrypto) {
    throw new Error("Criptografia do navegador indisponivel neste dispositivo.")
  }

  const bytes = new Uint8Array(size)
  resolvedCrypto.getRandomValues(bytes)
  return bytesToBase64(bytes)
}

async function hashPin(pin: string, salt: string, iterations = PIN_HASH_ITERATIONS) {
  const resolvedCrypto = getWindowCrypto()
  if (!resolvedCrypto?.subtle) {
    throw new Error("Hash de PIN indisponivel neste navegador.")
  }

  const keyMaterial = await resolvedCrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  )

  const derivedBits = await resolvedCrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64ToBytes(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  )

  return bytesToBase64(new Uint8Array(derivedBits))
}

export function isBiometricQuickAccessSupported() {
  if (typeof window === "undefined") return false

  return Boolean(
    window.isSecureContext &&
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.create === "function" &&
      typeof navigator.credentials.get === "function",
  )
}

export function getQuickAccessMethods(ownerUserId: string | null | undefined): QuickAccessMethods {
  if (!ownerUserId) {
    return {
      configured: false,
      pinEnabled: false,
      biometricEnabled: false,
      biometricSupported: isBiometricQuickAccessSupported(),
    }
  }

  const record = getRecord(ownerUserId)
  return {
    configured: Boolean(record?.pinEnabled || record?.biometricEnabled),
    pinEnabled: Boolean(record?.pinEnabled && record.pinHash && record.pinSalt),
    biometricEnabled: Boolean(record?.biometricEnabled && record.webAuthnCredentialId),
    biometricSupported: isBiometricQuickAccessSupported(),
  }
}

export async function saveQuickAccessPin(ownerUserId: string, pin: string) {
  if (!ownerUserId) {
    throw new Error("Conta invalida para configurar o PIN.")
  }

  if (!/^\d{4}$/.test(pin)) {
    throw new Error("O PIN precisa ter 4 digitos.")
  }

  const current = getRecord(ownerUserId)
  const pinSalt = createRandomBase64(16)
  const pinHash = await hashPin(pin, pinSalt)

  upsertRecord({
    version: 1,
    ownerUserId,
    pinEnabled: true,
    pinHash,
    pinSalt,
    pinIterations: PIN_HASH_ITERATIONS,
    biometricEnabled: current?.biometricEnabled ?? false,
    webAuthnCredentialId: current?.webAuthnCredentialId,
    updatedAt: new Date().toISOString(),
  })
}

export function disableQuickAccessPin(ownerUserId: string) {
  const current = getRecord(ownerUserId)
  if (!current) return

  if (!current.biometricEnabled) {
    removeRecord(ownerUserId)
    return
  }

  upsertRecord({
    ...current,
    pinEnabled: false,
    pinHash: undefined,
    pinSalt: undefined,
    pinIterations: undefined,
    updatedAt: new Date().toISOString(),
  })
}

export async function verifyQuickAccessPin(ownerUserId: string, pin: string) {
  const record = getRecord(ownerUserId)
  if (!record?.pinEnabled || !record.pinSalt || !record.pinHash) {
    throw new Error("PIN nao configurado neste dispositivo.")
  }

  const hashedPin = await hashPin(pin, record.pinSalt, record.pinIterations ?? PIN_HASH_ITERATIONS)
  return hashedPin === record.pinHash
}

export async function registerQuickAccessBiometric(ownerUserId: string, displayName: string) {
  if (!ownerUserId) {
    throw new Error("Conta invalida para configurar biometria.")
  }

  if (!isBiometricQuickAccessSupported()) {
    throw new Error("Biometria indisponivel neste dispositivo ou navegador.")
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: base64ToBytes(createRandomBase64(32)),
    rp: {
      name: "Vuei",
    },
    user: {
      id: new TextEncoder().encode(ownerUserId).slice(0, 64),
      name: displayName || ownerUserId,
      displayName: displayName || "Vuei",
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    timeout: 60_000,
    attestation: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  }

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null
  if (!credential) {
    throw new Error("Nao foi possivel registrar a biometria neste dispositivo.")
  }

  const current = getRecord(ownerUserId)

  upsertRecord({
    version: 1,
    ownerUserId,
    pinEnabled: current?.pinEnabled ?? false,
    pinHash: current?.pinHash,
    pinSalt: current?.pinSalt,
    pinIterations: current?.pinIterations,
    biometricEnabled: true,
    webAuthnCredentialId: bytesToBase64(new Uint8Array(credential.rawId)),
    updatedAt: new Date().toISOString(),
  })
}

export function disableQuickAccessBiometric(ownerUserId: string) {
  const current = getRecord(ownerUserId)
  if (!current) return

  if (!current.pinEnabled) {
    removeRecord(ownerUserId)
    return
  }

  upsertRecord({
    ...current,
    biometricEnabled: false,
    webAuthnCredentialId: undefined,
    updatedAt: new Date().toISOString(),
  })
}

export async function authenticateQuickAccessBiometric(ownerUserId: string) {
  const record = getRecord(ownerUserId)
  if (!record?.biometricEnabled || !record.webAuthnCredentialId) {
    throw new Error("Acesso rapido por biometria nao configurado neste dispositivo.")
  }

  if (!isBiometricQuickAccessSupported()) {
    throw new Error("Biometria indisponivel neste dispositivo ou navegador.")
  }

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64ToBytes(createRandomBase64(32)),
      allowCredentials: [
        {
          id: base64ToBytes(record.webAuthnCredentialId),
          type: "public-key",
        },
      ],
      timeout: 60_000,
      userVerification: "required",
    },
  })) as PublicKeyCredential | null

  return Boolean(credential)
}
