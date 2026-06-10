export type GuestGroup = string

export interface Table {
  id: string
  name: string
  capacity: number
}

export interface GuestLodging {
  isOutOfTown: boolean
  needsHotel: boolean
  hotelName: string
  roomType: string
  checkInDate: string
  nights: string
  note: string
}

export interface Guest {
  id: string
  name: string
  group: GuestGroup
  status?: 'confirmed' | 'waitlist'
  lodging?: GuestLodging
}

export interface Rule {
  id: string
  type: 'must' | 'cannot'
  guestIds: string[]
}

export interface SeatingResult {
  tables: Record<string, string[]>
  warnings: string[]
}

export interface SavedPlan {
  tables: Table[]
  guests: Guest[]
  groupOptions: GuestGroup[]
  rules: Rule[]
  seating: SeatingResult
}

export interface StoredPlanVariant {
  id: string
  name: string
  updatedAt: string
  plan: SavedPlan
}

export interface StoredPlanWorkspace {
  activePlanId: string
  plans: StoredPlanVariant[]
}

export interface PlanVariantSummary {
  id: string
  name: string
  updatedAt: string
  isActive: boolean
}

export interface PlannerStateSnapshot {
  activePlanId: string
  activePlanName: string
  plan: SavedPlan
  planOptions: PlanVariantSummary[]
}
