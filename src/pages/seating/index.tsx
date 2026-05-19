import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { TopNav } from '../../components/top-nav'
import { createTables, loadPlan, replaceSeating, savePlan, sanitizeRules } from '../../utils/plan'
import type { Guest, SavedPlan, SeatingResult } from '../../types/seating'
import { exportSeatingText, findGuestTableId, generateSeating, getMustSeatGroup } from '../../utils/seating'
import './index.scss'

function getGuestName(guests: Guest[], guestId: string) {
  return guests.find((guest) => guest.id === guestId)?.name ?? guestId
}

function getCompactTableName(name: string, index: number) {
  const matched = name.match(/^(\d+)/)
  return matched ? `T${matched[1]}` : `T${index + 1}`
}

export default function SeatingPage() {
  const [plan, setPlan] = useState<SavedPlan>(() => loadPlan())
  const [tableCount, setTableCount] = useState(String(loadPlan().tables.length))
  const [seatsPerTable, setSeatsPerTable] = useState(String(loadPlan().tables[0]?.capacity ?? 10))
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [includeWaitlistPreview, setIncludeWaitlistPreview] = useState(false)

  useEffect(() => {
    const nextPlan = loadPlan()
    setPlan(nextPlan)
    setTableCount(String(nextPlan.tables.length))
    setSeatsPerTable(String(nextPlan.tables[0]?.capacity ?? 10))
  }, [])

  const confirmedGuests = useMemo(
    () => plan.guests.filter((guest) => guest.status !== 'waitlist'),
    [plan.guests]
  )
  const allGuests = useMemo(() => plan.guests, [plan.guests])
  const previewGuests = useMemo(
    () => (includeWaitlistPreview ? plan.guests : confirmedGuests),
    [confirmedGuests, includeWaitlistPreview, plan.guests]
  )
  const activeRules = useMemo(() => sanitizeRules(plan.rules, previewGuests), [plan.rules, previewGuests])
  const totalSeats = useMemo(() => plan.tables.reduce((sum, table) => sum + table.capacity, 0), [plan.tables])

  const persistPlan = (nextPlan: SavedPlan) => {
    setPlan(savePlan(nextPlan))
  }

  const applyPreviewMode = (nextIncludeWaitlistPreview: boolean) => {
    const nextPreviewGuests = nextIncludeWaitlistPreview ? plan.guests : confirmedGuests
    const nextRules = sanitizeRules(plan.rules, nextPreviewGuests)
    const nextSeating = generateSeating(plan.tables, nextPreviewGuests, nextRules)

    setIncludeWaitlistPreview(nextIncludeWaitlistPreview)
    setSelectedGuestId(null)
    setPlan(replaceSeating(plan, nextSeating))
  }

  const updateTables = () => {
    const nextTableCount = Math.max(1, Number(tableCount) || 1)
    const nextSeatsPerTable = Math.max(1, Number(seatsPerTable) || 1)
    persistPlan({
      ...plan,
      tables: createTables(nextTableCount, nextSeatsPerTable)
    })
    setSelectedGuestId(null)
  }

  const adjustTableCapacity = (tableId: string, delta: number) => {
    const targetTable = plan.tables.find((table) => table.id === tableId)
    if (!targetTable) return

    const currentGuestCount = plan.seating.tables[tableId]?.length ?? 0
    const nextCapacity = Math.max(1, targetTable.capacity + delta)

    if (nextCapacity < currentGuestCount) {
      Taro.showToast({ title: '先移出宾客，再减少席位', icon: 'none' })
      return
    }

    persistPlan({
      ...plan,
      tables: plan.tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              capacity: nextCapacity
            }
          : table
      )
    })
  }

  const regenerate = () => {
    const seating = generateSeating(plan.tables, previewGuests, activeRules)
    setPlan(replaceSeating(plan, seating))
    Taro.showToast({ title: '已生成座位方案', icon: 'success' })
  }

  const moveSelectedGroup = (targetTableId: string) => {
    if (!selectedGuestId) return

    const sourceTableId = findGuestTableId(plan.seating.tables, selectedGuestId)
    if (!sourceTableId || sourceTableId === targetTableId) return

    const movingGuestIds = getMustSeatGroup(selectedGuestId, activeRules)
    const movingGuestSet = new Set(movingGuestIds)
    const targetTable = plan.tables.find((table) => table.id === targetTableId)
    if (!targetTable) return

    const nextTargetGuests = [...(plan.seating.tables[targetTableId] ?? []), ...movingGuestIds]
    if (nextTargetGuests.length > targetTable.capacity) {
      Taro.showToast({ title: '目标桌位不够', icon: 'none' })
      return
    }

    const nextSeating: SeatingResult = {
      tables: {
        ...plan.seating.tables,
        [sourceTableId]: (plan.seating.tables[sourceTableId] ?? []).filter((guestId) => !movingGuestSet.has(guestId)),
        [targetTableId]: nextTargetGuests
      },
      warnings: []
    }

    setPlan(replaceSeating(plan, nextSeating))
    setSelectedGuestId(null)
  }

  const swapSelectedWith = (targetGuestId: string) => {
    if (!selectedGuestId || selectedGuestId === targetGuestId) return

    const leftGroup = getMustSeatGroup(selectedGuestId, activeRules)
    const rightGroup = getMustSeatGroup(targetGuestId, activeRules)
    const leftTableId = findGuestTableId(plan.seating.tables, selectedGuestId)
    const rightTableId = findGuestTableId(plan.seating.tables, targetGuestId)
    if (!leftTableId || !rightTableId || leftTableId === rightTableId) return

    const leftTable = plan.tables.find((table) => table.id === leftTableId)
    const rightTable = plan.tables.find((table) => table.id === rightTableId)
    if (!leftTable || !rightTable) return

    const leftSet = new Set(leftGroup)
    const rightSet = new Set(rightGroup)
    const nextLeftGuests = [...(plan.seating.tables[leftTableId] ?? []).filter((guestId) => !leftSet.has(guestId)), ...rightGroup]
    const nextRightGuests = [...(plan.seating.tables[rightTableId] ?? []).filter((guestId) => !rightSet.has(guestId)), ...leftGroup]

    if (nextLeftGuests.length > leftTable.capacity || nextRightGuests.length > rightTable.capacity) {
      Taro.showToast({ title: '交换后会超出桌位容量', icon: 'none' })
      return
    }

    setPlan(
      replaceSeating(plan, {
        tables: {
          ...plan.seating.tables,
          [leftTableId]: nextLeftGuests,
          [rightTableId]: nextRightGuests
        },
        warnings: []
      })
    )
    setSelectedGuestId(null)
  }

  const selectedTableId = selectedGuestId ? findGuestTableId(plan.seating.tables, selectedGuestId) : null

  return (
    <View className='seating-page'>
      <TopNav active='seating' />

      <View className='seating-topbar'>
        <View>
          <Text className='seating-title'>排座页</Text>
          <Text className='seating-subtitle'>这里专门做桌位配置、自动生成和桌面看板调整。</Text>
        </View>
        <Button className='primary-compact' onClick={() => Taro.redirectTo({ url: '/pages/roster/index' })}>
          回名单页
        </Button>
      </View>

      <View className='seating-grid'>
        <View className='panel panel--settings'>
          <Text className='panel__title'>桌位设置</Text>
          <View className='field-grid'>
            <View className='field'>
              <Text className='field__label'>桌数</Text>
              <Input className='field__input' type='number' value={tableCount} onInput={(e) => setTableCount(e.detail.value)} />
            </View>
            <View className='field'>
              <Text className='field__label'>每桌人数</Text>
              <Input className='field__input' type='number' value={seatsPerTable} onInput={(e) => setSeatsPerTable(e.detail.value)} />
            </View>
          </View>
          <View className='toolbar'>
            <Button className='primary-compact' onClick={updateTables}>
              更新桌位
            </Button>
            <Button className='secondary-compact' onClick={regenerate}>
              一键生成
            </Button>
            <Button
              className='secondary-compact'
              onClick={() => Taro.setClipboardData({ data: exportSeatingText(plan.tables, previewGuests, plan.seating) })}
            >
              导出文本
            </Button>
          </View>

          <View className='preview-toggle'>
            <Text className='field__label'>排座预演</Text>
            <View className='preview-toggle__chips'>
              <Button
                className={`preview-toggle__chip ${!includeWaitlistPreview ? 'preview-toggle__chip--active' : ''}`}
                onClick={() => applyPreviewMode(false)}
              >
                仅正式名单
              </Button>
              <Button
                className={`preview-toggle__chip ${includeWaitlistPreview ? 'preview-toggle__chip--active' : ''}`}
                onClick={() => applyPreviewMode(true)}
              >
                加上候补一起预演
              </Button>
            </View>
          </View>

          <View className='summary-grid'>
            <View className='summary-card'>
              <Text className='summary-label'>桌位</Text>
              <Text className='summary-value'>{plan.tables.length} 桌</Text>
            </View>
            <View className='summary-card'>
              <Text className='summary-label'>总座位</Text>
              <Text className='summary-value'>{totalSeats}</Text>
            </View>
            <View className='summary-card'>
              <Text className='summary-label'>{includeWaitlistPreview ? '本次参排人数' : '正式名单'}</Text>
              <Text className='summary-value'>{previewGuests.length} 人</Text>
            </View>
            <View className='summary-card'>
              <Text className='summary-label'>候补池</Text>
              <Text className='summary-value'>{plan.guests.length - confirmedGuests.length} 人</Text>
            </View>
          </View>
        </View>

        <View className='panel panel--result'>
          <View className='result-head'>
            <View>
              <Text className='panel__title'>桌位结果</Text>
              <Text className='panel__hint'>点击宾客选中；点其他桌“移入此桌”移动，或点另一位宾客交换。</Text>
            </View>
            {selectedGuestId ? (
              <Button className='secondary-compact' onClick={() => setSelectedGuestId(null)}>
                清空选择
              </Button>
            ) : null}
          </View>
          {plan.seating.warnings.length > 0 ? (
            <View className='warning-box'>
              {plan.seating.warnings.map((warning) => (
                <Text key={warning} className='warning-text'>
                  {warning}
                </Text>
              ))}
            </View>
          ) : null}

          <View className='table-grid'>
            {plan.tables.map((table, index) => (
              <View key={table.id} className='table-card'>
                <View className='table-head'>
                  <View className='table-head__top'>
                    <Text className='table-name'>{getCompactTableName(table.name, index)}</Text>
                    <Text className='table-meta'>
                      {plan.seating.tables[table.id]?.length ?? 0}/{table.capacity}
                    </Text>
                  </View>
                  <View className='table-head__bottom'>
                    <View className='table-tools__actions'>
                      <Button className='table-tool-btn' onClick={() => adjustTableCapacity(table.id, -1)}>
                        −
                      </Button>
                      <Button className='table-tool-btn table-tool-btn--primary' onClick={() => adjustTableCapacity(table.id, 1)}>
                        ＋
                      </Button>
                    </View>
                  </View>
                </View>

                <View className='table-body'>
                  <View className='seat-list'>
                    {(plan.seating.tables[table.id] ?? []).map((guestId) => (
                      <Button
                        key={guestId}
                        className={`seat-chip ${selectedGuestId === guestId ? 'seat-chip--active' : ''}`}
                        onClick={() => {
                          if (!selectedGuestId || selectedGuestId === guestId) {
                            setSelectedGuestId((currentId) => (currentId === guestId ? null : guestId))
                            return
                          }

                          swapSelectedWith(guestId)
                        }}
                    >
                      {getGuestName(allGuests, guestId)}
                    </Button>
                  ))}

                    {selectedGuestId && selectedTableId !== table.id ? (
                      <Button className='drop-target' onClick={() => moveSelectedGroup(table.id)}>
                        移入此桌
                      </Button>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}
