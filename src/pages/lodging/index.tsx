import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { TopNav } from '../../components/top-nav'
import { navigatePage } from '../../utils/navigation'
import { loadPlan, savePlan } from '../../utils/plan'
import type { Guest, GuestLodging, SavedPlan } from '../../types/seating'
import './index.scss'

type LodgingFilter = 'all' | 'out_of_town' | 'needs_hotel' | 'with_checkin' | 'without_checkin' | 'no_hotel_needed'
type LodgingViewMode = 'guest_list' | 'hotel_summary'
type LodgingExportMode = 'hotel' | 'family'

const lodgingFilters: Array<{ key: LodgingFilter; label: string }> = [
  { key: 'all', label: '全部宾客' },
  { key: 'out_of_town', label: '仅外地' },
  { key: 'needs_hotel', label: '需安排住宿' },
  { key: 'with_checkin', label: '已填入住时间' },
  { key: 'without_checkin', label: '未填入住时间' },
  { key: 'no_hotel_needed', label: '不用安排酒店' }
]

const lodgingExportModes: Array<{ key: LodgingExportMode; label: string; description: string }> = [
  {
    key: 'hotel',
    label: '酒店版',
    description: '按酒店和房型整理，可直接复制给酒店销售或前台核对。'
  },
  {
    key: 'family',
    label: '家人确认版',
    description: '按宾客逐个列出安排，适合发给家人确认谁住哪里、住几晚。'
  }
]

function readValue(event: { detail?: { value?: string } }) {
  return event.detail?.value ?? ''
}

function createLodgingDraft(guest?: Guest): GuestLodging {
  const isOutOfTown = guest?.lodging?.isOutOfTown ?? false

  return {
    isOutOfTown,
    needsHotel: isOutOfTown ? guest?.lodging?.needsHotel ?? true : false,
    hotelName: guest?.lodging?.hotelName ?? '',
    roomType: guest?.lodging?.roomType ?? '',
    checkInDate: guest?.lodging?.checkInDate ?? '',
    nights: guest?.lodging?.nights ?? '',
    note: guest?.lodging?.note ?? ''
  }
}

function getLodgingStatusLabel(lodging: GuestLodging) {
  if (!lodging.isOutOfTown) return '本地宾客'
  if (!lodging.needsHotel) return '不用安排酒店'
  if (lodging.checkInDate.trim() || lodging.nights.trim()) {
    const dateLabel = lodging.checkInDate.trim() || '待填入住时间'
    const nightsLabel = lodging.nights.trim() || '待填晚数'
    return `${dateLabel} · ${nightsLabel}`
  }

  return '待补住宿信息'
}

function getGuestPoolLabel(status?: Guest['status']) {
  return status === 'waitlist' ? '候补' : '正式'
}

function matchesLodgingFilter(guest: Guest, filter: LodgingFilter) {
  const lodging = createLodgingDraft(guest)

  switch (filter) {
    case 'out_of_town':
      return lodging.isOutOfTown
    case 'needs_hotel':
      return lodging.isOutOfTown && lodging.needsHotel
    case 'with_checkin':
      return lodging.isOutOfTown && lodging.checkInDate.trim() !== ''
    case 'without_checkin':
      return lodging.isOutOfTown && lodging.needsHotel && lodging.checkInDate.trim() === ''
    case 'no_hotel_needed':
      return lodging.isOutOfTown && !lodging.needsHotel
    default:
      return true
  }
}

export default function LodgingPage() {
  const [plan, setPlan] = useState<SavedPlan>(() => loadPlan())
  const [filter, setFilter] = useState<LodgingFilter>('all')
  const [viewMode, setViewMode] = useState<LodgingViewMode>('guest_list')
  const [exportMode, setExportMode] = useState<LodgingExportMode>('hotel')
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [draft, setDraft] = useState<GuestLodging>(() => createLodgingDraft())

  useEffect(() => {
    const nextPlan = loadPlan()
    setPlan(nextPlan)
  }, [])

  const filteredGuests = useMemo(
    () => plan.guests.filter((guest) => matchesLodgingFilter(guest, filter)),
    [filter, plan.guests]
  )
  const selectedGuest = filteredGuests.find((guest) => guest.id === selectedGuestId) ?? null

  useEffect(() => {
    if (filteredGuests.length === 0) {
      setSelectedGuestId(null)
      setDraft(createLodgingDraft())
      return
    }

    if (!selectedGuestId || !filteredGuests.some((guest) => guest.id === selectedGuestId)) {
      setSelectedGuestId(filteredGuests[0].id)
    }
  }, [filteredGuests, selectedGuestId])

  useEffect(() => {
    if (!selectedGuest) return
    setDraft(createLodgingDraft(selectedGuest))
  }, [selectedGuest])

  const summary = useMemo(() => {
    const lodgingGuests = plan.guests.map((guest) => createLodgingDraft(guest))

    return {
      total: plan.guests.length,
      outOfTown: lodgingGuests.filter((lodging) => lodging.isOutOfTown).length,
      needsHotel: lodgingGuests.filter((lodging) => lodging.isOutOfTown && lodging.needsHotel).length,
      withCheckIn: lodgingGuests.filter((lodging) => lodging.isOutOfTown && lodging.checkInDate.trim() !== '').length,
      withNights: lodgingGuests.filter((lodging) => lodging.isOutOfTown && lodging.nights.trim() !== '').length
    }
  }, [plan.guests])

  const hotelGroups = useMemo(() => {
    const outOfTownGuests = plan.guests
      .map((guest) => ({
        guest,
        lodging: createLodgingDraft(guest)
      }))
      .filter(({ lodging }) => lodging.isOutOfTown)

    const groupsMap = outOfTownGuests.reduce<
      Record<string, { key: string; title: string; subtitle: string; guests: Guest[] }>
    >((result, item) => {
      let key = 'pending-hotel'
      let title = '待分配酒店'
      let subtitle = '还没填写酒店或入住信息'

      if (!item.lodging.needsHotel) {
        key = 'no-hotel-needed'
        title = '不用安排酒店'
        subtitle = '外地但不需要我们安排住宿'
      } else if (item.lodging.hotelName.trim()) {
        key = `hotel-${item.lodging.hotelName.trim()}`
        title = item.lodging.hotelName.trim()
        subtitle = [item.lodging.roomType.trim(), item.lodging.checkInDate.trim()].filter(Boolean).join(' · ') || '待补房型和入住时间'
      }

      if (!result[key]) {
        result[key] = {
          key,
          title,
          subtitle,
          guests: []
        }
      }

      result[key].guests.push(item.guest)
      return result
    }, {})

    return Object.values(groupsMap).sort((leftGroup, rightGroup) => rightGroup.guests.length - leftGroup.guests.length)
  }, [plan.guests])

  const exportText = useMemo(() => {
    if (exportMode === 'hotel') {
      const sections = hotelGroups.map((group) => {
        const lines = group.guests.map((guest) => {
          const lodging = createLodgingDraft(guest)
          const roomType = lodging.roomType.trim() || '未填房型'
          const checkInDate = lodging.checkInDate.trim() || '未填入住时间'
          const nights = lodging.nights.trim() || '未填晚数'
          const note = lodging.note.trim() ? `；备注：${lodging.note.trim()}` : ''
          return `- ${guest.name}｜${guest.group}｜${roomType}｜${checkInDate}｜${nights}${note}`
        })

        return [`${group.title}（${group.guests.length} 人）`, group.subtitle, ...lines].join('\n')
      })

      return ['住宿汇总（给酒店）', ...sections].filter(Boolean).join('\n\n')
    }

    const outOfTownGuests = plan.guests
      .map((guest) => ({ guest, lodging: createLodgingDraft(guest) }))
      .filter(({ lodging }) => lodging.isOutOfTown)
      .map(({ guest, lodging }) => {
        const arrangement = lodging.needsHotel
          ? `${lodging.hotelName.trim() || '待定酒店'} / ${lodging.roomType.trim() || '未填房型'} / ${lodging.checkInDate.trim() || '未填入住时间'} / ${lodging.nights.trim() || '未填晚数'}`
          : '不用安排酒店'
        const note = lodging.note.trim() ? ` / 备注：${lodging.note.trim()}` : ''
        return `- ${guest.name}｜${getGuestPoolLabel(guest.status)}｜${guest.group}｜${arrangement}${note}`
      })

    return ['外地宾客住宿清单（给家人确认）', ...outOfTownGuests].join('\n')
  }, [exportMode, hotelGroups, plan.guests])
  const exportModeDescription = lodgingExportModes.find((mode) => mode.key === exportMode)?.description ?? ''

  const persistPlan = (nextPlan: SavedPlan) => {
    setPlan(savePlan(nextPlan))
  }

  const updateDraft = (patch: Partial<GuestLodging>) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...patch
    }))
  }

  const saveLodging = () => {
    if (!selectedGuestId) return

    const nextLodging: GuestLodging = draft.isOutOfTown
      ? {
          ...draft,
          needsHotel: draft.needsHotel
        }
      : {
          isOutOfTown: false,
          needsHotel: false,
          hotelName: '',
          roomType: '',
          checkInDate: '',
          nights: '',
          note: draft.note
        }

    persistPlan({
      ...plan,
      guests: plan.guests.map((guest) =>
        guest.id === selectedGuestId
          ? {
              ...guest,
              lodging: nextLodging
            }
          : guest
      )
    })
    Taro.showToast({ title: '已保存住宿信息', icon: 'success' })
  }

  return (
    <View className='lodging-page'>
      <TopNav active='lodging' />

      <View className='lodging-topbar'>
        <View>
          <Text className='lodging-title'>住宿页</Text>
          <Text className='lodging-subtitle'>集中记录外地宾客是否需要住宿、酒店安排、入住进度和备注。</Text>
        </View>
        <Button className='secondary-compact' onClick={() => navigatePage('/pages/seating/index')}>
          去排座页
        </Button>
      </View>

      <View className='summary-grid'>
        <View className='summary-card'>
          <Text className='summary-label'>全部宾客</Text>
          <Text className='summary-value'>{summary.total} 人</Text>
        </View>
        <View className='summary-card'>
          <Text className='summary-label'>外地宾客</Text>
          <Text className='summary-value'>{summary.outOfTown} 人</Text>
        </View>
        <View className='summary-card'>
          <Text className='summary-label'>需安排住宿</Text>
          <Text className='summary-value'>{summary.needsHotel} 人</Text>
        </View>
        <View className='summary-card'>
          <Text className='summary-label'>已填入住时间</Text>
          <Text className='summary-value'>
            {summary.withCheckIn} 人
          </Text>
        </View>
        <View className='summary-card'>
          <Text className='summary-label'>已填入住晚数</Text>
          <Text className='summary-value'>
            {summary.withNights} 人
          </Text>
        </View>
      </View>

      <View className='panel lodging-export-panel'>
        <View className='section-row'>
          <View>
            <Text className='panel__title'>住宿导出视图</Text>
            <Text className='panel__hint'>可直接复制给酒店或家人，后面再接正式版导出文件也会沿用这套结构。</Text>
          </View>
          <Button className='secondary-compact' onClick={() => Taro.setClipboardData({ data: exportText })}>
            复制文本
          </Button>
        </View>

        <View className='preview-toggle'>
          <Text className='field__label'>导出用途</Text>
          <View className='preview-toggle__chips'>
            {lodgingExportModes.map((mode) => (
              <Button
                key={mode.key}
                className={`preview-toggle__chip ${exportMode === mode.key ? 'preview-toggle__chip--active' : ''}`}
                onClick={() => setExportMode(mode.key)}
              >
                {mode.label}
              </Button>
            ))}
          </View>
          <Text className='export-mode-copy'>{exportModeDescription}</Text>
        </View>

        <View className='export-preview'>
          <Text className='export-preview__text'>{exportText}</Text>
        </View>
      </View>

      <View className='lodging-grid'>
        <View className='panel'>
          <Text className='panel__title'>宾客住宿清单</Text>
          <Text className='panel__hint'>先筛选出外地宾客，再点击右侧编辑酒店、入住时间和入住晚数。</Text>

          <View className='preview-toggle'>
            <Text className='field__label'>查看方式</Text>
            <View className='preview-toggle__chips'>
              <Button
                className={`preview-toggle__chip ${viewMode === 'guest_list' ? 'preview-toggle__chip--active' : ''}`}
                onClick={() => setViewMode('guest_list')}
              >
                宾客清单
              </Button>
              <Button
                className={`preview-toggle__chip ${viewMode === 'hotel_summary' ? 'preview-toggle__chip--active' : ''}`}
                onClick={() => setViewMode('hotel_summary')}
              >
                酒店汇总
              </Button>
            </View>
          </View>

          <View className='preview-toggle'>
            <Text className='field__label'>筛选</Text>
            <View className='preview-toggle__chips'>
              {lodgingFilters.map((item) => (
                <Button
                  key={item.key}
                  className={`preview-toggle__chip ${filter === item.key ? 'preview-toggle__chip--active' : ''}`}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </View>
          </View>

          {viewMode === 'guest_list' ? (
            <View className='lodging-guest-list'>
              {filteredGuests.map((guest) => {
                const lodging = createLodgingDraft(guest)
                return (
                  <View
                    key={guest.id}
                    className={`lodging-guest-card ${selectedGuestId === guest.id ? 'lodging-guest-card--active' : ''}`}
                    onClick={() => setSelectedGuestId(guest.id)}
                  >
                    <View className='lodging-guest-card__head'>
                      <Text className='lodging-guest-card__name'>{guest.name}</Text>
                      <Text className='lodging-guest-card__group'>{guest.group}</Text>
                    </View>
                    <View className='lodging-guest-card__meta'>
                      <Text className='lodging-badge lodging-badge--pool'>{getGuestPoolLabel(guest.status)}</Text>
                      <Text className='lodging-badge'>{lodging.isOutOfTown ? '外地' : '本地'}</Text>
                      <Text className='lodging-badge lodging-badge--soft'>{getLodgingStatusLabel(lodging)}</Text>
                    </View>
                  </View>
                )
              })}

              {filteredGuests.length === 0 ? (
                <View className='empty-state'>
                  <Text className='empty-state__title'>当前筛选下还没有宾客</Text>
                  <Text className='empty-state__copy'>先切换一个筛选条件，或回名单页继续录入宾客。</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View className='hotel-summary-list'>
              {hotelGroups.map((group) => (
                <View key={group.key} className='hotel-summary-card'>
                  <View className='hotel-summary-card__head'>
                    <View>
                      <Text className='hotel-summary-card__title'>{group.title}</Text>
                      <Text className='hotel-summary-card__subtitle'>{group.subtitle}</Text>
                    </View>
                    <Text className='hotel-summary-card__count'>{group.guests.length} 人</Text>
                  </View>
                  <View className='hotel-summary-card__guests'>
                    {group.guests.map((guest) => (
                      <Button
                        key={guest.id}
                        className={`hotel-guest-chip ${selectedGuestId === guest.id ? 'hotel-guest-chip--active' : ''}`}
                        onClick={() => setSelectedGuestId(guest.id)}
                      >
                        {guest.name}
                      </Button>
                    ))}
                  </View>
                </View>
              ))}

              {hotelGroups.length === 0 ? (
                <View className='empty-state'>
                  <Text className='empty-state__title'>还没有外地宾客住宿数据</Text>
                  <Text className='empty-state__copy'>先给几位外地宾客补充酒店信息，这里就会自动按酒店归类。</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View className='panel'>
          <Text className='panel__title'>住宿详情</Text>
          <Text className='panel__hint'>为当前选中的宾客补充是否外地、是否需要酒店、酒店名、入住时间和备注。</Text>

          {selectedGuest ? (
            <View className='lodging-editor'>
              <View className='lodging-editor__head'>
                <View>
                  <Text className='lodging-editor__name'>{selectedGuest.name}</Text>
                  <Text className='lodging-editor__meta'>
                    {selectedGuest.group} · {getGuestPoolLabel(selectedGuest.status)}
                  </Text>
                </View>
                <Text className='lodging-editor__summary'>{getLodgingStatusLabel(draft)}</Text>
              </View>

              <View className='field'>
                <Text className='field__label'>是否外地宾客</Text>
                <View className='preview-toggle__chips'>
                  <Button
                    className={`preview-toggle__chip ${!draft.isOutOfTown ? 'preview-toggle__chip--active' : ''}`}
                    onClick={() => updateDraft({ isOutOfTown: false, needsHotel: false, hotelName: '', roomType: '', checkInDate: '', nights: '' })}
                  >
                    本地
                  </Button>
                  <Button
                    className={`preview-toggle__chip ${draft.isOutOfTown ? 'preview-toggle__chip--active' : ''}`}
                    onClick={() =>
                      updateDraft({
                        isOutOfTown: true,
                        needsHotel: true
                      })
                    }
                  >
                    外地
                  </Button>
                </View>
              </View>

              {draft.isOutOfTown ? (
                <View className='lodging-editor__content'>
                  <View className='field'>
                    <Text className='field__label'>是否需要我们安排酒店</Text>
                    <View className='preview-toggle__chips'>
                      <Button
                        className={`preview-toggle__chip ${draft.needsHotel ? 'preview-toggle__chip--active' : ''}`}
                        onClick={() => updateDraft({ needsHotel: true })}
                      >
                        需要
                      </Button>
                      <Button
                        className={`preview-toggle__chip ${!draft.needsHotel ? 'preview-toggle__chip--active' : ''}`}
                        onClick={() =>
                          updateDraft({
                            needsHotel: false,
                            hotelName: '',
                            roomType: '',
                            checkInDate: '',
                            nights: ''
                          })
                        }
                      >
                        不需要
                      </Button>
                    </View>
                  </View>

                  <View className='field-grid'>
                    <View className='field'>
                      <Text className='field__label'>酒店名称</Text>
                      <Input className='field__input' value={draft.hotelName} placeholder='例如：杭州君悦酒店' onInput={(e) => updateDraft({ hotelName: readValue(e) })} />
                    </View>
                    <View className='field'>
                      <Text className='field__label'>房型</Text>
                      <Input className='field__input' value={draft.roomType} placeholder='例如：大床房 / 双床房' onInput={(e) => updateDraft({ roomType: readValue(e) })} />
                    </View>
                  </View>

                  <View className='field'>
                    <Text className='field__label'>入住时间</Text>
                    <Input className='field__input' value={draft.checkInDate} placeholder='例如：6 月 8 日下午 3 点后' onInput={(e) => updateDraft({ checkInDate: readValue(e) })} />
                  </View>

                  <View className='field'>
                    <Text className='field__label'>入住晚数</Text>
                    <Input className='field__input' value={draft.nights} placeholder='例如：1 晚 / 2 晚' onInput={(e) => updateDraft({ nights: readValue(e) })} />
                  </View>

                  <View className='field'>
                    <Text className='field__label'>备注</Text>
                    <Textarea
                      className='lodging-note'
                      value={draft.note}
                      placeholder='例如：与父母同住、晚上才到、需要加婴儿床'
                      onInput={(e) => updateDraft({ note: readValue(e) })}
                    />
                  </View>
                </View>
              ) : (
                <View className='empty-state empty-state--inline'>
                  <Text className='empty-state__title'>当前标记为本地宾客</Text>
                  <Text className='empty-state__copy'>如果他是外地宾客，切换到“外地”后就可以继续补充酒店信息。</Text>
                </View>
              )}

              <Button className='primary-compact lodging-save' onClick={saveLodging}>
                保存住宿信息
              </Button>
            </View>
          ) : (
            <View className='empty-state empty-state--inline'>
              <Text className='empty-state__title'>还没有选中宾客</Text>
              <Text className='empty-state__copy'>先从左侧清单里点一个人，再开始记录住宿安排。</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
