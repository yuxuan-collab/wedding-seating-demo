import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { TopNav } from '../../components/top-nav'
import { navigatePage } from '../../utils/navigation'
import { defaultGuestGroups, getWaitlistGuests, loadPlan, sanitizeRules, savePlan } from '../../utils/plan'
import type { Guest, GuestGroup, SavedPlan } from '../../types/seating'
import './index.scss'

function readValue(event: { detail?: { value?: string } }) {
  return event.detail?.value ?? ''
}

function getGuestName(guests: Guest[], guestId: string) {
  return guests.find((guest) => guest.id === guestId)?.name ?? guestId
}

function getGuestStatusLabel(status?: Guest['status']) {
  return status === 'waitlist' ? '候补' : '正式'
}

export default function RosterPage() {
  const [plan, setPlan] = useState<SavedPlan>(() => loadPlan())
  const [guestDraftText, setGuestDraftText] = useState('')
  const [guestDraftGroup, setGuestDraftGroup] = useState<GuestGroup>(defaultGuestGroups[0])
  const [bulkTargetGroup, setBulkTargetGroup] = useState<GuestGroup>(defaultGuestGroups[0])
  const [bulkNameDraftText, setBulkNameDraftText] = useState('')
  const [bulkNameTargetGroup, setBulkNameTargetGroup] = useState<GuestGroup>(defaultGuestGroups[0])
  const [customGroupDraft, setCustomGroupDraft] = useState('')
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string>('全部')
  const [selectedMustGuestIds, setSelectedMustGuestIds] = useState<string[]>([])

  useEffect(() => {
    const nextPlan = loadPlan()
    setPlan(nextPlan)
    setGuestDraftGroup(nextPlan.groupOptions[0] ?? defaultGuestGroups[0])
    setBulkTargetGroup(nextPlan.groupOptions[0] ?? defaultGuestGroups[0])
    setBulkNameTargetGroup(nextPlan.groupOptions[0] ?? defaultGuestGroups[0])
  }, [])

  const confirmedGuests = useMemo(
    () => plan.guests.filter((guest) => guest.status !== 'waitlist'),
    [plan.guests]
  )
  const allGuests = useMemo(() => plan.guests, [plan.guests])
  const waitlistGuests = useMemo(() => getWaitlistGuests(plan.guests), [plan.guests])
  const activeRules = useMemo(() => sanitizeRules(plan.rules, plan.guests), [plan.rules, plan.guests])

  const filteredConfirmedGuests = confirmedGuests.filter((guest) => groupFilter === '全部' || guest.group === groupFilter)
  const filteredWaitlistGuests = waitlistGuests.filter((guest) => groupFilter === '全部' || guest.group === groupFilter)

  const persistPlan = (nextPlan: SavedPlan) => {
    const savedPlan = savePlan(nextPlan)
    setPlan(savedPlan)
    setBulkTargetGroup((currentGroup) =>
      savedPlan.groupOptions.includes(currentGroup) ? currentGroup : savedPlan.groupOptions[0] ?? defaultGuestGroups[0]
    )
    setBulkNameTargetGroup((currentGroup) =>
      savedPlan.groupOptions.includes(currentGroup) ? currentGroup : savedPlan.groupOptions[0] ?? defaultGuestGroups[0]
    )
  }

  const parseGuestNames = (rawText: string) =>
    rawText
      .split(/[\n,，;；]+/)
      .map((name) => name.trim())
      .filter(Boolean)

  const upsertGuests = () => {
    if (editingGuestId) {
      const trimmedName = guestDraftText.trim()
      if (!trimmedName) {
        Taro.showToast({ title: '请输入宾客姓名', icon: 'none' })
        return
      }

      persistPlan({
        ...plan,
        guests: plan.guests.map((guest) =>
          guest.id === editingGuestId
            ? {
                ...guest,
                name: trimmedName,
                group: guestDraftGroup
              }
            : guest
        )
      })
      setEditingGuestId(null)
      setGuestDraftText('')
      setGuestDraftGroup(plan.groupOptions[0] ?? defaultGuestGroups[0])
      Taro.showToast({ title: '已更新宾客', icon: 'success' })
      return
    }

    const names = parseGuestNames(guestDraftText)
    if (names.length === 0) {
      Taro.showToast({ title: '先输入宾客姓名', icon: 'none' })
      return
    }

    const existingNames = new Set(plan.guests.map((guest) => guest.name.trim()))
    const uniqueNames = names.filter((name, index) => !existingNames.has(name) && names.indexOf(name) === index)

    if (uniqueNames.length === 0) {
      Taro.showToast({ title: '这些名字已经都在名单里了', icon: 'none' })
      return
    }

    persistPlan({
      ...plan,
      guests: [
        ...plan.guests,
        ...uniqueNames.map((name, index) => ({
          id: `g${Date.now()}-${index}`,
          name,
          group: guestDraftGroup,
          status: 'confirmed' as const
        }))
      ]
    })
    setGuestDraftText('')
    Taro.showToast({ title: `已添加 ${uniqueNames.length} 位宾客`, icon: 'success' })
  }

  const startEditGuest = (guestId: string) => {
    const guest = plan.guests.find((item) => item.id === guestId)
    if (!guest) return
    setEditingGuestId(guest.id)
    setGuestDraftText(guest.name)
    setGuestDraftGroup(guest.group)
    setTimeout(() => {
      Taro.pageScrollTo({ selector: '.edit-anchor', duration: 220, offsetTop: 12 })
    }, 60)
  }

  const cancelEdit = () => {
    setEditingGuestId(null)
    setGuestDraftText('')
    setGuestDraftGroup(plan.groupOptions[0] ?? defaultGuestGroups[0])
  }

  const addCustomGroup = () => {
    const nextGroup = customGroupDraft.trim()
    if (!nextGroup) {
      Taro.showToast({ title: '请输入类型名称', icon: 'none' })
      return
    }

    if (plan.groupOptions.includes(nextGroup)) {
      setGuestDraftGroup(nextGroup)
      setCustomGroupDraft('')
      Taro.showToast({ title: '这个类型已经存在', icon: 'none' })
      return
    }

    persistPlan({
      ...plan,
      groupOptions: [...plan.groupOptions, nextGroup]
    })
    setGuestDraftGroup(nextGroup)
    setCustomGroupDraft('')
  }

  const removeGroupOption = (group: GuestGroup) => {
    if (plan.groupOptions.length <= 1) {
      Taro.showToast({ title: '至少保留 1 个宾客类型', icon: 'none' })
      return
    }

    const nextOptions = plan.groupOptions.filter((item) => item !== group)
    persistPlan({
      ...plan,
      groupOptions: nextOptions
    })

    if (guestDraftGroup === group) {
      setGuestDraftGroup(nextOptions[0] ?? defaultGuestGroups[0])
    }
  }

  const deleteGuest = (guestId: string) => {
    persistPlan({
      ...plan,
      guests: plan.guests.filter((guest) => guest.id !== guestId),
      rules: sanitizeRules(plan.rules, plan.guests.filter((guest) => guest.id !== guestId))
    })
    setSelectedMustGuestIds((currentIds) => currentIds.filter((id) => id !== guestId))
    if (editingGuestId === guestId) {
      cancelEdit()
    }
    Taro.showToast({ title: '已删除宾客', icon: 'none' })
  }

  const moveGuestToWaitlist = (guestId: string) => {
    const nextGuests = plan.guests.map((guest) =>
      guest.id === guestId
        ? {
            ...guest,
            status: 'waitlist' as const
          }
        : guest
    )
    persistPlan({
      ...plan,
      guests: nextGuests,
      rules: sanitizeRules(plan.rules, nextGuests)
    })
    setSelectedMustGuestIds((currentIds) => currentIds.filter((id) => id !== guestId))
  }

  const restoreGuestFromWaitlist = (guestId: string) => {
    persistPlan({
      ...plan,
      guests: plan.guests.map((guest) =>
        guest.id === guestId
          ? {
              ...guest,
              status: 'confirmed' as const
            }
          : guest
      )
    })
  }

  const bulkReassignFilteredGuests = () => {
    if (groupFilter === '全部') {
      Taro.showToast({ title: '先按错误类型筛选一批人', icon: 'none' })
      return
    }

    if (bulkTargetGroup === groupFilter) {
      Taro.showToast({ title: '目标类型和当前筛选相同', icon: 'none' })
      return
    }

    const affectedGuests = plan.guests.filter((guest) => guest.group === groupFilter)
    if (affectedGuests.length === 0) {
      Taro.showToast({ title: '当前筛选下没有可修改的宾客', icon: 'none' })
      return
    }

    persistPlan({
      ...plan,
      guests: plan.guests.map((guest) =>
        guest.group === groupFilter
          ? {
              ...guest,
              group: bulkTargetGroup
            }
          : guest
      )
    })
    setGroupFilter(bulkTargetGroup)
    Taro.showToast({ title: `已批量修改 ${affectedGuests.length} 人`, icon: 'success' })
  }

  const bulkReassignGuestsByNames = () => {
    const targetNames = parseGuestNames(bulkNameDraftText)
    if (targetNames.length === 0) {
      Taro.showToast({ title: '先输入一批姓名', icon: 'none' })
      return
    }

    const targetNameSet = new Set(targetNames)
    const matchedGuests = plan.guests.filter((guest) => targetNameSet.has(guest.name.trim()))

    if (matchedGuests.length === 0) {
      Taro.showToast({ title: '没有匹配到名单中的姓名', icon: 'none' })
      return
    }

    const matchedNameSet = new Set(matchedGuests.map((guest) => guest.name.trim()))
    const missingCount = targetNames.filter((name) => !matchedNameSet.has(name)).length

    persistPlan({
      ...plan,
      guests: plan.guests.map((guest) =>
        targetNameSet.has(guest.name.trim())
          ? {
              ...guest,
              group: bulkNameTargetGroup
            }
          : guest
      )
    })
    setBulkNameDraftText('')
    setGroupFilter(bulkNameTargetGroup)
    Taro.showToast({
      title: missingCount > 0 ? `已更新 ${matchedGuests.length} 人，${missingCount} 人未匹配` : `已批量贴标签 ${matchedGuests.length} 人`,
      icon: 'success'
    })
  }

  const toggleMustGuestSelection = (guestId: string) => {
    setSelectedMustGuestIds((currentIds) =>
      currentIds.includes(guestId) ? currentIds.filter((id) => id !== guestId) : [...currentIds, guestId]
    )
  }

  const createMustRule = () => {
    if (selectedMustGuestIds.length < 2) {
      Taro.showToast({ title: '至少选择 2 位宾客', icon: 'none' })
      return
    }

    const exists = activeRules.some((rule) => {
      if (editingRuleId && rule.id === editingRuleId) {
        return false
      }

      const normalized = [...rule.guestIds].sort().join(':')
      return normalized === [...selectedMustGuestIds].sort().join(':')
    })

    if (exists) {
      Taro.showToast({ title: '这个同桌分组已经存在', icon: 'none' })
      return
    }

    persistPlan({
      ...plan,
      rules: editingRuleId
        ? plan.rules.map((rule) =>
            rule.id === editingRuleId
              ? {
                  ...rule,
                  guestIds: selectedMustGuestIds
                }
              : rule
          )
        : [
            ...plan.rules,
            {
              id: `r${Date.now()}`,
              type: 'must',
              guestIds: selectedMustGuestIds
            }
          ]
    })
    setEditingRuleId(null)
    setSelectedMustGuestIds([])
    Taro.showToast({ title: editingRuleId ? '已更新同桌分组' : '已添加同桌分组', icon: 'success' })
  }

  const removeRule = (ruleId: string) => {
    persistPlan({
      ...plan,
      rules: plan.rules.filter((rule) => rule.id !== ruleId)
    })

    if (editingRuleId === ruleId) {
      setEditingRuleId(null)
      setSelectedMustGuestIds([])
    }
  }

  const startEditRule = (ruleId: string) => {
    const targetRule = activeRules.find((rule) => rule.id === ruleId && rule.type === 'must')
    if (!targetRule) return

    setEditingRuleId(ruleId)
    setSelectedMustGuestIds(targetRule.guestIds)
    setTimeout(() => {
      Taro.pageScrollTo({ selector: '.rules-anchor', duration: 220, offsetTop: 12 })
    }, 60)
  }

  const cancelEditRule = () => {
    setEditingRuleId(null)
    setSelectedMustGuestIds([])
  }

  return (
    <View className='roster-page'>
      <TopNav active='roster' />

      <View className='roster-topbar'>
        <View>
          <Text className='roster-title'>名单管理</Text>
          <Text className='roster-subtitle'>先整理名单、候补池和同桌要求，再去排座页安排具体桌位。</Text>
        </View>
        <Button className='primary-compact' onClick={() => navigatePage('/pages/seating/index')}>
          去排座页
        </Button>
      </View>

      <View className='roster-grid'>
        <View className='panel panel--composer'>
          <Text className='panel__title'>名单录入</Text>
          <Text className='panel__hint'>支持换行、逗号或分号。默认先加入正式名单。</Text>
          {editingGuestId ? (
            <View className='field edit-anchor'>
              <Text className='field__label'>编辑宾客</Text>
              <Input
                className='field__input'
                value={guestDraftText}
                placeholder='编辑宾客姓名'
                onInput={(event) => setGuestDraftText(readValue(event))}
              />
            </View>
          ) : (
            <View className='field'>
              <View className='field__label-row'>
                <Text className='field__label'>批量导入名单</Text>
                <Text className='field__tip'>示例：刘珈 / 张睿婧 / 罗宇峰，郭文卓</Text>
              </View>
              <Textarea
                className='field__textarea'
                value={guestDraftText}
                maxlength={6000}
                placeholder='粘贴名单，支持换行或逗号分隔'
                onInput={(event) => setGuestDraftText(readValue(event))}
              />
            </View>
          )}

          {!editingGuestId ? (
            <View className='composer-actions composer-actions--primary'>
              <Button className='primary-compact primary-compact--wide' onClick={upsertGuests}>
                批量加入名单
              </Button>
            </View>
          ) : null}

          <View className='field'>
            <Text className='field__label'>{editingGuestId ? '宾客类型' : '默认宾客类型'}</Text>
            <View className='group-picker'>
              {plan.groupOptions.map((group) => (
                <View key={group} className={`group-option ${guestDraftGroup === group ? 'group-option--active' : ''}`}>
                  <Button
                    className={`group-chip ${guestDraftGroup === group ? 'group-chip--active' : ''}`}
                    onClick={() => setGuestDraftGroup(group)}
                  >
                    {group}
                  </Button>
                  <Text className='group-remove' onClick={() => removeGroupOption(group)}>
                    x
                  </Text>
                </View>
              ))}
            </View>
            <View className='group-add'>
              <View className='group-add__input-wrap'>
                <Input
                  className='field__input group-add__input'
                  value={customGroupDraft}
                  placeholder='输入新类型'
                  onInput={(event) => setCustomGroupDraft(readValue(event))}
                />
              </View>
              <View className='group-add__action'>
                <Button className='secondary-compact group-add__button' onClick={addCustomGroup}>
                  新增类型
                </Button>
              </View>
            </View>
          </View>

          {editingGuestId ? (
            <View className='composer-actions'>
              <Button className='primary-compact primary-compact--wide' onClick={upsertGuests}>
                保存宾客
              </Button>
              <Button className='secondary-compact secondary-compact--wide' onClick={cancelEdit}>
                取消编辑
              </Button>
            </View>
          ) : null}
        </View>

        <View className='panel panel--list'>
          <View className='section-row'>
            <Text className='panel__title'>名单</Text>
            <Text className='counter-chip'>正式 {confirmedGuests.length} / 候补 {waitlistGuests.length}</Text>
          </View>

          <View className='field'>
            <Text className='field__label'>类型筛选</Text>
            <View className='filter-chips'>
              <Button
                className={`filter-chip ${groupFilter === '全部' ? 'filter-chip--active' : ''}`}
                onClick={() => setGroupFilter('全部')}
              >
                全部
              </Button>
              {plan.groupOptions.map((group) => (
                <Button
                  key={group}
                  className={`filter-chip ${groupFilter === group ? 'filter-chip--active' : ''}`}
                  onClick={() => setGroupFilter(group)}
                >
                  {group}
                </Button>
              ))}
            </View>
          </View>

          <View className='field'>
            <View className='field__label-row'>
              <Text className='field__label'>批量修正类型</Text>
              <Text className='field__tip'>对当前筛选结果生效</Text>
            </View>
            <View className='bulk-type-bar'>
              <View className='bulk-type-bar__chips'>
                {plan.groupOptions.map((group) => (
                  <Button
                    key={group}
                    className={`filter-chip ${bulkTargetGroup === group ? 'filter-chip--active' : ''}`}
                    onClick={() => setBulkTargetGroup(group)}
                  >
                    {group}
                  </Button>
                ))}
              </View>
              <Button className='secondary-compact bulk-type-bar__action' onClick={bulkReassignFilteredGuests}>
                把当前筛选批量改为该类型
              </Button>
            </View>
          </View>

          <View className='field'>
            <View className='field__label-row'>
              <Text className='field__label'>按姓名批量贴标签</Text>
              <Text className='field__tip'>适合导入后快速修正一批人</Text>
            </View>
            <View className='bulk-type-bar'>
              <Textarea
                className='field__textarea bulk-type-bar__textarea'
                value={bulkNameDraftText}
                maxlength={6000}
                placeholder='输入姓名，支持换行或逗号分隔'
                onInput={(event) => setBulkNameDraftText(readValue(event))}
              />
              <View className='bulk-type-bar__chips bulk-type-bar__chips--stack'>
                {plan.groupOptions.map((group) => (
                  <Button
                    key={group}
                    className={`filter-chip ${bulkNameTargetGroup === group ? 'filter-chip--active' : ''}`}
                    onClick={() => setBulkNameTargetGroup(group)}
                  >
                    {group}
                  </Button>
                ))}
              </View>
              <Button className='secondary-compact bulk-type-bar__action' onClick={bulkReassignGuestsByNames}>
                把这批姓名改为该类型
              </Button>
            </View>
          </View>

          <View className='list-columns'>
            <View className='list-panel'>
              <View className='section-row'>
                <Text className='list-title'>正式名单</Text>
                <Text className='list-count'>{filteredConfirmedGuests.length}</Text>
              </View>
              <View className='guest-table'>
                <View className='guest-table__head'>
                  <Text>姓名</Text>
                  <Text>状态</Text>
                  <Text>分组</Text>
                  <Text>操作</Text>
                </View>
                {filteredConfirmedGuests.map((guest) => (
                  <View key={guest.id} className='guest-table__row'>
                    <View className='guest-main'>
                      <Text className='guest-name'>{guest.name}</Text>
                      <View className='guest-badges'>
                        <Text className='status-pill status-pill--confirmed'>正式</Text>
                        <Text className='guest-desc'>{guest.group}</Text>
                      </View>
                    </View>
                    <Text className='guest-status-cell'>正式</Text>
                    <Text className='guest-group-cell'>{guest.group}</Text>
                    <View className='guest-actions'>
                      <Button className='mini-btn' onClick={() => startEditGuest(guest.id)}>
                        编辑
                      </Button>
                      <Button className='mini-btn' onClick={() => moveGuestToWaitlist(guest.id)}>
                        候补
                      </Button>
                      <Button className='mini-btn mini-btn--danger' onClick={() => deleteGuest(guest.id)}>
                        删除
                      </Button>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View className='list-panel'>
              <View className='section-row'>
                <Text className='list-title'>候补池</Text>
                <Text className='list-count'>{filteredWaitlistGuests.length}</Text>
              </View>
              <View className='guest-table'>
                <View className='guest-table__head'>
                  <Text>姓名</Text>
                  <Text>状态</Text>
                  <Text>备注</Text>
                  <Text>操作</Text>
                </View>
                {filteredWaitlistGuests.map((guest) => (
                  <View key={guest.id} className='guest-table__row guest-table__row--waitlist'>
                    <View className='guest-main'>
                      <Text className='guest-name'>{guest.name}</Text>
                      <View className='guest-badges'>
                        <Text className='status-pill status-pill--waitlist'>候补</Text>
                        <Text className='guest-desc'>{guest.group}</Text>
                      </View>
                    </View>
                    <Text className='guest-status-cell'>候补</Text>
                    <Text className='guest-group-cell'>{guest.group}</Text>
                    <View className='guest-actions'>
                      <Button className='mini-btn mini-btn--primary' onClick={() => restoreGuestFromWaitlist(guest.id)}>
                        转正式
                      </Button>
                      <Button className='mini-btn' onClick={() => startEditGuest(guest.id)}>
                        编辑
                      </Button>
                      <Button className='mini-btn mini-btn--danger' onClick={() => deleteGuest(guest.id)}>
                        删除
                      </Button>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View className='panel panel--rules'>
          <View className='rules-head rules-anchor'>
            <View>
              <Text className='panel__title panel__title--compact'>同桌要求</Text>
              <Text className='panel__hint panel__hint--inline'>
                {editingRuleId ? '正在编辑同桌分组，调整成员后保存。' : '可从正式名单或候补池点选宾客，建立必须同桌分组。'}
              </Text>
            </View>
            <Button className='secondary-compact' onClick={() => setSelectedMustGuestIds([])}>
              清空当前选择
            </Button>
          </View>

          <View className='selection-box'>
            <Text className='selection-label'>当前已选</Text>
            <Text className='selection-value'>
              {selectedMustGuestIds.length > 0
                ? selectedMustGuestIds.map((guestId) => getGuestName(allGuests, guestId)).join('、')
                : '暂无'}
            </Text>
          </View>

          <View className='picker-grid'>
            {allGuests.map((guest) => (
              <Button
                key={guest.id}
                className={`picker-chip ${selectedMustGuestIds.includes(guest.id) ? 'picker-chip--active' : ''}`}
                onClick={() => toggleMustGuestSelection(guest.id)}
              >
                {guest.name}
                <Text className='picker-chip__meta'>{getGuestStatusLabel(guest.status)}</Text>
              </Button>
            ))}
          </View>

          <View className='composer-actions composer-actions--rules'>
            <Button className='primary-compact primary-compact--rule' onClick={createMustRule}>
              {editingRuleId ? '保存同桌分组' : '建立同桌分组'}
            </Button>
            {editingRuleId ? (
              <Button className='secondary-compact' onClick={cancelEditRule}>
                取消编辑
              </Button>
            ) : null}
          </View>

          <View className='rule-board'>
            {activeRules
              .filter((rule) => rule.type === 'must')
              .map((rule) => (
                <View key={rule.id} className='rule-row'>
                  <View className='rule-info'>
                    <Text className='rule-label'>同桌分组</Text>
                    <View className='rule-members'>
                      {rule.guestIds.map((guestId) => (
                        <Text key={guestId} className='rule-member'>
                          {getGuestName(allGuests, guestId)}
                        </Text>
                      ))}
                    </View>
                  </View>
                  <View className='rule-actions'>
                    <Button className='mini-btn' onClick={() => startEditRule(rule.id)}>
                      编辑
                    </Button>
                    <Button className='mini-btn mini-btn--danger rule-delete' onClick={() => removeRule(rule.id)}>
                      删除
                    </Button>
                  </View>
                </View>
              ))}
          </View>
        </View>
      </View>
    </View>
  )
}
