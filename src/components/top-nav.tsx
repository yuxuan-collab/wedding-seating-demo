import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './top-nav.scss'

interface TopNavProps {
  active: 'home' | 'roster' | 'seating'
}

const navItems: Array<{ key: TopNavProps['active']; label: string; url: string }> = [
  { key: 'home', label: '主页', url: '/pages/home/index' },
  { key: 'roster', label: '名单', url: '/pages/roster/index' },
  { key: 'seating', label: '排座', url: '/pages/seating/index' }
]

export function TopNav(props: TopNavProps) {
  return (
    <View className='topnav'>
      <View className='topnav__brand'>
        <Text className='topnav__logo'>Y</Text>
        <View>
          <Text className='topnav__title'>YuXuan Wedding Planner</Text>
          <Text className='topnav__subtitle'>Guest roster, waitlist and seating board</Text>
        </View>
      </View>

      <View className='topnav__tabs'>
        {navItems.map((item) => (
          <Button
            key={item.key}
            className={`topnav__tab ${props.active === item.key ? 'topnav__tab--active' : ''}`}
            onClick={() => {
              if (props.active !== item.key) {
                Taro.redirectTo({ url: item.url })
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
