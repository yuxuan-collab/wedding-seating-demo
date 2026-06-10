import type { Guest, Rule, SeatingResult, Table } from '../types/seating'

interface GuestCluster {
  id: string
  guestIds: string[]
  groups: Set<Guest['group']>
}

const parentAndCoupleFriendGroups = new Set(['男方朋友', '女方朋友', '男方父母朋友', '女方父母朋友'])

function getFriendSegment(group?: Guest['group']) {
  return group && parentAndCoupleFriendGroups.has(group) ? group : null
}

function buildMustGraph(guests: Guest[], rules: Rule[]) {
  const graph = new Map<string, Set<string>>()

  guests.forEach((guest) => graph.set(guest.id, new Set()))

  rules
    .filter((rule) => rule.type === 'must')
    .forEach((rule) => {
      rule.guestIds.forEach((guestId) => {
        const neighbors = graph.get(guestId)
        if (!neighbors) return

        rule.guestIds.forEach((otherId) => {
          if (otherId !== guestId) {
            neighbors.add(otherId)
          }
        })
      })
    })

  return graph
}

export function getMustSeatGroup(guestId: string, rules: Rule[]) {
  const mustRules = rules.filter((rule) => rule.type === 'must')
  const visited = new Set<string>()
  const stack = [guestId]

  while (stack.length > 0) {
    const currentGuestId = stack.pop()
    if (!currentGuestId || visited.has(currentGuestId)) continue

    visited.add(currentGuestId)
    mustRules.forEach((rule) => {
      if (rule.guestIds.includes(currentGuestId)) {
        rule.guestIds.forEach((id) => {
          if (!visited.has(id)) {
            stack.push(id)
          }
        })
      }
    })
  }

  return [...visited]
}

export function findGuestTableId(seatMap: SeatingResult['tables'], guestId: string) {
  return Object.entries(seatMap).find(([, guestIds]) => guestIds.includes(guestId))?.[0] ?? null
}

function findClusters(guests: Guest[], rules: Rule[]): GuestCluster[] {
  const graph = buildMustGraph(guests, rules)
  const visited = new Set<string>()
  const guestsById = new Map(guests.map((guest) => [guest.id, guest]))
  const clusters: GuestCluster[] = []

  guests.forEach((guest) => {
    if (visited.has(guest.id)) return

    const stack = [guest.id]
    const guestIds: string[] = []
    const groups = new Set<Guest['group']>()

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || visited.has(current)) continue

      visited.add(current)
      guestIds.push(current)
      const currentGuest = guestsById.get(current)
      if (currentGuest) {
        groups.add(currentGuest.group)
      }

      graph.get(current)?.forEach((nextId) => {
        if (!visited.has(nextId)) {
          stack.push(nextId)
        }
      })
    }

    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      guestIds,
      groups
    })
  })

  return clusters.sort((left, right) => right.guestIds.length - left.guestIds.length)
}

function buildCannotPairs(rules: Rule[]) {
  const pairs = new Set<string>()

  rules
    .filter((rule) => rule.type === 'cannot')
    .forEach((rule) => {
      rule.guestIds.forEach((leftId, leftIndex) => {
        rule.guestIds.slice(leftIndex + 1).forEach((rightId) => {
          const key = [leftId, rightId].sort().join(':')
          pairs.add(key)
        })
      })
    })

  return pairs
}

function hasConflict(currentGuestIds: string[], nextGuestIds: string[], cannotPairs: Set<string>) {
  return nextGuestIds.some((nextId) =>
    currentGuestIds.some((existingId) => cannotPairs.has([nextId, existingId].sort().join(':')))
  )
}

function scoreTable(
  tableGuestIds: string[],
  cluster: GuestCluster,
  guestsById: Map<string, Guest>,
  cannotPairs: Set<string>
) {
  if (hasConflict(tableGuestIds, cluster.guestIds, cannotPairs)) {
    return -Infinity
  }

  const existingGroups = tableGuestIds
    .map((guestId) => guestsById.get(guestId)?.group)
    .filter((group): group is Guest['group'] => Boolean(group))

  const existingFriendSegments = existingGroups
    .map((group) => getFriendSegment(group))
    .filter((group): group is Guest['group'] => Boolean(group))
  const clusterFriendSegments = [...cluster.groups]
    .map((group) => getFriendSegment(group))
    .filter((group): group is Guest['group'] => Boolean(group))

  let score = 0
  cluster.guestIds.forEach(() => {
    existingGroups.forEach((group) => {
      if (cluster.groups.has(group)) {
        score += 6
      } else {
        score -= 0.2
      }
    })
  })

  clusterFriendSegments.forEach((segment) => {
    existingFriendSegments.forEach((existingSegment) => {
      score += existingSegment === segment ? 8 : -12
    })
  })

  return score
}

export function generateSeating(tables: Table[], guests: Guest[], rules: Rule[]): SeatingResult {
  const warnings: string[] = []
  const guestsById = new Map(guests.map((guest) => [guest.id, guest]))
  const clusters = findClusters(guests, rules)
  const cannotPairs = buildCannotPairs(rules)
  const result: Record<string, string[]> = {}

  tables.forEach((table) => {
    result[table.id] = []
  })

  clusters.forEach((cluster) => {
    const fittingTables = tables
      .filter((table) => result[table.id].length + cluster.guestIds.length <= table.capacity)
      .map((table) => ({
        table,
        score: scoreTable(result[table.id], cluster, guestsById, cannotPairs)
      }))
      .filter((entry) => entry.score > -Infinity)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        return result[left.table.id].length - result[right.table.id].length
      })

    const target = fittingTables[0]
    if (!target) {
      const names = cluster.guestIds
        .map((guestId) => guestsById.get(guestId)?.name ?? guestId)
        .join('、')
      warnings.push(`未能完整安排：${names}`)
      return
    }

    result[target.table.id].push(...cluster.guestIds)
  })

  return {
    tables: result,
    warnings
  }
}

export function exportSeatingText(tables: Table[], guests: Guest[], seating: SeatingResult) {
  const guestsById = new Map(guests.map((guest) => [guest.id, guest]))

  return tables
    .map((table) => {
      const names = seating.tables[table.id]
        .map((guestId) => guestsById.get(guestId)?.name ?? guestId)
        .join('、')

      return `${table.name}（${seating.tables[table.id].length}/${table.capacity}）：${names || '待安排'}`
    })
    .join('\n')
}
