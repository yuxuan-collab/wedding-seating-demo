export type GuestGroup = string

export interface Table {
  id: string
  name: string
  capacity: number
}

export interface Guest {
  id: string
  name: string
  group: GuestGroup
  status?: 'confirmed' | 'waitlist'
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
