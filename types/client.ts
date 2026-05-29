export type ClientStatus = "lead" | "active" | "inactive" | "archived"

export interface Client {
  id: string
  agencyId: string | null
  name: string
  email: string | null
  phone: string | null
  document: string | null
  notes: string | null
  status: ClientStatus
  createdAt: string
  updatedAt: string
}
