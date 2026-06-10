import { Button, Input, Text, View } from '@tarojs/components'
import type { PlanVariantSummary } from '../types/seating'
import './plan-manager.scss'

function readValue(event: { detail?: { value?: string } }) {
  return event.detail?.value ?? ''
}

interface PlanManagerProps {
  activePlanId: string
  activePlanName: string
  planNameDraft: string
  planOptions: PlanVariantSummary[]
  lastBackupLabel: string
  backupNeedsAttention: boolean
  onDraftChange: (value: string) => void
  onRenameCurrent: () => void
  onSaveAsNew: () => void
  onSwitchPlan: (planId: string) => void
  onDeletePlan: (planId: string) => void
  onExportBackup: () => void
  onImportBackup: () => void
}

export function PlanManager(props: PlanManagerProps) {
  const {
    activePlanId,
    activePlanName,
    planNameDraft,
    planOptions,
    lastBackupLabel,
    backupNeedsAttention,
    onDraftChange,
    onRenameCurrent,
    onSaveAsNew,
    onSwitchPlan,
    onDeletePlan,
    onExportBackup,
    onImportBackup
  } = props

  return (
    <View className='plan-manager'>
      <View className='plan-manager__head'>
        <View>
          <Text className='plan-manager__title'>方案管理</Text>
          <Text className='plan-manager__hint'>当前方案：{activePlanName}</Text>
        </View>
        <Text className='plan-manager__count'>{planOptions.length} 套方案</Text>
      </View>

      <Text className='plan-manager__desc'>
        用来保存不同版本的名单、住宿和排座结果。比如先保留“正式名单版”，再复制一套“含候补版”做对比。
      </Text>

      <View className='plan-manager__composer'>
        <Text className='plan-manager__field-label'>方案名称</Text>
        <Input
          className='plan-manager__input'
          value={planNameDraft}
          placeholder='例如：第二套方案 / 含候补版'
          onInput={(event) => onDraftChange(readValue(event))}
        />
        <View className='plan-manager__actions'>
          <Button className='plan-manager__btn plan-manager__btn--secondary' onClick={onRenameCurrent}>
            保存当前名称
          </Button>
          <Button className='plan-manager__btn plan-manager__btn--primary' onClick={onSaveAsNew}>
            复制当前为新方案
          </Button>
        </View>
      </View>

      <View className='plan-manager__backup'>
        <View>
          <Text className='plan-manager__backup-title'>数据备份</Text>
          <Text className='plan-manager__backup-copy'>导出 JSON 可在换浏览器或误操作后恢复全部方案。</Text>
          <Text className={`plan-manager__backup-state ${backupNeedsAttention ? 'plan-manager__backup-state--warning' : ''}`}>
            {backupNeedsAttention ? '当前数据有更新，建议导出备份' : '当前数据已备份'}
            {lastBackupLabel ? ` · 上次备份：${lastBackupLabel}` : ' · 还没有导出过备份'}
          </Text>
        </View>
        <View className='plan-manager__backup-actions'>
          <Button className='plan-manager__btn plan-manager__btn--secondary' onClick={onImportBackup}>
            导入恢复
          </Button>
          <Button className='plan-manager__btn plan-manager__btn--primary' onClick={onExportBackup}>
            导出备份
          </Button>
        </View>
      </View>

      <View className='plan-manager__list'>
        {planOptions.map((variant) => (
          <View key={variant.id} className={`plan-manager__item ${variant.isActive ? 'plan-manager__item--active' : ''}`}>
            <View className='plan-manager__item-main'>
              <Text className='plan-manager__item-name'>{variant.name}</Text>
              <Text className='plan-manager__item-meta'>{variant.isActive ? '当前使用中' : '可切换'}</Text>
            </View>
            <View className='plan-manager__item-actions'>
              {variant.id === activePlanId ? (
                <Text className='plan-manager__status'>正在使用</Text>
              ) : (
                <View
                  className='plan-manager__action plan-manager__action--switch'
                  onClick={() => onSwitchPlan(variant.id)}
                >
                  <Text>切换</Text>
                </View>
              )}
              {planOptions.length > 1 ? (
                <View
                  className='plan-manager__action plan-manager__action--danger'
                  onClick={() => onDeletePlan(variant.id)}
                >
                  <Text>删除</Text>
                </View>
              ) : (
                <Text className='plan-manager__status plan-manager__status--muted'>至少保留 1 套</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
