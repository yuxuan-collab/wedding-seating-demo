import Taro from '@tarojs/taro'
import { demoGuests, demoRules, demoTables } from '../data/demo'
import type { Guest, Rule, SavedPlan, SeatingResult, Table } from '../types/seating'
import { generateSeating } from './seating'

export const storageKey = 'wedding-seating-demo-state'

export function normalizeGuests(nextGuests: Guest[]) {
  return nextGuests.map((guest) => ({
    ...guest,
    status: guest.status ?? 'confirmed'
  }))
}

export function createTables(tableCount: number, seatsPerTable: number): Table[] {
  return Array.from({ length: tableCount }, (_, index) => ({
    id: `table-${index + 1}`,
    name: `${index + 1}号桌`,
    capacity: seatsPerTable
  }))
}

export function sanitizeRules(nextRules: Rule[], nextGuests: Guest[]) {
  const guestIdSet = new Set(nextGuests.filter((guest) => guest.status !== 'waitlist').map((guest) => guest.id))

  return nextRules
    .map((rule) => ({
      ...rule,
      guestIds: rule.guestIds.filter((guestId) => guestIdSet.has(guestId))
    }))
    .filter((rule) => rule.guestIds.length >= 2)
}

export function getConfirmedGuests(guests: Guest[]) {
  return guests.filter((guest) => guest.status !== 'waitlist')
}

export function getWaitlistGuests(guests: Guest[]) {
  return guests.filter((guest) => guest.status === 'waitlist')
}

export function buildPlan(tables: Table[], guests: Guest[], rules: Rule[]): SavedPlan {
  const normalizedGuests = normalizeGuests(guests)
  const seating = generateSeating(tables, getConfirmedGuests(normalizedGuests), sanitizeRules(rules, normalizedGuests))

  return {
    tables,
    guests: normalizedGuests,
    rules,
    seating
  }
}

export function getDefaultPlan(): SavedPlan {
  return buildPlan(demoTables, demoGuests, demoRules)
}

export function loadPlan(): SavedPlan {
  try {
    const stored = Taro.getStorageSync(storageKey) as SavedPlan | ''
    if (!stored || typeof stored !== 'object') {
      return getDefaultPlan()
    }

    return buildPlan(stored.tables ?? demoTables, stored.guests ?? demoGuests, stored.rules ?? demoRules)
  } catch {
    return getDefaultPlan()
  }
}

export function savePlan(plan: SavedPlan) {
  const nextPlan = buildPlan(plan.tables, plan.guests, plan.rules)
  Taro.setStorageSync(storageKey, nextPlan)
  return nextPlan
}

export function replaceSeating(plan: SavedPlan, seating: SeatingResult): SavedPlan {
  const nextPlan = {
    ...plan,
    seating
  }
  Taro.setStorageSync(storageKey, nextPlan)
  return nextPlan
}
