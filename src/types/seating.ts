export type GuestGroup =
  | '男方亲友'
  | '女方亲友'
  | '同事'
  | '同学'
  | '长辈'
  | '朋友'
  | '其他'

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
  rules: Rule[]
  seating: SeatingResult
}
