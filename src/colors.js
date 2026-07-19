// Preset colors for scooter color selection
export const PRESET_COLORS = [
  { name: 'Чёрный', nameZh: '黑色', hex: '#1a1a1a' },
  { name: 'Белый', nameZh: '白色', hex: '#f0f0f0' },
  { name: 'Красный', nameZh: '红色', hex: '#c23a2b' },
  { name: 'Синий', nameZh: '蓝色', hex: '#1a3a6b' },
  { name: 'Серый', nameZh: '灰色', hex: '#8a8a8a' },
  { name: 'Зелёный', nameZh: '绿色', hex: '#2d6a2d' },
  { name: 'Жёлтый', nameZh: '黄色', hex: '#d4a017' },
  { name: 'Оранжевый', nameZh: '橙色', hex: '#d45a1a' },
  { name: 'Серебристый', nameZh: '银色', hex: '#c0c0c0' },
  { name: 'Тёмно-синий', nameZh: '深蓝', hex: '#0d1b3e' },
  { name: 'Хаки', nameZh: '卡其色', hex: '#6b6b3d' },
  { name: 'Бордовый', nameZh: '酒红色', hex: '#6b1a2a' },
  { name: 'Хамелеон', nameZh: '变色龙', hex: 'chameleon' },
]

export function getColorByName(name) {
  return PRESET_COLORS.find(c => c.name === name || c.nameZh === name)
}

export function getColorHex(name) {
  return getColorByName(name)?.hex || '#333'
}
