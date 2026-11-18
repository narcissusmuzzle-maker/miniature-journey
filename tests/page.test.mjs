// Прогон настоящего page/index.js на заглушках API часов: строка баланса на главном экране, вход в магазин / выход из него долгим нажатием на неё,
// покупки, отказы, нет связи, жёлтый таймер, вызов очереди из ячейки долгим нажатием на кнопки, нажатия по зонам очереди.
// Запуск: node --import ./tests/register.mjs tests/page.test.mjs   (из папки приложения)
import assert from 'node:assert'

let n = 0
async function t(name, f) { await f(); n++; console.log('ok  ' + name) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = () => globalThis.__W.filter((w) => w.alive)
const shown = () => alive().filter((w) => w.visible)
const buttons = () => shown().filter((w) => w.type === 'BUTTON')
const texts = () => shown().filter((w) => w.type === 'TEXT').map((w) => w.props.text)
const imgs = () => shown().filter((w) => w.type === 'IMG').map((w) => w.props.src)
const press = (w) => w.props.click_func()
const hold = (w) => w.props.longpress_func()
const byImg = (src) => buttons().find((w) => w.props.normal_src === src)
// строка баланса (чёрная кнопка на всю ширину, невысокая): на главном экране и в магазине — своя, видна всегда одна из них
const balBtn = () => buttons().find((w) => w.props.w === 432 && w.props.h < 200 && w.props.text === '')
// три зоны очереди (чёрные кнопки без картинки, не 120 и не 432 шириной), слева направо
const zoneBtn = (c) => buttons().filter((w) => w.props.normal_color === 0 && w.props.text === '' && w.props.w < 432 && w.props.w !== 120 && !w.props.normal_src).sort((a, b) => a.props.x - b.props.x)[c]
// значки очереди на экране: номера эмодзи в порядке чтения (сверху вниз, слева направо)
const queueNow = () => buttons().filter((w) => /^[qm]\d\.png$/.test(String(w.props.normal_src))).sort((a, b) => a.props.y - b.props.y || a.props.x - b.props.x).map((w) => +String(w.props.normal_src)[1])
const runBtn = () => buttons().find((w) => w.props.normal_color === 0x050505 && w.props.text !== '')
const cellOf = (i) => globalThis.__W.filter((w) => w.type === 'BUTTON' && w.props.w === 120 && w.props.normal_color === 0 && w.props.press_color === 0x1c1c1c && w.props.text === '')[i]

// телефон 5.18: баланс b, цены p, получено событий
const phone = { online: true, f: true, b: 50, p: { '🍿': 12, '🌴': 30, '🍚': 5, '🥤': 7, '👁️': 0 }, got: [], buys: {} }
const fobj = () => ({ b: phone.b, p: phone.p })
globalThis.__REQ = (p) => {
  phone.got.push(p)
  if (!phone.online) return Promise.reject(new Error('offline'))
  if (p.t === 'sync') return Promise.resolve({ ok: true, reply: phone.f ? { t: 'sync', f: fobj(), g: { n: 0, h: 0 } } : { t: 'sync', g: { n: 3, h: 1 } } })
  if (p.t === 'buy') {
    if (!phone.buys[p.id]) { phone.buys[p.id] = true; phone.b -= p.c }   // повтор того же id ничего не меняет
    return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, f: fobj(), g: { n: 0, h: 0 } } })
  }
  return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, f: fobj(), g: { n: 0, h: 0 } } })
}
globalThis.Page = (o) => { globalThis.__PAGE = o }
await import('../page/index.js')
const page = globalThis.__PAGE
const buysSent = () => phone.got.filter((p) => p.t === 'buy')

await t('запуск: главный экран, магазин и жёлтый таймер построены, подарков нет', async () => {
  page.onInit()
  page.build()
  await sleep(20)
  assert.equal(globalThis.__STATUSBAR, false)
  assert.equal(byImg('i1.png') !== undefined, true)            // 💀 на месте
  assert.equal(alive().some((w) => String(w.props.normal_src || w.props.src) === 'g.png' || String(w.props.normal_src || w.props.src) === 'h.png'), false)
  assert.equal(alive().filter((w) => w.type === 'BUTTON' && w.props.normal_color === 0xffd21f).length, 2)   // жёлтый экран: цифры и полоса
})

await t('главный экран: баланс 🌸 виден сразу (значок и цифры), долгое нажатие на кнопки при пустых ячейках и на 💀 ничего не делает, магазин открывается долгим нажатием на строку баланса', async () => {
  assert.equal(imgs().includes('fl.png'), true)
  assert.equal(texts().includes('50'), true)
  for (let i = 0; i < 6; i++) hold(byImg('i' + i + '.png'))      // ячейки пусты — ничего; 💀 больше не магазин
  await sleep(10)
  assert.equal(imgs().includes('sh0.png'), false)
  assert.equal(buttons().some((w) => w.props.normal_color === 0x3bf76d), false)
  assert.equal(buttons().some((w) => w.props.normal_color === 0xff4517), false)
  assert.equal(queueNow().length, 0)
  press(balBtn())                                                // обычное нажатие на строку баланса при пустой очереди: ничего
  await sleep(10)
  assert.equal(runBtn(), undefined)
  hold(balBtn())
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), true)
  for (let i = 0; i < 9; i++) assert.equal(imgs().includes('sh' + i + '.png'), true)
  assert.equal(imgs().includes('fl.png'), true)
})

await t('при открытии: баланс и цены берутся у телефона (sync), показаны 🌸50 и цены; у ⏳ — 2, у товара без цены подписи нет', async () => {
  assert.equal(phone.got.filter((p) => p.t === 'sync').length >= 2, true)   // при старте страницы и при открытии магазина
  const tx = texts()
  assert.equal(tx.includes('50'), true)
  assert.equal(tx.includes('2'), true)       // ⏳
  assert.equal(tx.includes('12'), true)      // 🍿
  assert.equal(tx.includes('30'), true)      // 🌴
  assert.equal(tx.includes('5'), true)       // 🍚
  assert.equal(tx.includes('7'), true)       // 🥤
  assert.equal(tx.includes('0'), true)       // 👁️ с ценой 0
  // 🧁 🫦 💬 — без цены: подписей цены у них нет (всего пять с числом + ⏳ ... проверяем по числу видимых значков цены)
  const priceFl = alive().filter((w) => w.type === 'IMG' && w.props.src === 'fs.png' && w.visible).length
  assert.equal(priceFl, 6)                   // ⏳ 🍿 🌴 🍚 🥤 👁️
})

await t('обычное нажатие на товар ничего не покупает; долгое — покупка: событие buy, баланс 50 -> 45 после ack', async () => {
  press(cellOf(3))
  await sleep(10)
  assert.equal(buysSent().length, 0)
  hold(cellOf(3))                            // 🍚 за 5
  await sleep(30)
  assert.equal(buysSent().length, 1)
  const b = buysSent()[0]
  assert.equal(b.t, 'buy')
  assert.equal(b.e, '🍚')
  assert.equal(b.c, 5)
  assert.equal(typeof b.ts, 'number')
  assert.equal(typeof b.id, 'string')
  assert.equal(phone.b, 45)
  assert.equal(texts().includes('45'), true)
})

await t('товары без цены (💬 🧁) не продаются: событий нет, баланс не меняется', async () => {
  hold(cellOf(8))                            // 💬: цены нет
  hold(cellOf(5))                            // 🧁: цены нет
  await sleep(20)
  assert.equal(buysSent().length, 1)
  assert.equal(phone.b, 45)
})

await t('👁️ с ценой 0 покупается; повтор события с тем же id баланс не меняет', async () => {
  hold(cellOf(7))
  await sleep(30)
  assert.equal(buysSent().length, 2)
  assert.equal(buysSent()[1].e, '👁️')
  assert.equal(buysSent()[1].e.length, 3)    // с селектором U+FE0F
  assert.equal(buysSent()[1].c, 0)
  assert.equal(phone.b, 45)
})

await t('🍿: списание 12 и СРАЗУ жёлтый таймер на 40 минут; на экране 40:00', async () => {
  hold(cellOf(1))
  await sleep(30)
  const b = buysSent()[2]
  assert.equal(b.e, '🍿')
  assert.equal(b.c, 12)
  assert.equal(phone.b, 33)
  assert.equal(shown().some((w) => w.type === 'BUTTON' && w.props.normal_color === 0xffd21f), true)
  assert.equal(buttons().some((w) => w.props.text === '40:00' || w.props.text === '39:59'), true)
  assert.equal(imgs().includes('sh0.png'), false)            // магазин закрылся: на экране таймер
})

await t('долгое нажатие на жёлтом — досрочный выход, телефону ничего не уходит, возврата нет; магазин снова открывается', async () => {
  const before = phone.got.length
  const y = buttons().find((w) => w.props.normal_color === 0xffd21f)
  hold(y)
  await sleep(30)
  assert.equal(shown().some((w) => w.props.normal_color === 0xffd21f), false)
  assert.equal(phone.got.slice(before).filter((p) => p.t !== 'sync').length, 0)
  assert.equal(phone.b, 33)
  hold(balBtn())
  await sleep(30)
  assert.equal(texts().includes('33'), true)
})

await t('⏳: красный таймер, цена 2 за 1-й запуск за час; второй ⏳ в тот же час стоит 4', async () => {
  hold(cellOf(0))
  await sleep(30)
  const b = buysSent()[3]
  assert.equal(b.e, '⏳')
  assert.equal(b.c, 2)
  assert.equal(phone.b, 31)
  assert.equal(buttons().some((w) => w.props.normal_color === 0xff4517 && w.props.text !== ''), true)
  const r = buttons().find((w) => w.props.normal_color === 0xff4517)
  hold(r)                                    // выход из красного
  await sleep(30)
  hold(balBtn())
  await sleep(30)
  assert.equal(texts().includes('4'), true)  // цена следующего ⏳ — 4
  hold(cellOf(0))
  await sleep(30)
  assert.equal(buysSent()[4].c, 4)           // купили второй
  assert.equal(phone.b, 27)
})

await t('не хватает баланса: 🌴 за 30 при 27 — отказ, ничего не списывается и таймер не запускается; ⏳ уже стоит 6', async () => {
  hold(buttons().find((w) => w.props.normal_color === 0xff4517))   // выход из красного (второй ⏳)
  await sleep(30)
  hold(balBtn())
  await sleep(30)
  hold(cellOf(2))                            // 🌴 за 30 при 27
  await sleep(20)
  assert.equal(buysSent().length, 5)
  assert.equal(phone.b, 27)
  assert.equal(shown().some((w) => w.props.normal_color === 0x3bf76d), false)
  assert.equal(texts().includes('6'), true)  // третий ⏳ за последний час
})

await t('старый LuvU613 (ответ без поля f): «нет связи», ничего не продаётся', async () => {
  phone.f = false
  const bg = buttons().find((w) => w.props.w === 432 && w.props.normal_color === 0 && w.props.text === '')
  hold(bg)
  await sleep(20)
  hold(balBtn())
  await sleep(40)
  assert.equal(texts().includes('нет связи'), true)
  const sent = buysSent().length
  hold(cellOf(3))
  await sleep(20)
  assert.equal(buysSent().length, sent)
})

await t('телефон недоступен при открытии: «нет связи», покупка отклоняется', async () => {
  const bg = buttons().find((w) => w.props.w === 432 && w.props.normal_color === 0 && w.props.text === '')
  hold(bg)
  await sleep(20)
  phone.f = true
  phone.online = false
  hold(balBtn())
  await sleep(40)
  assert.equal(texts().includes('нет связи'), true)
  const sent = buysSent().length
  hold(cellOf(3))
  await sleep(20)
  assert.equal(buysSent().length, sent)
  phone.online = true
})

await t('выход из магазина — долгое нажатие на строку баланса (то же место); на главном экране снова виден баланс', async () => {
  assert.equal(imgs().includes('sh0.png'), true)                 // после прошлого теста магазин открыт
  hold(balBtn())
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), false)
  assert.equal(imgs().includes('fl.png'), true)
  assert.equal(texts().includes('27'), true)                     // последний известный баланс телефона (связи при открытии не было — серый)
  hold(balBtn())                                                 // вход
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), true)
  const bg = buttons().find((w) => w.props.w === 432 && w.props.h > 400 && w.props.text === '' && w.props.normal_color === 0)
  hold(bg)                                                       // выход долгим нажатием на пустое место тоже работает
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), false)
})

await t('строка баланса: тот же размер и то же место, что в магазине; кнопки занятий ближе друг к другу, чем раньше (зазор 25 вместо 51)', async () => {
  const fl = alive().filter((w) => w.type === 'IMG' && w.props.src === 'fl.png')   // главный экран и магазин
  assert.equal(fl.length, 2)
  assert.equal(fl[0].props.w, fl[1].props.w)
  assert.equal(fl[0].props.h, fl[1].props.h)
  assert.equal(fl[0].props.w, 44)
  const nums = alive().filter((w) => w.type === 'TEXT' && w.props.text_size === 40)
  assert.equal(nums.length >= 2, true)                           // цифры баланса того же размера (40) там и там
  assert.equal(fl[0].props.y, fl[1].props.y)                     // стоят на одном месте экрана
  const y0 = byImg('i0.png').props.y
  assert.equal(fl[0].props.y - y0, 41 - 223)                     // баланс над первым рядом кнопок: 41 и 223 в координатах страницы
  assert.equal(byImg('i3.png').props.y - y0, 145)                // кнопка 120 + зазор 25
  assert.equal(byImg('i0.png').props.y, byImg('i2.png').props.y)
  assert.equal(byImg('i0.png').props.w, 120)                     // размер кнопок прежний
})

await sleep(2100)

await t('ввод очереди (долгое нажатие слева): кнопки вводят по одному эмодзи, долгое нажатие на кнопку сохраняет шесть в её ячейку, долгое справа сбрасывает введённое', async () => {
  hold(zoneBtn(0))
  await sleep(10)
  for (const k of [0, 1, 2, 3, 4, 5]) press(byImg('i' + k + '.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), [0, 1, 2, 3, 4, 5])               // введённое видно на экране
  hold(byImg('i0.png'))                                          // ячейка кнопки 🧬
  await sleep(10)
  hold(zoneBtn(2))                                               // сбросить введённое
  await sleep(10)
  assert.deepEqual(queueNow(), [])
  for (const k of [5, 4, 3, 2, 1]) press(byImg('i' + k + '.png'))
  press(zoneBtn(1))                                              // центр во время ввода — 🏠
  await sleep(10)
  assert.deepEqual(queueNow(), [5, 4, 3, 2, 1, 6])
  hold(byImg('i1.png'))                                          // ячейка кнопки 💀
  await sleep(10)
  hold(zoneBtn(0))                                               // выход: введённая очередь становится текущей
  await sleep(10)
  assert.deepEqual(queueNow(), [5, 4, 3, 2, 1, 6])
})

await t('долгое нажатие на кнопку вызывает очередь её ячейки: пусто / другая — замена шестью; те же шесть — удвоение (12); третий раз — ничего; другая ячейка — замена', async () => {
  const A = [0, 1, 2, 3, 4, 5]
  const B = [5, 4, 3, 2, 1, 6]
  hold(byImg('i1.png'))                                          // в очереди ровно B (ячейка 💀) — удваивается
  await sleep(10)
  assert.deepEqual(queueNow(), B.concat(B))
  hold(byImg('i1.png'))                                          // третье нажатие: ничего
  await sleep(10)
  assert.deepEqual(queueNow(), B.concat(B))
  hold(byImg('i0.png'))                                          // другая ячейка заменяет
  await sleep(10)
  assert.deepEqual(queueNow(), A)
  hold(byImg('i0.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i0.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i2.png'))                                          // пустая ячейка — очередь не меняется
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i1.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), B)
})

await t('отпускание пальца после долгого нажатия на кнопку не запускает её таймер', async () => {
  hold(byImg('i0.png'))
  press(byImg('i0.png'))                                         // «отпускание» сразу после долгого нажатия на той же кнопке
  await sleep(10)
  assert.equal(runBtn(), undefined)
})

await t('автостарт — обычное нажатие на строку баланса; во время автостарта долгое нажатие на кнопку очередь не меняет, остановка занятия выключает автостарт', async () => {
  await sleep(2100)
  hold(byImg('i1.png'))                                          // очередь = B, снова по ячейке 💀
  await sleep(10)
  const q = queueNow()
  assert.equal(q.length >= 6, true)
  press(balBtn())
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)                     // занятие из начала очереди пошло
  hold(byImg('i0.png'))                                          // ячейка 🧬 во время автостарта — очередь не заменяется
  await sleep(10)
  assert.deepEqual(queueNow(), q)
  press(runBtn())                                                // стоп занятия
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('очередь, правая зона: обычное нажатие — журнал теста (14 строк), долгое на журнале закрывает; долгое на зоне — удалить очередь', async () => {
  press(zoneBtn(2))
  await sleep(10)
  assert.equal(buttons().filter((w) => w.props.text_size === 18).length >= 14, true)
  assert.equal(zoneBtn(0), undefined)                            // главный экран спрятан
  hold(buttons().find((w) => w.props.text_size === 18))
  await sleep(10)
  assert.equal(zoneBtn(0) !== undefined, true)
  assert.equal(queueNow().length > 0, true)
  hold(zoneBtn(2))                                               // долгое справа — удалить очередь (после остановки занятия автостарт выключен, иначе очередь не удалилась бы)
  await sleep(10)
  assert.deepEqual(queueNow(), [])
})

await t('очередь, центр: обычное нажатие — серый таймер (выход долгим нажатием), долгое — экран настройки ценности 🩸', async () => {
  press(zoneBtn(1))
  await sleep(30)
  const gray = buttons().find((w) => w.props.normal_color === 0x8c8c8c)
  assert.equal(gray !== undefined, true)
  assert.equal(zoneBtn(1), undefined)
  hold(gray)
  await sleep(30)
  assert.equal(buttons().some((w) => w.props.normal_color === 0x8c8c8c), false)
  await sleep(900)
  hold(zoneBtn(1))
  await sleep(30)
  assert.equal(texts().includes('60 мин'), true)                 // экран настройки ценности
  const bg = buttons().find((w) => w.props.w === 432 && w.props.h > 400 && w.props.text === '' && w.props.normal_color === 0)
  hold(bg)                                                       // закрыть долгим нажатием
  await sleep(30)
  assert.equal(texts().includes('60 мин'), false)
  assert.equal(zoneBtn(1) !== undefined, true)
})

await t('очередь, левая зона: обычное нажатие — тестовый режим вкл / выкл (на кнопках секунды вместо минут)', async () => {
  await sleep(900)
  press(zoneBtn(0))                                              // тест включён
  await sleep(10)
  press(byImg('i2.png'))
  await sleep(30)
  const sec = runBtn()
  assert.equal(sec !== undefined && (sec.props.text === '20' || sec.props.text === '19'), true)
  press(sec)                                                     // стоп
  await sleep(30)
  assert.equal(runBtn(), undefined)
  press(zoneBtn(0))                                              // тест выключен
  await sleep(10)
  press(byImg('i2.png'))
  await sleep(30)
  const min = runBtn()
  assert.equal(min !== undefined && (min.props.text === '60' || min.props.text === '59'), true)
  press(min)
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('во время работы занятия: ввод очереди, настройка и тестовый режим не включаются; серый таймер и магазин — работают', async () => {
  await sleep(900)
  press(byImg('i2.png'))                                         // занятие идёт
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)
  hold(zoneBtn(0))                                               // ввод очереди не включается
  hold(zoneBtn(1))                                               // настройка ценности не открывается
  await sleep(10)
  assert.equal(texts().includes('60 мин'), false)
  press(zoneBtn(0))                                              // тестовый режим не меняется (идёт занятие)
  await sleep(10)
  assert.equal(runBtn().props.text === '60' || runBtn().props.text === '59', true)
  hold(balBtn())                                                 // магазин открывается всегда
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), true)
  hold(balBtn())
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), false)
  await sleep(850)                                               // сразу после долгого нажатия нажатие на кнопку занятия считается отпусканием пальца
  press(runBtn())
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

page.onDestroy()
console.log('\nВсе проверки страницы пройдены: ' + n)
process.exit(0)
