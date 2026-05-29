import type { Profile, UserRole } from "@/types"

export function getRedirectByRole(role?: UserRole | null) {
  console.log("[AUTH] redirect role", role ?? null)

  switch (role) {
    case "agency_owner":
    case "agency_member":
      return "/agency"
    case "master":
      return "/master"
    case "traveler":
    default:
      return "/portal"
  }
}

export function canAccessRole(profile: Pick<Profile, "role"> | null | undefined, allowedRoles: UserRole[]) {
  if (!profile) return false
  return allowedRoles.includes(profile.role)
}
