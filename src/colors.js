export const PRESET_COLORS = [
  { name: 'Чёрный', nameZh: '黑色', hex: '#1a1a1a' },
  { name: 'Чёрный матовый', nameZh: '哑光黑色', hex: '#2a2a2a' },
  { name: 'Белый', nameZh: '白色', hex: '#f0f0f0' },
  { name: 'Белый матовый', nameZh: '哑光白色', hex: '#e0e0e0' },
  { name: 'Серый', nameZh: '灰色', hex: '#8a8a8a' },
  { name: 'Серый матовый', nameZh: '哑光灰色', hex: '#6a6a6a' },
  { name: 'Красный', nameZh: '红色', hex: '#c23a2b' },
  { name: 'Красный матовый', nameZh: '哑光红色', hex: '#8a2a1a' },
  { name: 'Синий', nameZh: '蓝色', hex: '#1a3a6b' },
  { name: 'Синий матовый', nameZh: '哑光蓝色', hex: '#1a2a4b' },
  { name: 'Зелёный', nameZh: '绿色', hex: '#2d8a2d' },
  { name: 'Зелёный матовый', nameZh: '哑光绿色', hex: '#1a6a1a' },
  { name: 'Хамелеон', nameZh: '变色龙', hex: 'chameleon' },
]

export function getColorByName(name) {
  return PRESET_COLORS.find(c => c.name === name || c.nameZh === name)
}

export function getColorHex(name) {
  return getColorByName(name)?.hex || '#333'
}
