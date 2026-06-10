import type { Guest, Rule, Table } from '../types/seating'

export const demoTables: Table[] = Array.from({ length: 8 }, (_, index) => ({
  id: `table-${index + 1}`,
  name: `${index + 1}号桌`,
  capacity: 10
}))

export const demoGuests: Guest[] = [
  { id: 'g1', name: '新郎爸爸', group: '男方父母朋友', status: 'confirmed' },
  { id: 'g2', name: '新郎妈妈', group: '男方父母朋友', status: 'confirmed' },
  { id: 'g3', name: '新娘爸爸', group: '女方父母朋友', status: 'confirmed' },
  { id: 'g4', name: '新娘妈妈', group: '女方父母朋友', status: 'confirmed' },
  { id: 'g5', name: '大学室友A', group: '男方朋友', status: 'confirmed' },
  { id: 'g6', name: '大学室友B', group: '男方朋友', status: 'confirmed' },
  { id: 'g7', name: '大学室友C', group: '男方朋友', status: 'confirmed' },
  { id: 'g8', name: '公司同事A', group: '女方朋友', status: 'confirmed' },
  { id: 'g9', name: '公司同事B', group: '女方朋友', status: 'confirmed' },
  { id: 'g10', name: '闺蜜A', group: '女方朋友', status: 'confirmed' },
  { id: 'g11', name: '闺蜜B', group: '女方朋友', status: 'waitlist' },
  { id: 'g12', name: '男方表哥', group: '男方朋友', status: 'confirmed' },
  { id: 'g13', name: '男方表嫂', group: '男方朋友', status: 'confirmed' },
  { id: 'g14', name: '女方表姐', group: '女方朋友', status: 'confirmed' },
  { id: 'g15', name: '女方表姐夫', group: '女方朋友', status: 'confirmed' },
  { id: 'g16', name: '高中同学A', group: '女方朋友', status: 'waitlist' }
]

export const demoRules: Rule[] = [
  { id: 'r1', type: 'must', guestIds: ['g1', 'g2'] },
  { id: 'r2', type: 'must', guestIds: ['g3', 'g4'] },
  { id: 'r3', type: 'must', guestIds: ['g12', 'g13'] }
]
