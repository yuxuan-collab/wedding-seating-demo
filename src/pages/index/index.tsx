import { useEffect, useState } from 'react'
import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { demoGuests, demoRules, demoTables } from '../../data/demo'
import type { Guest, GuestGroup, Rule, SeatingResult, Table } from '../../types/seating'
import { exportSeatingText, generateSeating } from '../../utils/seating'
import './index.scss'
const storageKey = 'wedding-seating-demo-state'

interface SavedPlan {
  tables: Table[]
  guests: Guest[]
  rules: Rule[]
  seating: SeatingResult
}

function normalizeGuests(nextGuests: Guest[]) {
  return nextGuests.map((guest) => ({
    ...guest,
    status: guest.status ?? 'confirmed'
  }))
}

function createTables(tableCount: number, seatsPerTable: number): Table[] {
  return Array.from({ length: tableCount }, (_, index) => ({
    id: `table-${index + 1}`,
    name: `${index + 1}号桌`,
    capacity: seatsPerTable
  }))
}

function getGuestName(guests: Guest[], guestId: string) {
  return guests.find((guest) => guest.id === guestId)?.name ?? guestId
}

function getMustSeatGroup(guestId: string, rules: Rule[]) {
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

function findGuestTableId(seatMap: SeatingResult['tables'], guestId: string) {
  return Object.entries(seatMap).find(([, guestIds]) => guestIds.includes(guestId))?.[0] ?? null
}

function sanitizeRules(nextRules: Rule[], nextGuests: Guest[]) {
  const guestIdSet = new Set(nextGuests.filter((guest) => guest.status !== 'waitlist').map((guest) => guest.id))

  return nextRules
    .map((rule) => ({
      ...rule,
      guestIds: rule.guestIds.filter((guestId) => guestIdSet.has(guestId))
    }))
    .filter((rule) => rule.guestIds.length >= 2)
}

function readEventValue(event: { detail?: { value?: string } }) {
  return event.detail?.value ?? ''
}

export default function IndexPage() {
  const [tableCount, setTableCount] = useState(String(demoTables.length))
  const [seatsPerTable, setSeatsPerTable] = useState(String(demoTables[0]?.capacity ?? 10))
  const [tables, setTables] = useState<Table[]>(demoTables)
  const [guests, setGuests] = useState<Guest[]>(demoGuests)
  const [rules, setRules] = useState<Rule[]>(demoRules)
  const [seating, setSeating] = useState<SeatingResult>(() =>
    generateSeating(
      demoTables,
      normalizeGuests(demoGuests).filter((guest) => guest.status !== 'waitlist'),
      sanitizeRules(demoRules, normalizeGuests(demoGuests))
    )
  )
  const [guestDraftText, setGuestDraftText] = useState('')
  const [newGuestGroup, setNewGuestGroup] = useState<GuestGroup>('女方朋友')
  const [selectedMustGuestIds, setSelectedMustGuestIds] = useState<string[]>([])
  const [selectedSeatGuestId, setSelectedSeatGuestId] = useState<string | null>(null)
  const [selectedSwapGuestId, setSelectedSwapGuestId] = useState<string | null>(null)
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null)
  const [guestSearchText, setGuestSearchText] = useState('')

  const confirmedGuests = guests.filter((guest) => guest.status !== 'waitlist')
  const waitlistGuests = guests.filter((guest) => guest.status === 'waitlist')
  const normalizedSearchText = guestSearchText.trim().toLowerCase()
  const filteredConfirmedGuests = confirmedGuests.filter((guest) => guest.name.toLowerCase().includes(normalizedSearchText))
  const filteredWaitlistGuests = waitlistGuests.filter((guest) => guest.name.toLowerCase().includes(normalizedSearchText))

  useEffect(() => {
    setSeating(generateSeating(tables, confirmedGuests, sanitizeRules(rules, guests)))
  }, [tables, guests, rules])

  useEffect(() => {
    try {
      const stored = Taro.getStorageSync(storageKey) as SavedPlan | ''
      if (!stored || typeof stored !== 'object') return

      const restoredTables = stored.tables ?? demoTables
      const restoredGuests = normalizeGuests(stored.guests ?? demoGuests)
      const restoredRules = stored.rules ?? demoRules
      const restoredActiveRules = sanitizeRules(restoredRules, restoredGuests)

      setTables(restoredTables)
      setGuests(restoredGuests)
      setRules(restoredRules)
      setSeating(
        stored.seating ?? generateSeating(restoredTables, restoredGuests.filter((guest) => guest.status !== 'waitlist'), restoredActiveRules)
      )
      setTableCount(String(restoredTables.length))
      setSeatsPerTable(String(restoredTables[0]?.capacity ?? 10))
    } catch {
      // Ignore storage restore errors and fall back to demo data.
    }
  }, [])

  useEffect(() => {
    try {
      Taro.setStorageSync(storageKey, {
        tables,
        guests: normalizeGuests(guests),
        rules,
        seating
      } satisfies SavedPlan)
    } catch {
      // Ignore storage persistence errors for now.
    }
  }, [tables, guests, rules, seating])

  const totalSeats = tables.reduce((sum, table) => sum + table.capacity, 0)

  const parseGuestNames = (rawText: string) =>
    rawText
      .split(/[\n,，;；]+/)
      .map((name) => name.trim())
      .filter(Boolean)

  const handleGuestDraftChange = (event: { detail?: { value?: string } }) => {
    setGuestDraftText(readEventValue(event))
  }

  const applyTableSetup = () => {
    const nextTableCount = Math.max(1, Number(tableCount) || 1)
    const nextSeatsPerTable = Math.max(1, Number(seatsPerTable) || 1)
    setTables(createTables(nextTableCount, nextSeatsPerTable))
    setSelectedSeatGuestId(null)
    setSelectedSwapGuestId(null)
  }

  const regenerateSeating = () => {
    setSeating(generateSeating(tables, confirmedGuests, sanitizeRules(rules, guests)))
    Taro.showToast({ title: '已生成新方案', icon: 'success' })
  }

  const addGuests = () => {
    if (editingGuestId) {
      const trimmedName = guestDraftText.trim()
      if (!trimmedName) {
        Taro.showToast({ title: '请输入宾客姓名', icon: 'none' })
        return
      }

      setGuests((currentGuests) =>
        currentGuests.map((guest) =>
          guest.id === editingGuestId
            ? {
                ...guest,
                name: trimmedName,
                group: newGuestGroup
              }
            : guest
        )
      )
      setEditingGuestId(null)
      setGuestDraftText('')
      Taro.showToast({ title: '已更新宾客', icon: 'success' })
      return
    }

    const names = parseGuestNames(guestDraftText)
    if (names.length === 0) {
      Taro.showToast({ title: '先输入宾客姓名', icon: 'none' })
      return
    }

    const existingNames = new Set(guests.map((guest) => guest.name.trim()))
    const uniqueNames = names.filter((name, index) => !existingNames.has(name) && names.indexOf(name) === index)

    if (uniqueNames.length === 0) {
      Taro.showToast({ title: '这些名字已经都在名单里了', icon: 'none' })
      return
    }

    setGuests((currentGuests) => [
      ...currentGuests,
      ...uniqueNames.map((name, index) => ({
        id: `g${Date.now()}-${index}`,
        name,
        group: newGuestGroup,
        status: 'confirmed' as const
      }))
    ])
    setGuestDraftText('')
    Taro.showToast({ title: `已添加 ${uniqueNames.length} 位宾客`, icon: 'success' })
  }

  const startEditGuest = (guestId: string) => {
    const guest = guests.find((item) => item.id === guestId)
    if (!guest) return

    setEditingGuestId(guest.id)
    setGuestDraftText(guest.name)
    setNewGuestGroup(guest.group)
  }

  const cancelEditGuest = () => {
    setEditingGuestId(null)
    setGuestDraftText('')
    setNewGuestGroup('女方朋友')
  }

  const deleteGuest = (guestId: string) => {
    const nextGuests = guests.filter((guest) => guest.id !== guestId)
    const nextRules = sanitizeRules(rules, nextGuests)

    setGuests(nextGuests)
    setRules(nextRules)
    setSelectedMustGuestIds((currentIds) => currentIds.filter((id) => id !== guestId))
    setSelectedSeatGuestId((currentGuestId) => (currentGuestId === guestId ? null : currentGuestId))
    if (editingGuestId === guestId) {
      cancelEditGuest()
    }
    Taro.showToast({ title: '已删除宾客', icon: 'none' })
  }

  const moveGuestToWaitlist = (guestId: string) => {
    const nextGuests = guests.map((guest) =>
      guest.id === guestId
        ? {
            ...guest,
            status: 'waitlist' as const
          }
        : guest
    )
    const nextRules = sanitizeRules(rules, nextGuests)

    setGuests(nextGuests)
    setRules(nextRules)
    setSelectedMustGuestIds((currentIds) => currentIds.filter((id) => id !== guestId))
    setSelectedSeatGuestId((currentGuestId) => (currentGuestId === guestId ? null : currentGuestId))
    setSelectedSwapGuestId((currentGuestId) => (currentGuestId === guestId ? null : currentGuestId))
    if (editingGuestId === guestId) {
      cancelEditGuest()
    }
    Taro.showToast({ title: '已移入候补池', icon: 'success' })
  }

  const restoreGuestFromWaitlist = (guestId: string) => {
    setGuests((currentGuests) =>
      currentGuests.map((guest) =>
        guest.id === guestId
          ? {
              ...guest,
              status: 'confirmed' as const
            }
          : guest
      )
    )
    Taro.showToast({ title: '已加入正式名单', icon: 'success' })
  }

  const toggleMustGuestSelection = (guestId: string) => {
    setSelectedMustGuestIds((currentIds) => {
      if (currentIds.includes(guestId)) {
        return currentIds.filter((id) => id !== guestId)
      }

      return [...currentIds, guestId]
    })
  }

  const createMustRule = () => {
    if (selectedMustGuestIds.length < 2) {
      Taro.showToast({ title: '至少选择 2 位宾客', icon: 'none' })
      return
    }

    const maxCapacity = Math.max(...tables.map((table) => table.capacity))
    if (selectedMustGuestIds.length > maxCapacity) {
      Taro.showToast({ title: '分组人数超过单桌容量', icon: 'none' })
      return
    }

    const normalizedIds = [...selectedMustGuestIds].sort()
    const exists = rules.some((rule) => {
      if (rule.type !== 'must' || rule.guestIds.length !== normalizedIds.length) {
        return false
      }

      return [...rule.guestIds].sort().every((guestId, index) => guestId === normalizedIds[index])
    })

    if (exists) {
      Taro.showToast({ title: '这个同桌分组已经存在', icon: 'none' })
      return
    }

    setRules((currentRules) => [
      ...currentRules,
      {
        id: `r${Date.now()}`,
        type: 'must',
        guestIds: selectedMustGuestIds
      }
    ])
    setSelectedMustGuestIds([])
    Taro.showToast({ title: '已添加必须同桌', icon: 'success' })
  }

  const clearMustSelection = () => {
    setSelectedMustGuestIds([])
  }

  const resetDemoData = () => {
    setTables(demoTables)
    setGuests(normalizeGuests(demoGuests))
    setRules(demoRules)
    setSeating(generateSeating(demoTables, normalizeGuests(demoGuests).filter((guest) => guest.status !== 'waitlist'), sanitizeRules(demoRules, normalizeGuests(demoGuests))))
    setTableCount(String(demoTables.length))
    setSeatsPerTable(String(demoTables[0]?.capacity ?? 10))
    setSelectedMustGuestIds([])
    setSelectedSeatGuestId(null)
    setSelectedSwapGuestId(null)
    cancelEditGuest()
    Taro.showToast({ title: '已恢复示例数据', icon: 'success' })
  }

  const removeMustRule = (ruleId: string) => {
    setRules((currentRules) => currentRules.filter((rule) => rule.id !== ruleId))
    Taro.showToast({ title: '已删除分组', icon: 'none' })
  }

  const selectSeatGuest = (guestId: string) => {
    setSelectedSwapGuestId(null)
    setSelectedSeatGuestId((currentGuestId) => (currentGuestId === guestId ? null : guestId))
  }

  const moveSelectedGuestGroup = (targetTableId: string) => {
    if (!selectedSeatGuestId) {
      Taro.showToast({ title: '请先选择一位宾客', icon: 'none' })
      return
    }

    const sourceTableId = findGuestTableId(seating.tables, selectedSeatGuestId)
    if (!sourceTableId || sourceTableId === targetTableId) {
      return
    }

    const targetTable = tables.find((table) => table.id === targetTableId)
    const sourceTable = tables.find((table) => table.id === sourceTableId)

    if (!targetTable || !sourceTable) return

    const movingGuestIds = getMustSeatGroup(selectedSeatGuestId, rules)
    const movingGuestSet = new Set(movingGuestIds)
    const remainingSourceGuests = seating.tables[sourceTableId].filter((guestId) => !movingGuestSet.has(guestId))
    const targetGuests = seating.tables[targetTableId]

    if (targetGuests.length + movingGuestIds.length > targetTable.capacity) {
      Taro.showToast({ title: '目标桌座位不足', icon: 'none' })
      return
    }

    const nextSeatMap = {
      ...seating.tables,
      [sourceTableId]: remainingSourceGuests,
      [targetTableId]: [...targetGuests, ...movingGuestIds]
    }

    setSeating({
      tables: nextSeatMap,
      warnings: []
    })
    setSelectedSeatGuestId(null)
    setSelectedSwapGuestId(null)
    Taro.showToast({
      title: movingGuestIds.length > 1 ? `已整组移到${targetTable.name}` : `已移到${targetTable.name}`,
      icon: 'success'
    })
  }

  const swapSelectedGuestGroups = () => {
    if (!selectedSeatGuestId || !selectedSwapGuestId || selectedSeatGuestId === selectedSwapGuestId) {
      return
    }

    const selectedGroup = getMustSeatGroup(selectedSeatGuestId, rules)
    const targetGroup = getMustSeatGroup(selectedSwapGuestId, rules)

    const sourceTableId = findGuestTableId(seating.tables, selectedSeatGuestId)
    const targetTableId = findGuestTableId(seating.tables, selectedSwapGuestId)

    if (!sourceTableId || !targetTableId || sourceTableId === targetTableId) {
      return
    }

    const sourceTable = tables.find((table) => table.id === sourceTableId)
    const targetTable = tables.find((table) => table.id === targetTableId)
    if (!sourceTable || !targetTable) return

    const sourceGroupSet = new Set(selectedGroup)
    const targetGroupSet = new Set(targetGroup)
    const nextSourceGuests = [
      ...seating.tables[sourceTableId].filter((guestId) => !sourceGroupSet.has(guestId)),
      ...targetGroup
    ]
    const nextTargetGuests = [
      ...seating.tables[targetTableId].filter((guestId) => !targetGroupSet.has(guestId)),
      ...selectedGroup
    ]

    if (nextSourceGuests.length > sourceTable.capacity || nextTargetGuests.length > targetTable.capacity) {
      Taro.showToast({ title: '交换后会超出桌位容量', icon: 'none' })
      return
    }

    const nextSeatMap = {
      ...seating.tables,
      [sourceTableId]: nextSourceGuests,
      [targetTableId]: nextTargetGuests
    }

    setSeating({
      tables: nextSeatMap,
      warnings: []
    })
    setSelectedSeatGuestId(null)
    setSelectedSwapGuestId(null)
    Taro.showToast({ title: '已交换座位', icon: 'success' })
  }

  const exportCurrentPlan = () => {
    const text = exportSeatingText(tables, guests, seating)
    Taro.setClipboardData({ data: text })
    Taro.showToast({ title: '排座结果已复制', icon: 'success' })
  }

  const selectedSeatGuestName = selectedSeatGuestId ? getGuestName(guests, selectedSeatGuestId) : ''
  const selectedSeatGroup = selectedSeatGuestId ? getMustSeatGroup(selectedSeatGuestId, rules) : []
  const selectedSeatTableId = selectedSeatGuestId ? findGuestTableId(seating.tables, selectedSeatGuestId) : null
  const swapCandidates = selectedSeatGuestId
    ? confirmedGuests.filter((guest) => {
        const guestTableId = findGuestTableId(seating.tables, guest.id)
        return guest.id !== selectedSeatGuestId && guestTableId !== selectedSeatTableId
      })
    : []

  return (
    <View className='page'>
      <View className='hero'>
        <Text className='hero__eyebrow'>Wedding Seating Planner</Text>
        <Text className='hero__title'>婚宴排座助手 Demo</Text>
        <Text className='hero__subtitle'>
          先批量录入宾客，再生成初版桌位，最后手动微调到顺眼为止。
        </Text>
      </View>

      <View className='workspace'>
        <View className='sidebar'>
          <View className='panel'>
            <Text className='panel__title'>基础设置</Text>
            <Text className='panel__hint'>先设定桌数和每桌人数，系统会据此生成座位容量。</Text>
            <View className='field'>
              <Text className='field__label'>桌数</Text>
              <Input
                className='field__input'
                type='number'
                value={tableCount}
                onInput={(event) => setTableCount(event.detail.value)}
              />
            </View>
            <View className='field'>
              <Text className='field__label'>每桌人数</Text>
              <Input
                className='field__input'
                type='number'
                value={seatsPerTable}
                onInput={(event) => setSeatsPerTable(event.detail.value)}
              />
            </View>
            <View className='button-stack'>
              <Button className='button button--primary' onClick={applyTableSetup}>
                更新桌位
              </Button>
              <Button className='button' onClick={resetDemoData}>
                恢复示例数据
              </Button>
            </View>

            <View className='stats stats--cards'>
              <View className='stat-card'>
                <Text className='stat-card__label'>当前桌位</Text>
                <Text className='stat-card__value'>{tables.length} 桌</Text>
              </View>
              <View className='stat-card'>
                <Text className='stat-card__label'>总座位</Text>
                <Text className='stat-card__value'>{totalSeats}</Text>
              </View>
              <View className='stat-card'>
                <Text className='stat-card__label'>正式名单</Text>
                <Text className='stat-card__value'>{confirmedGuests.length} 人</Text>
              </View>
              <View className='stat-card'>
                <Text className='stat-card__label'>候补池</Text>
                <Text className='stat-card__value'>{waitlistGuests.length} 人</Text>
              </View>
            </View>
          </View>

          <View className='panel panel--input'>
            <Text className='panel__title'>批量录入</Text>
            <Text className='panel__hint'>
              先按“女方朋友”录入，可在名单页批量改成男方朋友或双方父母朋友。
            </Text>
            {editingGuestId ? (
              <View className='field'>
                <Text className='field__label'>编辑宾客</Text>
                <Input
                  className='field__input'
                  value={guestDraftText}
                  placeholder='编辑宾客姓名'
                  onInput={handleGuestDraftChange}
                />
              </View>
            ) : (
              <View className='field'>
                <Text className='field__label'>批量输入宾客姓名</Text>
                <Textarea
                  className='field__textarea'
                  value={guestDraftText}
                  maxlength={5000}
                  autoHeight
                  placeholder={'示例：\n新郎爸爸\n新郎妈妈\n大学室友A，大学室友B'}
                  onInput={handleGuestDraftChange}
                />
              </View>
            )}
            <View className='guest-form-actions'>
              <Button className='button button--primary' onClick={addGuests}>
                {editingGuestId ? '保存宾客' : '批量加入正式名单'}
              </Button>
              {editingGuestId ? (
                <Button className='button' onClick={cancelEditGuest}>
                  取消编辑
                </Button>
              ) : null}
            </View>
          </View>
        </View>

        <View className='main'>
          <View className='panel panel--list'>
            <Text className='panel__title'>名单管理</Text>
            <Text className='panel__hint'>正式名单和候补池分开管理，后续再补更细的宾客类型。</Text>
            <View className='field'>
              <Text className='field__label'>搜索宾客</Text>
              <Input
                className='field__input'
                value={guestSearchText}
                placeholder='输入姓名快速筛选'
                onInput={(event) => setGuestSearchText(event.detail.value)}
              />
            </View>

            <View className='list-section'>
              <View className='list-section__header'>
                <Text className='list-section__title'>正式名单</Text>
                <Text className='list-section__meta'>
                  {filteredConfirmedGuests.length}/{confirmedGuests.length}
                </Text>
              </View>

              <View className='guest-list guest-list--scroll'>
                {filteredConfirmedGuests.length > 0 ? (
                  filteredConfirmedGuests.map((guest) => (
                    <View key={guest.id} className='guest-list__item'>
                      <View className='guest-list__main'>
                        <Text>{guest.name}</Text>
                        <Text className='guest-list__meta'>默认分组：{guest.group}</Text>
                      </View>
                      <View className='guest-list__actions'>
                        <Button className='mini-action' onClick={() => startEditGuest(guest.id)}>
                          编辑
                        </Button>
                        <Button className='mini-action' onClick={() => moveGuestToWaitlist(guest.id)}>
                          候补
                        </Button>
                        <Button className='mini-action mini-action--danger' onClick={() => deleteGuest(guest.id)}>
                          删除
                        </Button>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text className='table-card__empty'>没有匹配到正式名单宾客</Text>
                )}
              </View>
            </View>

            <View className='waitlist-section'>
              <View className='list-section__header'>
                <Text className='waitlist-section__title'>候补池</Text>
                <Text className='list-section__meta'>
                  {filteredWaitlistGuests.length}/{waitlistGuests.length}
                </Text>
              </View>

              <View className='guest-list guest-list--scroll'>
                {filteredWaitlistGuests.length > 0 ? (
                  filteredWaitlistGuests.map((guest) => (
                    <View key={guest.id} className='guest-list__item guest-list__item--waitlist'>
                      <View className='guest-list__main'>
                        <Text>{guest.name}</Text>
                        <Text className='guest-list__meta'>默认分组：{guest.group}</Text>
                      </View>
                      <View className='guest-list__actions'>
                        <Button className='mini-action mini-action--primary' onClick={() => restoreGuestFromWaitlist(guest.id)}>
                          加入正式名单
                        </Button>
                        <Button className='mini-action' onClick={() => startEditGuest(guest.id)}>
                          编辑
                        </Button>
                        <Button className='mini-action mini-action--danger' onClick={() => deleteGuest(guest.id)}>
                          删除
                        </Button>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text className='table-card__empty'>没有匹配到候补宾客</Text>
                )}
              </View>
            </View>
          </View>

          <View className='panel'>
            <Text className='panel__title'>必须同桌</Text>
            <Text className='panel__hint'>
              只有正式名单里的宾客会出现在这里。点选需要坐在一起的人，生成一个同桌分组。
            </Text>

            <View className='must-picker'>
              {confirmedGuests.map((guest) => (
                <Button
                  key={guest.id}
                  className={`chip ${selectedMustGuestIds.includes(guest.id) ? 'chip--active' : ''}`}
                  onClick={() => toggleMustGuestSelection(guest.id)}
                >
                  {guest.name}
                </Button>
              ))}
            </View>

            <View className='rule-actions rule-actions--single'>
              <Button className='button button--primary' onClick={createMustRule}>
                建立必须同桌分组
              </Button>
              <Button className='button' onClick={clearMustSelection}>
                清空当前选择
              </Button>
            </View>

            <Text className='selection-preview'>
              当前已选：
              {selectedMustGuestIds.length > 0
                ? selectedMustGuestIds.map((guestId) => getGuestName(guests, guestId)).join('、')
                : ' 暂无'}
            </Text>

            <View className='rule-list'>
              {sanitizeRules(rules, guests)
                .filter((rule) => rule.type === 'must')
                .map((rule) => (
                  <View key={rule.id} className='rule-list__item'>
                    <Text className='rule-list__type'>同桌分组</Text>
                    <Text className='rule-list__text'>
                      {rule.guestIds.map((guestId) => getGuestName(guests, guestId)).join('、')}
                    </Text>
                    <Button className='rule-list__delete' onClick={() => removeMustRule(rule.id)}>
                      删除
                    </Button>
                  </View>
                ))}
            </View>
          </View>

          <View className='panel panel--wide'>
        <View className='panel__header'>
          <View>
            <Text className='panel__title'>排座结果</Text>
            <Text className='panel__hint'>同圈层优先聚合，并尽量满足你配置的必须同桌分组。</Text>
          </View>
          <View className='result-actions'>
            <Button className='button' onClick={regenerateSeating}>
              一键生成
            </Button>
            <Button className='button button--primary' onClick={exportCurrentPlan}>
              导出结果
            </Button>
          </View>
        </View>

        {selectedSeatGuestId ? (
          <View className='selection-bar'>
            <Text className='selection-bar__title'>当前选中：{selectedSeatGuestName}</Text>
            <Text className='selection-bar__desc'>
              {selectedSeatGroup.length > 1
                ? `这位宾客属于同桌分组：${selectedSeatGroup.map((guestId) => getGuestName(guests, guestId)).join('、')}`
                : '这位宾客可以单独换桌，也可以和别桌的任意宾客做交换。'}
            </Text>

            <View className='move-actions'>
              {tables
                .filter((table) => table.id !== selectedSeatTableId)
                .map((table) => {
                  const remainingSeats =
                    table.capacity -
                    seating.tables[table.id].length -
                    (selectedSeatGroup.length > 1 ? selectedSeatGroup.length - 1 : 0)

                  return (
                    <Button
                      key={table.id}
                      className='chip'
                      onClick={() => moveSelectedGuestGroup(table.id)}
                    >
                      移到{table.name}（余 {remainingSeats}）
                    </Button>
                  )
                })}
            </View>

            <Text className='selection-bar__subhead'>交换对象</Text>
            <View className='move-actions'>
              {swapCandidates.map((guest) => (
                <Button
                  key={guest.id}
                  className={`chip ${selectedSwapGuestId === guest.id ? 'chip--active' : ''}`}
                  onClick={() => setSelectedSwapGuestId((currentId) => (currentId === guest.id ? null : guest.id))}
                >
                  {guest.name}
                </Button>
              ))}
            </View>

            <View className='selection-actions'>
              <Button
                className='button'
                onClick={swapSelectedGuestGroups}
                disabled={!selectedSwapGuestId}
              >
                确认交换
              </Button>
              <Button
                className='button'
                onClick={() => {
                  setSelectedSeatGuestId(null)
                  setSelectedSwapGuestId(null)
                }}
              >
                取消选择
              </Button>
            </View>
          </View>
        ) : null}

        {seating.warnings.length > 0 ? (
          <View className='warning-box'>
            {seating.warnings.map((warning) => (
              <Text key={warning} className='warning-box__text'>
                {warning}
              </Text>
            ))}
          </View>
        ) : null}

        <View className='table-grid'>
          {tables.map((table) => (
            <View key={table.id} className='table-card'>
              <View className='table-card__header'>
                <Text className='table-card__title'>{table.name}</Text>
                <Text className='table-card__meta'>
                  {seating.tables[table.id]?.length ?? 0}/{table.capacity}
                </Text>
              </View>

              <View className='table-card__list'>
                {(seating.tables[table.id] ?? []).map((guestId) => (
                  <Button
                    key={guestId}
                    className={`seat-pill ${selectedSeatGuestId === guestId ? 'seat-pill--active' : ''}`}
                    onClick={() => selectSeatGuest(guestId)}
                  >
                    {getGuestName(guests, guestId)}
                  </Button>
                ))}

                {(seating.tables[table.id] ?? []).length === 0 ? (
                  <Text className='table-card__empty'>暂无安排</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
          </View>
        </View>
      </View>
    </View>
  )
}
