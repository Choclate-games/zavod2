/**
 * Каталог гаража: тюбинги, пилоты и эффекты следа. Цены в кубках.
 * Данные только здесь: экраны читают каталог, а не придумывают товары.
 */
export interface CatalogItem {
  readonly id: string
  readonly label: string
  readonly colorHex: number
  readonly price: number
}

export const TUBES: ReadonlyArray<CatalogItem> = [
  { id: 'classic', label: 'Классик', colorHex: 0xff6b35, price: 0 },
  { id: 'lime', label: 'Лайм', colorHex: 0x9ef01a, price: 40 },
  { id: 'violet', label: 'Фиалка', colorHex: 0x7b2ff7, price: 60 },
  { id: 'flamingo', label: 'Фламинго', colorHex: 0xf72585, price: 80 },
  { id: 'aqua', label: 'Аква', colorHex: 0x00f5d4, price: 100 },
  { id: 'sun', label: 'Солнце', colorHex: 0xffd166, price: 120 },
  { id: 'glacier', label: 'Глетчер', colorHex: 0x4cc9f0, price: 160 },
  { id: 'garnet', label: 'Гранат', colorHex: 0xc9184a, price: 200 },
  { id: 'moss', label: 'Мох', colorHex: 0x80b918, price: 240 },
  { id: 'storm', label: 'Шторм', colorHex: 0x3a86ff, price: 300 },
  { id: 'lava', label: 'Лава', colorHex: 0xff4800, price: 400 },
  { id: 'dragon', label: 'Полярный Дракон', colorHex: 0xb5179e, price: 600 },
]

export const PILOTS: ReadonlyArray<CatalogItem> = [
  { id: 'rookie', label: 'Новичок', colorHex: 0xf1faee, price: 0 },
  { id: 'walrus', label: 'Морж', colorHex: 0xa8dadc, price: 50 },
  { id: 'penguin', label: 'Пингвин', colorHex: 0xedf2f4, price: 70 },
  { id: 'seal', label: 'Тюлень', colorHex: 0xbde0fe, price: 90 },
  { id: 'eskimo', label: 'Полярник', colorHex: 0xffe8d6, price: 130 },
  { id: 'captain', label: 'Капитан', colorHex: 0xffc98a, price: 180 },
  { id: 'yeti', label: 'Йети', colorHex: 0xe9edc9, price: 260 },
  { id: 'nord', label: 'Норд', colorHex: 0xcdb4db, price: 340 },
]

export const TRAILS: ReadonlyArray<CatalogItem> = [
  { id: 'snow', label: 'Снежный', colorHex: 0xffffff, price: 0 },
  { id: 'mint', label: 'Мята', colorHex: 0x00f5d4, price: 45 },
  { id: 'amber', label: 'Янтарь', colorHex: 0xffd166, price: 65 },
  { id: 'coral', label: 'Коралл', colorHex: 0xe63946, price: 95 },
  { id: 'ultra', label: 'Ультрамарин', colorHex: 0x3a86ff, price: 140 },
  { id: 'aurora', label: 'Сияние', colorHex: 0x9ef01a, price: 210 },
]
