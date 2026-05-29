export type UserRole = "traveler" | "agency_owner" | "agency_member" | "master"
export type ProfileRole = UserRole

export interface ProfileSettings {
  language: string | null
  darkMode: boolean
  notificationsEnabled: boolean
  biometricEnabled: boolean
  pinEnabled: boolean
}

export interface Profile {
  id: string
  email: string
  name: string
  phone: string | null
  avatarUrl: string | null
  role: UserRole
  agencyId: string | null
  creditsBalance: number | null
  settings: ProfileSettings | null
  createdAt: string
  updatedAt: string
}
