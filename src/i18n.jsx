import { createContext, useContext, useState } from 'react'
import { PRESET_COLORS, getColorByName } from './colors'

const translations = {
  ru: {
    // Header
    logo: 'OUDA',
    cart: 'Корзина',
    // Hero
    heroTitle: 'OUDA Скутеры',
    heroDesc: 'Стильные и надёжные скутеры для города. Качество, скорость, доступная цена.',
    heroBtn: 'Смотреть каталог',
    // Catalog
    catalogTitle: 'Каталог',
    addToCart: 'В корзину',
    inCart: '✓ В корзине',
    // Cart
    cartTitle: 'Корзина',
    cartEmpty: 'Корзина пуста',
    total: 'Итого:',
    name: 'Имя *',
    city: 'Город',
    phone: 'Номер телефона *',
    cash: 'Наличные',
    usdt: 'USDT',
    submit: 'Оформить заказ',
    sending: 'Отправка...',
    // Toast
    successMsg: 'Спасибо! Заказ отправлен, мы свяжемся с вами 🏍️',
    // Product specs
    color: 'Цвет',
    power: 'Мощность',
    tires: 'Резина',
    rub: '₽',
    // Admin
    loginTitle: 'Вход в админку',
    loginBtn: 'Войти',
    loginError: 'Неверный пароль',
    adminTitle: 'Админка OUDA',
    logout: 'Выйти',
    orders: 'Заказы',
    products: 'Товары',
    stock: 'Поступления',
    addProduct: 'Добавить товар',
    noOrders: 'Пока нет заказов',
    noProducts: 'Нет товаров. Добавьте первый!',
    noStock: 'Нет поступлений',
    accept: 'Принять',
    done: 'Выполнен',
    delete: 'Удалить',
    addStock: 'Добавить поступление',
    selectProduct: 'Выберите товар',
    qty: 'Количество',
    date: 'Дата',
    nameLabel: 'Название',
    priceLabel: 'Цена',
    descLabel: 'Описание',
    photoLink: 'Ссылка на фото',
    addColor: 'Добавить цвет',
    payment: 'Оплата',
    status: 'Статус',
    new: 'Новый',
    accepted: 'Принят',
    completed: 'Выполнен',
  },
  zh: {
    logo: 'OUDA',
    cart: '购物车',
    heroTitle: 'OUDA 摩托车',
    heroDesc: '时尚可靠的城市摩托车。品质、速度、实惠的价格。',
    heroBtn: '查看目录',
    catalogTitle: '产品目录',
    addToCart: '加入购物车',
    inCart: '✓ 已在购物车',
    cartTitle: '购物车',
    cartEmpty: '购物车是空的',
    total: '总计：',
    name: '姓名 *',
    city: '城市',
    phone: '电话号码 *',
    cash: '现金',
    usdt: 'USDT',
    submit: '下订单',
    sending: '发送中...',
    successMsg: '谢谢！订单已发送，我们会与您联系 🏍️',
    color: '颜色',
    power: '功率',
    tires: '轮胎',
    rub: '₽',
    loginTitle: '管理员登录',
    loginBtn: '登录',
    loginError: '密码错误',
    adminTitle: 'OUDA 管理面板',
    logout: '退出',
    orders: '订单',
    products: '产品',
    stock: '入库',
    addProduct: '添加产品',
    noOrders: '暂无订单',
    noProducts: '暂无产品。添加第一个！',
    noStock: '暂无入库记录',
    accept: '接受',
    done: '完成',
    delete: '删除',
    addStock: '添加入库',
    selectProduct: '选择产品',
    qty: '数量',
    date: '日期',
    nameLabel: '名称',
    priceLabel: '价格',
    descLabel: '描述',
    photoLink: '图片链接',
    addColor: '添加颜色',
    payment: '支付方式',
    status: '状态',
    new: '新订单',
    accepted: '已接受',
    completed: '已完成',
  },
}

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState('ru')

  const t = (key) => translations[lang]?.[key] || translations.ru[key] || key
  const translateColor = (colorName) => {
    const preset = getColorByName(colorName)
    if (!preset) return colorName
    return lang === 'zh' ? (preset.nameZh || colorName) : preset.name
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t, translateColor }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
