import Taro from '@tarojs/taro'
import { demoGuests, demoRules, demoTables } from '../data/demo'
import type { Guest, GuestGroup, Rule, SavedPlan, SeatingResult, Table } from '../types/seating'
import { generateSeating } from './seating'

export const storageKey = 'wedding-seating-demo-state'
export const defaultGuestGroups: GuestGroup[] = ['朋友', '同事', '同学', '男方亲友', '女方亲友', '长辈', '其他']

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
  const guestIdSet = new Set(nextGuests.map((guest) => guest.id))

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

export function sanitizeGroupOptions(nextGroups: GuestGroup[], nextGuests: Guest[]) {
  const normalized = nextGroups.map((group) => group.trim()).filter(Boolean)
  const deduped = normalized.filter((group, index) => normalized.indexOf(group) === index)
  const guestGroups = nextGuests.map((guest) => guest.group).filter(Boolean)

  return [...new Set([...deduped, ...guestGroups])]
}

export function buildPlan(tables: Table[], guests: Guest[], rules: Rule[], groupOptions: GuestGroup[] = defaultGuestGroups): SavedPlan {
  const normalizedGuests = normalizeGuests(guests)
  const seating = generateSeating(tables, getConfirmedGuests(normalizedGuests), sanitizeRules(rules, normalizedGuests))

  return {
    tables,
    guests: normalizedGuests,
    groupOptions: sanitizeGroupOptions(groupOptions, normalizedGuests),
    rules,
    seating
  }
}

export function getDefaultPlan(): SavedPlan {
  return buildPlan(demoTables, demoGuests, demoRules, defaultGuestGroups)
}

export function loadPlan(): SavedPlan {
  try {
    const stored = Taro.getStorageSync(storageKey) as SavedPlan | ''
    if (!stored || typeof stored !== 'object') {
      return getDefaultPlan()
    }

    return buildPlan(stored.tables ?? demoTables, stored.guests ?? demoGuests, stored.rules ?? demoRules, stored.groupOptions ?? defaultGuestGroups)
  } catch {
    return getDefaultPlan()
  }
}

export function savePlan(plan: SavedPlan) {
  const nextPlan = buildPlan(plan.tables, plan.guests, plan.rules, plan.groupOptions)
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
