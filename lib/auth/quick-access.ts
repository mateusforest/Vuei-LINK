import { shouldUseSupabase } from "@/lib/data-source"
import type { ProfileQuickAccessSettings, ProfileSettings } from "@/types"

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

const TRIP_LINK_SECURITY_STORAGE_KEY = "vuei_trip_link_security_v1"

interface TripLinkPinVerifier {
  algorithm: "aes-gcm-pbkdf2"
  salt: string
  iv: string
  cipherText: string
  iterations: number
}

interface TripLinkSecurityRecord {
  version: number
  scopeKey: string
  tripId: string
  pinEnabled: boolean
  pinVerifier?: TripLinkPinVerifier
  biometricEnabled: boolean
  webAuthnCredentialId?: string
  deviceLabel: string
  updatedAt: string
}

interface TripLinkSecurityState {
  records: TripLinkSecurityRecord[]
}

export interface QuickAccessMethods {
  configured: boolean
  pinEnabled: boolean
  biometricEnabled: boolean
  biometricSupported: boolean
}

export interface TripLinkQuickAccessMethods {
  configured: boolean
  pinEnabled: boolean
  biometricEnabled: boolean
  biometricSupported: boolean
  devices: Array<{
    label: string
    updatedAt: string
  }>
}

interface QuickAccessPinVerificationOptions {
  profileSettings?: ProfileSettings | null
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

function readTripLinkSecurityState(): TripLinkSecurityState {
  if (typeof window === "undefined") return { records: [] }

  try {
    const raw = window.localStorage.getItem(TRIP_LINK_SECURITY_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      records: Array.isArray(parsed?.records) ? parsed.records : [],
    }
  } catch {
    return { records: [] }
  }
}

function writeTripLinkSecurityState(state: TripLinkSecurityState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TRIP_LINK_SECURITY_STORAGE_KEY, JSON.stringify(state))
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

function getTripLinkScopeKey(tripId: string) {
  return `trip-link:${tripId}`
}

function getTripLinkDeviceLabel() {
  if (typeof window === "undefined") return "Este dispositivo"

  const platform = navigator.platform?.trim()
  const language = navigator.language?.trim()
  const parts = [platform, language].filter(Boolean)

  return parts.length > 0 ? `Este dispositivo (${parts.join(" • ")})` : "Este dispositivo"
}

function getTripLinkSecurityRecord(tripId: string | null | undefined) {
  if (!tripId) return null

  const scopeKey = getTripLinkScopeKey(tripId)
  return readTripLinkSecurityState().records.find((record) => record.scopeKey === scopeKey) ?? null
}

function upsertTripLinkSecurityRecord(nextRecord: TripLinkSecurityRecord) {
  const state = readTripLinkSecurityState()
  const nextRecords = state.records.filter((record) => record.scopeKey !== nextRecord.scopeKey)
  nextRecords.push(nextRecord)
  writeTripLinkSecurityState({ records: nextRecords })
}

function removeTripLinkSecurityRecord(tripId: string) {
  const scopeKey = getTripLinkScopeKey(tripId)
  const state = readTripLinkSecurityState()
  writeTripLinkSecurityState({
    records: state.records.filter((record) => record.scopeKey !== scopeKey),
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

  let current = new TextEncoder().encode(`${pin}:${salt}`)

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const digest = await resolvedCrypto.subtle.digest("SHA-256", current)
    current = new Uint8Array(digest)
  }

  return bytesToBase64(current)
}

async function derivePinProtectionKey(pin: string, salt: string, iterations = PIN_HASH_ITERATIONS) {
  const resolvedCrypto = getWindowCrypto()
  if (!resolvedCrypto?.subtle) {
    throw new Error("Protecao de PIN indisponivel neste navegador.")
  }

  const importedKey = await resolvedCrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  )

  return resolvedCrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(salt),
      iterations,
      hash: "SHA-256",
    },
    importedKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  )
}

async function createTripLinkPinVerifier(scopeKey: string, pin: string): Promise<TripLinkPinVerifier> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("O PIN precisa ter 4 digitos.")
  }

  const resolvedCrypto = getWindowCrypto()
  if (!resolvedCrypto?.subtle) {
    throw new Error("Protecao de PIN indisponivel neste navegador.")
  }

  const salt = createRandomBase64(16)
  const ivBytes = new Uint8Array(12)
  resolvedCrypto.getRandomValues(ivBytes)
  const iv = bytesToBase64(ivBytes)
  const iterations = PIN_HASH_ITERATIONS
  const key = await derivePinProtectionKey(pin, salt, iterations)
  const marker = new TextEncoder().encode(`vuei-trip-link:${scopeKey}:verified`)
  const cipherBuffer = await resolvedCrypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivBytes,
    },
    key,
    marker,
  )

  return {
    algorithm: "aes-gcm-pbkdf2",
    salt,
    iv,
    cipherText: bytesToBase64(new Uint8Array(cipherBuffer)),
    iterations,
  }
}

async function verifyTripLinkPinVerifier(scopeKey: string, pin: string, verifier?: TripLinkPinVerifier) {
  if (!verifier) {
    throw new Error("PIN nao configurado neste dispositivo para esta viagem.")
  }

  const resolvedCrypto = getWindowCrypto()
  if (!resolvedCrypto?.subtle) {
    throw new Error("Protecao de PIN indisponivel neste navegador.")
  }

  try {
    const key = await derivePinProtectionKey(pin, verifier.salt, verifier.iterations)
    const decrypted = await resolvedCrypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(verifier.iv),
      },
      key,
      base64ToBytes(verifier.cipherText),
    )
    const message = new TextDecoder().decode(decrypted)
    return message === `vuei-trip-link:${scopeKey}:verified`
  } catch {
    return false
  }
}

function getProfilePinSettings(settings?: ProfileSettings | null): ProfileQuickAccessSettings | null {
  const quickAccess = settings?.quickAccess
  if (!quickAccess?.enabled || !quickAccess.pinHash || !quickAccess.pinSalt) {
    return null
  }

  return {
    enabled: true,
    pinHash: quickAccess.pinHash,
    pinSalt: quickAccess.pinSalt,
    pinIterations: quickAccess.pinIterations ?? PIN_HASH_ITERATIONS,
  }
}

export function getLegacyQuickAccessPin(ownerUserId: string | null | undefined): ProfileQuickAccessSettings | null {
  if (!ownerUserId) return null
  const record = getRecord(ownerUserId)
  if (!record?.pinEnabled || !record.pinHash || !record.pinSalt) {
    return null
  }

  return {
    enabled: true,
    pinHash: record.pinHash,
    pinSalt: record.pinSalt,
    pinIterations: record.pinIterations ?? PIN_HASH_ITERATIONS,
  }
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

export function getQuickAccessMethods(ownerUserId: string | null | undefined, profileSettings?: ProfileSettings | null): QuickAccessMethods {
  const profilePin = getProfilePinSettings(profileSettings)
  const legacyPin = getLegacyQuickAccessPin(ownerUserId)
  const record = ownerUserId ? getRecord(ownerUserId) : null

  return {
    configured: Boolean(profilePin || legacyPin || (record?.biometricEnabled && record.webAuthnCredentialId)),
    pinEnabled: Boolean(profilePin || legacyPin),
    biometricEnabled: Boolean(record?.biometricEnabled && record.webAuthnCredentialId),
    biometricSupported: isBiometricQuickAccessSupported(),
  }
}

export async function buildQuickAccessPinSettings(pin: string): Promise<ProfileQuickAccessSettings> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("O PIN precisa ter 4 digitos.")
  }

  const pinSalt = createRandomBase64(16)
  const pinHash = await hashPin(pin, pinSalt)

  return {
    enabled: true,
    pinHash,
    pinSalt,
    pinIterations: PIN_HASH_ITERATIONS,
  }
}

export async function saveQuickAccessPin(ownerUserId: string, pin: string) {
  if (!ownerUserId) {
    throw new Error("Conta invalida para configurar o PIN.")
  }

  const quickAccess = await buildQuickAccessPinSettings(pin)
  const current = getRecord(ownerUserId)

  upsertRecord({
    version: 2,
    ownerUserId,
    pinEnabled: true,
    pinHash: quickAccess.pinHash ?? undefined,
    pinSalt: quickAccess.pinSalt ?? undefined,
    pinIterations: quickAccess.pinIterations ?? PIN_HASH_ITERATIONS,
    biometricEnabled: current?.biometricEnabled ?? false,
    webAuthnCredentialId: current?.webAuthnCredentialId,
    updatedAt: new Date().toISOString(),
  })

  return quickAccess
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

export async function verifyQuickAccessPin(ownerUserId: string, pin: string, options?: QuickAccessPinVerificationOptions) {
  const profilePin = getProfilePinSettings(options?.profileSettings)

  if (profilePin?.pinHash && profilePin.pinSalt) {
    const hashedPin = await hashPin(pin, profilePin.pinSalt, profilePin.pinIterations ?? PIN_HASH_ITERATIONS)
    return hashedPin === profilePin.pinHash
  }

  const legacyPin = getLegacyQuickAccessPin(ownerUserId)
  if (legacyPin?.pinHash && legacyPin.pinSalt) {
    const hashedPin = await hashPin(pin, legacyPin.pinSalt, legacyPin.pinIterations ?? PIN_HASH_ITERATIONS)
    return hashedPin === legacyPin.pinHash
  }

  throw new Error("PIN nao configurado para esta conta neste dispositivo ou perfil.")
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
    version: current?.version ?? 2,
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

export function getTripLinkQuickAccessMethods(tripId: string | null | undefined): TripLinkQuickAccessMethods {
  const record = tripId ? getTripLinkSecurityRecord(tripId) : null

  return {
    configured: Boolean(record?.pinEnabled || (record?.biometricEnabled && record.webAuthnCredentialId)),
    pinEnabled: Boolean(record?.pinEnabled && record.pinVerifier),
    biometricEnabled: Boolean(record?.biometricEnabled && record.webAuthnCredentialId),
    biometricSupported: isBiometricQuickAccessSupported(),
    devices: record
      ? [
          {
            label: record.deviceLabel,
            updatedAt: record.updatedAt,
          },
        ]
      : [],
  }
}

export async function saveTripLinkPin(tripId: string, pin: string) {
  if (!tripId) {
    throw new Error("Viagem invalida para configurar o PIN local.")
  }

  const scopeKey = getTripLinkScopeKey(tripId)
  const pinVerifier = await createTripLinkPinVerifier(scopeKey, pin)
  const current = getTripLinkSecurityRecord(tripId)

  upsertTripLinkSecurityRecord({
    version: 1,
    scopeKey,
    tripId,
    pinEnabled: true,
    pinVerifier,
    biometricEnabled: current?.biometricEnabled ?? false,
    webAuthnCredentialId: current?.webAuthnCredentialId,
    deviceLabel: getTripLinkDeviceLabel(),
    updatedAt: new Date().toISOString(),
  })
}

export async function verifyTripLinkPin(tripId: string, pin: string) {
  if (!tripId) {
    throw new Error("Viagem invalida para validar o PIN local.")
  }

  const record = getTripLinkSecurityRecord(tripId)
  if (!record?.pinEnabled || !record.pinVerifier) {
    throw new Error("PIN nao configurado neste dispositivo para esta viagem.")
  }

  return verifyTripLinkPinVerifier(record.scopeKey, pin, record.pinVerifier)
}

export function disableTripLinkPin(tripId: string) {
  const current = getTripLinkSecurityRecord(tripId)
  if (!current) return

  if (!current.biometricEnabled) {
    removeTripLinkSecurityRecord(tripId)
    return
  }

  upsertTripLinkSecurityRecord({
    ...current,
    pinEnabled: false,
    pinVerifier: undefined,
    updatedAt: new Date().toISOString(),
  })
}

export async function registerTripLinkBiometric(tripId: string, displayName: string) {
  if (!tripId) {
    throw new Error("Viagem invalida para configurar biometria.")
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
      id: new TextEncoder().encode(getTripLinkScopeKey(tripId)).slice(0, 64),
      name: displayName || tripId,
      displayName: displayName || "Vuei trip link",
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

  const current = getTripLinkSecurityRecord(tripId)

  upsertTripLinkSecurityRecord({
    version: current?.version ?? 1,
    scopeKey: getTripLinkScopeKey(tripId),
    tripId,
    pinEnabled: current?.pinEnabled ?? false,
    pinVerifier: current?.pinVerifier,
    biometricEnabled: true,
    webAuthnCredentialId: bytesToBase64(new Uint8Array(credential.rawId)),
    deviceLabel: getTripLinkDeviceLabel(),
    updatedAt: new Date().toISOString(),
  })
}

export function disableTripLinkBiometric(tripId: string) {
  const current = getTripLinkSecurityRecord(tripId)
  if (!current) return

  if (!current.pinEnabled) {
    removeTripLinkSecurityRecord(tripId)
    return
  }

  upsertTripLinkSecurityRecord({
    ...current,
    biometricEnabled: false,
    webAuthnCredentialId: undefined,
    updatedAt: new Date().toISOString(),
  })
}

export async function authenticateTripLinkBiometric(tripId: string) {
  const record = getTripLinkSecurityRecord(tripId)
  if (!record?.biometricEnabled || !record.webAuthnCredentialId) {
    throw new Error("Biometria nao configurada neste dispositivo para esta viagem.")
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

export function getQuickAccessSqlRecommendation() {
  return shouldUseSupabase()
    ? null
    : "profiles.settings.quickAccess pode ser usado sem SQL extra apenas quando a coluna settings ja existe."
}
