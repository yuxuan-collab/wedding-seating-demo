import Taro from '@tarojs/taro'
import { demoGuests, demoRules, demoTables } from '../data/demo'
import type {
  Guest,
  GuestGroup,
  PlannerStateSnapshot,
  PlanVariantSummary,
  Rule,
  SavedPlan,
  SeatingResult,
  StoredPlanVariant,
  StoredPlanWorkspace,
  Table
} from '../types/seating'
import { generateSeating } from './seating'

export const storageKey = 'wedding-seating-demo-state'
export const defaultGuestGroups: GuestGroup[] = [
  '男方朋友',
  '女方朋友',
  '男方父母朋友',
  '女方父母朋友'
]
const defaultPlanName = '正式名单版'

function normalizeGuestLodging(guest: Guest) {
  const isOutOfTown = guest.lodging?.isOutOfTown ?? false
  const needsHotel = isOutOfTown ? guest.lodging?.needsHotel ?? true : false

  return {
    isOutOfTown,
    needsHotel,
    hotelName: guest.lodging?.hotelName ?? '',
    roomType: guest.lodging?.roomType ?? '',
    checkInDate: guest.lodging?.checkInDate ?? '',
    nights: guest.lodging?.nights ?? '',
    note: guest.lodging?.note ?? ''
  }
}

export function normalizeGuests(nextGuests: Guest[]) {
  return nextGuests.map((guest) => ({
    ...guest,
    status: guest.status ?? 'confirmed',
    lodging: normalizeGuestLodging(guest)
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

function sanitizeSeating(tables: Table[], guests: Guest[], seating?: SeatingResult): SeatingResult {
  const confirmedGuestIds = new Set(getConfirmedGuests(guests).map((guest) => guest.id))
  const assignedGuestIds = new Set<string>()
  const tablesMap = tables.reduce<Record<string, string[]>>((result, table) => {
    const nextGuestIds = (seating?.tables?.[table.id] ?? []).filter((guestId) => {
      if (!confirmedGuestIds.has(guestId) || assignedGuestIds.has(guestId)) {
        return false
      }

      assignedGuestIds.add(guestId)
      return true
    })

    result[table.id] = nextGuestIds
    return result
  }, {})

  return {
    tables: tablesMap,
    warnings: []
  }
}

function normalizePlan(
  tables: Table[],
  guests: Guest[],
  rules: Rule[],
  groupOptions: GuestGroup[] = defaultGuestGroups,
  seating?: SeatingResult
): SavedPlan {
  const normalizedGuests = normalizeGuests(guests)
  const sanitizedRules = sanitizeRules(rules, normalizedGuests)
  const nextSeating = seating
    ? sanitizeSeating(tables, normalizedGuests, seating)
    : generateSeating(tables, getConfirmedGuests(normalizedGuests), sanitizedRules)

  return {
    tables,
    guests: normalizedGuests,
    groupOptions: sanitizeGroupOptions(groupOptions, normalizedGuests),
    rules: sanitizedRules,
    seating: nextSeating
  }
}

export function buildPlan(tables: Table[], guests: Guest[], rules: Rule[], groupOptions: GuestGroup[] = defaultGuestGroups): SavedPlan {
  return normalizePlan(tables, guests, rules, groupOptions)
}

export function getDefaultPlan(): SavedPlan {
  return buildPlan(demoTables, demoGuests, demoRules, defaultGuestGroups)
}

function createStoredPlanVariant(name: string, plan: SavedPlan, id: string = `plan-${Date.now()}`): StoredPlanVariant {
  return {
    id,
    name: name.trim() || defaultPlanName,
    updatedAt: new Date().toISOString(),
    plan: normalizePlan(plan.tables, plan.guests, plan.rules, plan.groupOptions, plan.seating)
  }
}

function getDefaultWorkspace(): StoredPlanWorkspace {
  const defaultVariant = createStoredPlanVariant(defaultPlanName, getDefaultPlan(), 'plan-default')

  return {
    activePlanId: defaultVariant.id,
    plans: [defaultVariant]
  }
}

function normalizeStoredWorkspace(stored: StoredPlanWorkspace | SavedPlan): StoredPlanWorkspace {
  if ('plans' in stored && Array.isArray(stored.plans) && stored.plans.length > 0) {
    const normalizedPlans = stored.plans
      .map((variant, index) =>
        createStoredPlanVariant(
          variant.name ?? `方案 ${index + 1}`,
          variant.plan ?? getDefaultPlan(),
          variant.id ?? `plan-${index + 1}`
        )
      )
      .filter(Boolean)

    const activePlanId = normalizedPlans.some((variant) => variant.id === stored.activePlanId)
      ? stored.activePlanId
      : normalizedPlans[0].id

    return {
      activePlanId,
      plans: normalizedPlans
    }
  }

  const legacyPlan = stored as SavedPlan
  const defaultVariant = createStoredPlanVariant(defaultPlanName, legacyPlan, 'plan-default')

  return {
    activePlanId: defaultVariant.id,
    plans: [defaultVariant]
  }
}

function saveWorkspace(workspace: StoredPlanWorkspace) {
  Taro.setStorageSync(storageKey, workspace)
  return workspace
}

export function loadWorkspace(): StoredPlanWorkspace {
  try {
    const stored = Taro.getStorageSync(storageKey) as StoredPlanWorkspace | SavedPlan | ''
    if (!stored || typeof stored !== 'object') {
      return getDefaultWorkspace()
    }

    const workspace = normalizeStoredWorkspace(stored)
    saveWorkspace(workspace)
    return workspace
  } catch {
    return getDefaultWorkspace()
  }
}

function getActiveVariant(workspace: StoredPlanWorkspace) {
  return workspace.plans.find((variant) => variant.id === workspace.activePlanId) ?? workspace.plans[0]
}

function buildPlannerStateSnapshot(workspace: StoredPlanWorkspace): PlannerStateSnapshot {
  const activeVariant = getActiveVariant(workspace)
  const planOptions: PlanVariantSummary[] = workspace.plans.map((variant) => ({
    id: variant.id,
    name: variant.name,
    updatedAt: variant.updatedAt,
    isActive: variant.id === activeVariant.id
  }))

  return {
    activePlanId: activeVariant.id,
    activePlanName: activeVariant.name,
    plan: activeVariant.plan,
    planOptions
  }
}

export function loadPlannerState(): PlannerStateSnapshot {
  return buildPlannerStateSnapshot(loadWorkspace())
}

export function loadPlan(): SavedPlan {
  return loadPlannerState().plan
}

export function savePlan(plan: SavedPlan) {
  const workspace = loadWorkspace()
  const activeVariant = getActiveVariant(workspace)
  const nextPlan = normalizePlan(plan.tables, plan.guests, plan.rules, plan.groupOptions, plan.seating)
  const nextWorkspace = {
    ...workspace,
    plans: workspace.plans.map((variant) =>
      variant.id === activeVariant.id
        ? {
            ...variant,
            updatedAt: new Date().toISOString(),
            plan: nextPlan
          }
        : variant
    )
  }

  saveWorkspace(nextWorkspace)
  return nextPlan
}

export function replaceSeating(plan: SavedPlan, seating: SeatingResult): SavedPlan {
  return savePlan({
    ...plan,
    seating
  })
}

export function savePlanAsVariant(name: string, plan: SavedPlan): PlannerStateSnapshot {
  const workspace = loadWorkspace()
  const nextVariant = createStoredPlanVariant(name, plan)
  const nextWorkspace = {
    activePlanId: nextVariant.id,
    plans: [...workspace.plans, nextVariant]
  }

  saveWorkspace(nextWorkspace)
  return buildPlannerStateSnapshot(nextWorkspace)
}

export function renameActivePlan(name: string): PlannerStateSnapshot {
  const workspace = loadWorkspace()
  const activeVariant = getActiveVariant(workspace)
  const nextName = name.trim() || activeVariant.name
  const nextWorkspace = {
    ...workspace,
    plans: workspace.plans.map((variant) =>
      variant.id === activeVariant.id
        ? {
            ...variant,
            name: nextName,
            updatedAt: new Date().toISOString()
          }
        : variant
    )
  }

  saveWorkspace(nextWorkspace)
  return buildPlannerStateSnapshot(nextWorkspace)
}

export function switchActivePlan(planId: string): PlannerStateSnapshot {
  const workspace = loadWorkspace()
  const nextWorkspace = {
    ...workspace,
    activePlanId: workspace.plans.some((variant) => variant.id === planId) ? planId : workspace.activePlanId
  }

  saveWorkspace(nextWorkspace)
  return buildPlannerStateSnapshot(nextWorkspace)
}

export function deletePlanVariant(planId: string): PlannerStateSnapshot {
  const workspace = loadWorkspace()
  const nextPlans = workspace.plans.filter((variant) => variant.id !== planId)

  if (nextPlans.length === 0) {
    return buildPlannerStateSnapshot(workspace)
  }

  const nextWorkspace = {
    activePlanId:
      workspace.activePlanId === planId
        ? nextPlans[0].id
        : workspace.activePlanId,
    plans: nextPlans
  }

  saveWorkspace(nextWorkspace)
  return buildPlannerStateSnapshot(nextWorkspace)
}
