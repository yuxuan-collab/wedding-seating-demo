import { Button, Text, View } from '@tarojs/components'
import { navigatePage } from '../utils/navigation'
import './top-nav.scss'

interface TopNavProps {
  active: 'home' | 'roster' | 'lodging' | 'seating'
}

const navItems: Array<{ key: TopNavProps['active']; label: string; url: string }> = [
  { key: 'home', label: '主页', url: '/pages/home/index' },
  { key: 'roster', label: '名单', url: '/pages/roster/index' },
  { key: 'lodging', label: '住宿', url: '/pages/lodging/index' },
  { key: 'seating', label: '排座', url: '/pages/seating/index' }
]

export function TopNav(props: TopNavProps) {
  return (
    <View className='topnav'>
      <View className='topnav__brand'>
        <Text className='topnav__logo'>🍫</Text>
        <View>
          <Text className='topnav__title'>朱古力 Wedding Planner</Text>
          <Text className='topnav__subtitle'>名单、住宿与排座工作台</Text>
        </View>
      </View>

      <View className='topnav__tabs'>
        {navItems.map((item) => (
          <Button
            key={item.key}
            className={`topnav__tab ${props.active === item.key ? 'topnav__tab--active' : ''}`}
            onClick={() => {
              if (props.active !== item.key) {
                navigatePage(item.url)
              }
            }}
          >
            {item.label}
          </Button>
        ))}
      </View>
    </View>
  )
}
