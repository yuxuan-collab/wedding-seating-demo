import { useEffect, useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PlanManager } from '../../components/plan-manager'
import { TopNav } from '../../components/top-nav'
import { navigatePage } from '../../utils/navigation'
import { deletePlanVariant, loadPlannerState, renameActivePlan, savePlanAsVariant, switchActivePlan } from '../../utils/plan'
import './index.scss'

export default function HomePage() {
  const [plannerState, setPlannerState] = useState(() => loadPlannerState())
  const [planNameDraft, setPlanNameDraft] = useState(plannerState.activePlanName)
  const { plan, activePlanId, activePlanName, planOptions } = plannerState
  const confirmedGuests = plan.guests.filter((guest) => guest.status !== 'waitlist')
  const waitlistGuests = plan.guests.filter((guest) => guest.status === 'waitlist')
  const outOfTownGuests = plan.guests.filter((guest) => guest.lodging?.isOutOfTown)
  const seatedCount = Object.values(plan.seating.tables).reduce((sum, guestIds) => sum + guestIds.length, 0)

  useEffect(() => {
    const nextState = loadPlannerState()
    setPlannerState(nextState)
    setPlanNameDraft(nextState.activePlanName)
  }, [])

  const syncPlannerState = (nextState = loadPlannerState()) => {
    setPlannerState(nextState)
    setPlanNameDraft(nextState.activePlanName)
  }

  const handleRenameCurrent = () => {
    if (!planNameDraft.trim()) {
      Taro.showToast({ title: '先输入方案名称', icon: 'none' })
      return
    }

    syncPlannerState(renameActivePlan(planNameDraft))
    Taro.showToast({ title: '已重命名方案', icon: 'success' })
  }

  const handleSaveAsNew = () => {
    if (!planNameDraft.trim()) {
      Taro.showToast({ title: '先输入方案名称', icon: 'none' })
      return
    }

    syncPlannerState(savePlanAsVariant(planNameDraft, plan))
    Taro.showToast({ title: '已保存为新方案', icon: 'success' })
  }

  const handleSwitchPlan = (planId: string) => {
    syncPlannerState(switchActivePlan(planId))
  }

  const handleDeletePlan = (planId: string) => {
    if (planOptions.length <= 1) {
      Taro.showToast({ title: '至少保留 1 套方案', icon: 'none' })
      return
    }

    syncPlannerState(deletePlanVariant(planId))
    Taro.showToast({ title: '已删除方案', icon: 'success' })
  }

  return (
    <View className='home-page'>
      <TopNav active='home' />

      <View className='home-shell'>
        <View className='home-hero'>
          <Text className='home-kicker'>Wedding seating workspace</Text>
          <Text className='home-title'>婚宴排座助手</Text>
          <Text className='home-copy'>
            先整理宾客名单和同桌要求，再进入排座看板生成、移动和交换座位。
          </Text>
          <View className='home-actions'>
            <Button className='home-primary' onClick={() => navigatePage('/pages/roster/index')}>
              管理名单
            </Button>
            <Button className='home-secondary' onClick={() => navigatePage('/pages/seating/index')}>
              查看排座
            </Button>
          </View>
        </View>

        <View className='home-metrics'>
          <View className='metric-card'>
            <Text className='metric-value'>{confirmedGuests.length}</Text>
            <Text className='metric-label'>正式宾客</Text>
          </View>
          <View className='metric-card'>
            <Text className='metric-value'>{waitlistGuests.length}</Text>
            <Text className='metric-label'>候补宾客</Text>
          </View>
          <View className='metric-card'>
            <Text className='metric-value'>{plan.tables.length}</Text>
            <Text className='metric-label'>桌数</Text>
          </View>
          <View className='metric-card'>
            <Text className='metric-value'>{seatedCount}</Text>
            <Text className='metric-label'>已排座</Text>
          </View>
          <View className='metric-card'>
            <Text className='metric-value'>{outOfTownGuests.length}</Text>
            <Text className='metric-label'>外地宾客</Text>
          </View>
        </View>
      </View>

      <View className='home-panels'>
        <PlanManager
          activePlanId={activePlanId}
          activePlanName={activePlanName}
          planNameDraft={planNameDraft}
          planOptions={planOptions}
          onDraftChange={setPlanNameDraft}
          onRenameCurrent={handleRenameCurrent}
          onSaveAsNew={handleSaveAsNew}
          onSwitchPlan={handleSwitchPlan}
          onDeletePlan={handleDeletePlan}
        />
        <View className='home-panel'>
          <Text className='panel-label'>名单页</Text>
          <Text className='panel-title'>像表格一样管理宾客</Text>
          <Text className='panel-copy'>批量录入、搜索、编辑、候补池和同桌要求集中在一个工作台里。</Text>
        </View>
        <View className='home-panel'>
          <Text className='panel-label'>排座页</Text>
          <Text className='panel-title'>用看板调整桌位</Text>
          <Text className='panel-copy'>生成初版座位后，点击宾客即可移动到目标桌或与其他宾客交换。</Text>
        </View>
        <View className='home-panel'>
          <Text className='panel-label'>住宿页</Text>
          <Text className='panel-title'>跟踪外地宾客住宿</Text>
          <Text className='panel-copy'>记录哪些宾客是外地来宾、是否需要安排酒店，以及预订和入住进度。</Text>
        </View>
      </View>
    </View>
  )
}
