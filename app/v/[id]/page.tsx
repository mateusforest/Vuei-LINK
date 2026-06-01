import { redirect } from "next/navigation"

export default async function PublicTripAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const query = new URLSearchParams()

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item))
      return
    }

    if (typeof value === "string") {
      query.set(key, value)
    }
  })

  const target = query.toString() ? `/viagem/${id}?${query.toString()}` : `/viagem/${id}`
  redirect(target)
}
