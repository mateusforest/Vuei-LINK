export type TripItineraryMode = "simple" | "complete_pdf" | "uploaded"

export type TripItineraryStatus = "draft" | "generating" | "completed" | "failed" | "uploaded"

export interface TripItineraryActivity {
  id: string
  time: string | null
  title: string
  location: string | null
  description: string | null
  period: "morning" | "afternoon" | "evening" | "flexible"
  type: "attraction" | "food" | "transport" | "hotel" | "experience" | "flight" | "other"
  highlight: boolean
}

export interface TripItineraryDay {
  id: string
  day: number
  date: string | null
  title: string
  summary: string | null
  activities: TripItineraryActivity[]
  tips: string | null
  important: string | null
}

export interface TripItineraryContent {
  summary?: string | null
  travelStyle?: string | null
  usefulTips?: string[]
  observations?: string[]
  contacts?: Array<{ label: string; value: string }>
  days: TripItineraryDay[]
}

export interface TripItineraryRecord {
  id: string
  tripId: string
  documentId: string | null
  title: string
  mode: TripItineraryMode
  status: TripItineraryStatus
  content: TripItineraryContent | null
  pdfUrl: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}
