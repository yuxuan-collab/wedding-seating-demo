import { useEffect, useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PlanManager } from '../../components/plan-manager'
import { TopNav } from '../../components/top-nav'
import { navigatePage } from '../../utils/navigation'
import {
  createWorkspaceBackup,
  createWorkspaceBackupFileName,
  deletePlanVariant,
  getWorkspaceBackupStatus,
  loadPlannerState,
  markWorkspaceBackedUp,
  previewWorkspaceBackup,
  renameActivePlan,
  restoreWorkspaceFromBackup,
  savePlanAsVariant,
  switchActivePlan
} from '../../utils/plan'
import './index.scss'

function formatBackupTime(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = (nextValue: number) => String(nextValue).padStart(2, '0')

  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function HomePage() {
  const [plannerState, setPlannerState] = useState(() => loadPlannerState())
  const [backupStatus, setBackupStatus] = useState(() => getWorkspaceBackupStatus())
  const [planNameDraft, setPlanNameDraft] = useState(plannerState.activePlanName)
  const { plan, activePlanId, activePlanName, planOptions } = plannerState
  const confirmedGuests = plan.guests.filter((guest) => guest.status !== 'waitlist')
  const waitlistGuests = plan.guests.filter((guest) => guest.status === 'waitlist')
  const outOfTownGuests = plan.guests.filter((guest) => guest.lodging?.isOutOfTown)
  const seatedCount = Object.values(plan.seating.tables).reduce((sum, guestIds) => sum + guestIds.length, 0)
  const shouldShowRecoveryCta = plan.guests.length === 0

  useEffect(() => {
    const nextState = loadPlannerState()
    setPlannerState(nextState)
    setPlanNameDraft(nextState.activePlanName)
    setBackupStatus(getWorkspaceBackupStatus())
  }, [])

  const syncPlannerState = (nextState = loadPlannerState()) => {
    setPlannerState(nextState)
    setPlanNameDraft(nextState.activePlanName)
    setBackupStatus(getWorkspaceBackupStatus())
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

  const handleExportBackup = () => {
    const backup = createWorkspaceBackup()
    const backupText = JSON.stringify(backup, null, 2)
    const fileName = createWorkspaceBackupFileName()

    if (typeof document === 'undefined') {
      Taro.setClipboardData({ data: backupText })
      setBackupStatus(markWorkspaceBackedUp(backup.exportedAt))
      Taro.showToast({ title: '已复制备份内容', icon: 'success' })
      return
    }

    const blob = new Blob([backupText], { type: 'application/json;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = fileName
    link.click()
    window.URL.revokeObjectURL(url)
    setBackupStatus(markWorkspaceBackedUp(backup.exportedAt))
    Taro.showToast({ title: '已导出备份', icon: 'success' })
  }

  const restoreBackupText = async (backupText: string) => {
    try {
      const payload = JSON.parse(backupText)
      const preview = previewWorkspaceBackup(payload)
      const result = await Taro.showModal({
        title: '确认导入备份？',
        content: [
          `包含 ${preview.planCount} 套方案`,
          `共 ${preview.totalGuests} 位宾客 / ${preview.totalTables} 张桌`,
          `同桌规则 ${preview.totalRules} 组 / 外地宾客 ${preview.lodgingGuests} 位`,
          `导入后会覆盖当前数据。`
        ].join('\n'),
        confirmText: '导入恢复',
        cancelText: '取消'
      })

      if (!result.confirm) {
        return
      }

      syncPlannerState(restoreWorkspaceFromBackup(payload))
      setBackupStatus(getWorkspaceBackupStatus())
      Taro.showToast({ title: '已恢复备份', icon: 'success' })
    } catch {
      Taro.showToast({ title: '备份文件无法识别', icon: 'none' })
    }
  }

  const handleImportBackup = () => {
    if (typeof document === 'undefined') {
      Taro.showToast({ title: '当前环境暂不支持文件导入', icon: 'none' })
      return
    }

    const input = document.createElement('input')

    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]

      if (!file) {
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        restoreBackupText(String(reader.result ?? ''))
      }
      reader.onerror = () => {
        Taro.showToast({ title: '读取备份失败', icon: 'none' })
      }
      reader.readAsText(file)
    }

    input.click()
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
        {shouldShowRecoveryCta && (
          <View className='home-recovery'>
            <View>
              <Text className='home-recovery__title'>当前没有宾客数据</Text>
              <Text className='home-recovery__copy'>如果你之前导出过备份，可以直接导入 JSON 恢复名单、住宿和排座。</Text>
            </View>
            <Button className='home-recovery__button' onClick={handleImportBackup}>
              导入备份恢复
            </Button>
          </View>
        )}
        <PlanManager
          activePlanId={activePlanId}
          activePlanName={activePlanName}
          planNameDraft={planNameDraft}
          planOptions={planOptions}
          lastBackupLabel={formatBackupTime(backupStatus.lastExportedAt)}
          backupNeedsAttention={backupStatus.needsBackup}
          onDraftChange={setPlanNameDraft}
          onRenameCurrent={handleRenameCurrent}
          onSaveAsNew={handleSaveAsNew}
          onSwitchPlan={handleSwitchPlan}
          onDeletePlan={handleDeletePlan}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
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
