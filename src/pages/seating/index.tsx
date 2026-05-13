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

export default function SeatingPage() {
  const [plan, setPlan] = useState<SavedPlan>(() => loadPlan())
  const [tableCount, setTableCount] = useState(String(loadPlan().tables.length))
  const [seatsPerTable, setSeatsPerTable] = useState(String(loadPlan().tables[0]?.capacity ?? 10))
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [selectedSwapGuestId, setSelectedSwapGuestId] = useState<string | null>(null)

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
  const activeRules = useMemo(() => sanitizeRules(plan.rules, plan.guests), [plan.rules, plan.guests])
  const totalSeats = useMemo(() => plan.tables.reduce((sum, table) => sum + table.capacity, 0), [plan.tables])

  const persistPlan = (nextPlan: SavedPlan) => {
    setPlan(savePlan(nextPlan))
  }

  const updateTables = () => {
    const nextTableCount = Math.max(1, Number(tableCount) || 1)
    const nextSeatsPerTable = Math.max(1, Number(seatsPerTable) || 1)
    persistPlan({
      ...plan,
      tables: createTables(nextTableCount, nextSeatsPerTable)
    })
    setSelectedGuestId(null)
    setSelectedSwapGuestId(null)
  }

  const regenerate = () => {
    const seating = generateSeating(plan.tables, confirmedGuests, activeRules)
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
    setSelectedSwapGuestId(null)
  }

  const swapGuests = () => {
    if (!selectedGuestId || !selectedSwapGuestId) return

    const leftGroup = getMustSeatGroup(selectedGuestId, activeRules)
    const rightGroup = getMustSeatGroup(selectedSwapGuestId, activeRules)
    const leftTableId = findGuestTableId(plan.seating.tables, selectedGuestId)
    const rightTableId = findGuestTableId(plan.seating.tables, selectedSwapGuestId)
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
    setSelectedSwapGuestId(null)
  }

  const selectedTableId = selectedGuestId ? findGuestTableId(plan.seating.tables, selectedGuestId) : null
  const swapCandidates = selectedGuestId
    ? confirmedGuests.filter((guest) => guest.id !== selectedGuestId && findGuestTableId(plan.seating.tables, guest.id) !== selectedTableId)
    : []

  return (
    <View className='seating-page'>
      <TopNav active='seating' />

      <View className='seating-topbar'>
        <View>
          <Text className='seating-title'>排座页</Text>
          <Text className='seating-subtitle'>这里专门做桌位配置、自动生成和手动移动，不再和名单挤在一起。</Text>
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
              onClick={() => Taro.setClipboardData({ data: exportSeatingText(plan.tables, confirmedGuests, plan.seating) })}
            >
              导出文本
            </Button>
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
              <Text className='summary-label'>正式名单</Text>
              <Text className='summary-value'>{confirmedGuests.length} 人</Text>
            </View>
            <View className='summary-card'>
              <Text className='summary-label'>候补池</Text>
              <Text className='summary-value'>{plan.guests.length - confirmedGuests.length} 人</Text>
            </View>
          </View>
        </View>

        <View className='panel panel--controls'>
          <Text className='panel__title'>手动移动</Text>
          <Text className='panel__hint'>先点击下方桌位中的宾客，再在这里选择目标桌或交换对象。</Text>

          <View className='selection-box'>
            <Text className='selection-label'>当前选中</Text>
            <Text className='selection-value'>
              {selectedGuestId ? getGuestName(confirmedGuests, selectedGuestId) : '暂未选择'}
            </Text>
          </View>

          {selectedGuestId ? (
            <>
              <View className='control-section'>
                <Text className='control-title'>移动到目标桌</Text>
                <View className='chip-grid'>
                  {plan.tables
                    .filter((table) => table.id !== selectedTableId)
                    .map((table) => (
                      <Button key={table.id} className='picker-chip' onClick={() => moveSelectedGroup(table.id)}>
                        {table.name}
                      </Button>
                    ))}
                </View>
              </View>

              <View className='control-section'>
                <Text className='control-title'>交换对象</Text>
                <View className='chip-grid'>
                  {swapCandidates.map((guest) => (
                    <Button
                      key={guest.id}
                      className={`picker-chip ${selectedSwapGuestId === guest.id ? 'picker-chip--active' : ''}`}
                      onClick={() => setSelectedSwapGuestId((currentId) => (currentId === guest.id ? null : guest.id))}
                    >
                      {guest.name}
                    </Button>
                  ))}
                </View>
                <View className='toolbar'>
                  <Button className='secondary-compact' onClick={swapGuests} disabled={!selectedSwapGuestId}>
                    确认交换
                  </Button>
                  <Button
                    className='secondary-compact'
                    onClick={() => {
                      setSelectedGuestId(null)
                      setSelectedSwapGuestId(null)
                    }}
                  >
                    清空选择
                  </Button>
                </View>
              </View>
            </>
          ) : null}
        </View>

        <View className='panel panel--result'>
          <Text className='panel__title'>桌位结果</Text>
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
            {plan.tables.map((table) => (
              <View key={table.id} className='table-card'>
                <View className='table-head'>
                  <Text className='table-name'>{table.name}</Text>
                  <Text className='table-meta'>
                    {plan.seating.tables[table.id]?.length ?? 0}/{table.capacity}
                  </Text>
                </View>

                <View className='seat-list'>
                  {(plan.seating.tables[table.id] ?? []).map((guestId) => (
                    <Button
                      key={guestId}
                      className={`seat-chip ${selectedGuestId === guestId ? 'seat-chip--active' : ''}`}
                      onClick={() => {
                        setSelectedSwapGuestId(null)
                        setSelectedGuestId((currentId) => (currentId === guestId ? null : guestId))
                      }}
                    >
                      {getGuestName(confirmedGuests, guestId)}
                    </Button>
                  ))}

                  {selectedGuestId && selectedTableId !== table.id ? (
                    <Button className='drop-target' onClick={() => moveSelectedGroup(table.id)}>
                      移入此桌
                    </Button>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}
