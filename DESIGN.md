# Shared Lists — Дизайн-спецификация

Версия 1.0. Статус: обязательна к исполнению.

Этот документ — единственный источник правды по визуальному языку Shared Lists: дизайн-система (цвета, типографика, отступы, рамки, скругления, тени, иконки), спецификации всех компонентов и макеты всех экранов. Документ **не** описывает текущую реализацию — он определяет, как интерфейс должен выглядеть и вести себя. Функциональность приложения (маршруты, сущности, сценарии) сохраняется полностью; визуальный слой проектируется заново по этому документу.

Технический контекст: React + TypeScript, Tailwind CSS, компонентные примитивы в стиле shadcn/ui (Radix под капотом), `lucide-react`, `sonner`, `@dnd-kit`, TanStack Query. Все спецификации даны в терминах Tailwind-классов и семантических токенов.

---

## 1. Введение и философия дизайна

Shared Lists — это **инструмент**, а не витрина. Визуально приложение должно ощущаться как спокойная рабочая среда: плотная, предсказуемая, быстрая. Пользователь открывает страницу, чтобы вычеркнуть «Молоко 2л» из списка «Купить» — и интерфейс не должен отвлекать его ни градиентами, ни свечением, ни пустотой.

Из этого следуют пять принципов:

1. **Функция важнее декора.** Каждый визуальный элемент отвечает на вопрос «что это мне даёт?». Если ответ — «красиво», элемент удаляется.
2. **Рамки вместо теней.** Разделение блоков — тонкими 1px рамками, а не размытыми «мыльными» тенями. Тень — редкое исключение для слоёв, которые физически парят над контентом (меню, диалоги, тосты).
3. **Плотность — это уважение к пользователю.** На экране 1440×900 дашборд показывает минимум 8 карточек страниц без скролла. Никаких «два элемента и 80px воздуха».
4. **Один акцент.** В интерфейсе ровно один функциональный акцентный цвет (зелёный). Всё остальное — нейтральная тёплая серая шкала плюс сдержанные семантические цвета.
5. **Контент всегда реалистичен.** Чек-листы про дачу, релизы и свадьбы. Никакого Lorem Ipsum, «Test page» и «User 1».

Приложение близко по духу к линейным инструментам (issue-трекеры, админки, панели мониторинга): тёплая нейтральная база, чёткие границы, моноширинные акценты для технических строк (токены, slug), типографика IBM Plex.

---

## 2. Жёсткие запреты

Таблица ниже — нормативная. Нарушение любого пункта — повод вернуть PR на доработку без обсуждений.

| # | Запрещено | Примеры запрещённого | Использовать вместо |
|---|---|---|---|
| 1 | Декоративные градиенты, особенно фиолетово-розовые | `bg-gradient-to-r from-purple-500 to-pink-500`, `bg-gradient mesh`, градиентные заливки карточек и кнопок | Однотонные `bg-surface` / `bg-subtle`; разделение — `border` (см. §6) |
| 2 | `backdrop-blur` любой силы и полупрозрачные «стеклянные» поверхности | `backdrop-blur`, `backdrop-blur-md`, `bg-white/70 backdrop-blur` в шапке, `bg-white/10` | Непрозрачный `bg-background` / `bg-elevated`; overlay диалогов — `bg-black/50` без blur |
| 3 | Неоновое свечение элементов | `drop-shadow-[0_0_12px_rgba(...)]`, цветные `box-shadow` с glow, декоративные `ring-*` | 1px `border`; `ring-2 ring-accent` **только** как focus-индикатор (см. §15) |
| 4 | Тяжёлые размытые тени | `shadow-xl`, `shadow-2xl`, `shadow-lg` | `border` как основной разделитель; `shadow-sm` только на hover карточек; `shadow-md` только для floating-слоёв (см. §8) |
| 5 | Гигантские скругления | `rounded-2xl`, `rounded-3xl`, `rounded-xl` на карточках, модалках, кнопках, инпутах | `rounded-md` (6px) — контролы; `rounded-lg` (8px) — карточки и диалоги; полная шкала в §7 |
| 6 | Низкая информационная плотность | `p-10`…`p-24` внутри карточек, `py-16`+ между секциями, `min-h-screen` с двумя элементами, `gap-8`+ в сетках | Лимиты из §5: карточки `p-4`, секции `space-y-6`, сетки `gap-4` |
| 7 | Нереалистичный контент | Lorem Ipsum, «Test», «asdf», «Page 1», «User 1», «999 items» | Правила и утверждённые примеры из §13 |
| 8 | Эмодзи в интерфейсе | «✅ Сделано», «📝 Новый список» | Иконки `lucide-react` (закрытый набор, §9) |
| 9 | Текстовые градиенты и клипы | `bg-clip-text text-transparent` | Однотонный `text-foreground` |
| 10 | Декоративные анимации | `animate-bounce`, spring-физика, parallax, «плавающие» элементы | Функциональные переходы 150–300ms из §14 |
| 11 | Иконки вне утверждённого набора | Сторонние иконпаки, самодельные SVG-«пятна» | Закрытый набор `lucide-react` из §9 |
| 12 | Цвета вне палитры | Произвольные hex в разметке, `text-[#ff00aa]` | Только семантические токены из §3 |

Единственное фирменное исключение: кнопка входа через Twitch использует брендовый `#9146FF` (см. §3.4). Это не градиент и не свечение — однотонная заливка одной кнопки на одном экране.

---

## 3. Цветовая система

Палитра построена на тёплой нейтральной шкале (база — stone) и одном зелёном акценте. Все цвета объявляются как CSS-переменные и прокидываются в Tailwind как семантические токены. **Хардкод hex в компонентах запрещён** (пункт 12 запретов) — исключение только `#9146FF` кнопки Twitch.

### 3.1 Светлая тема

```css
:root {
  /* Поверхности */
  --background:        #FAFAF9;  /* stone-50  — фон страницы */
  --surface:           #FFFFFF;  /* карточки, инпуты */
  --elevated:          #FFFFFF;  /* меню, диалоги, тосты (+ shadow-md) */
  --subtle:            #F5F5F4;  /* stone-100 — hover-фон, бейджи, трек прогресса */

  /* Рамки */
  --border:            #E7E5E4;  /* stone-200 — рамки карточек, разделители */
  --border-strong:     #D6D3D1;  /* stone-300 — hover рамок, dashed-плейсхолдеры */
  --input-border:      #A8A29E;  /* stone-400 — рамки интерактивных контролов */

  /* Текст */
  --foreground:          #1C1917;  /* stone-900 — основной текст */
  --secondary-foreground:#57534E;  /* stone-600 — описания, вторичный текст */
  --muted-foreground:    #78716C;  /* stone-500 — даты, плейсхолдеры, подписи */

  /* Акцент (зелёный) */
  --accent:              #15803D;  /* green-700 — текст, иконки, рамки фокуса */
  --accent-solid:        #15803D;  /* заливка primary-кнопок, чекбоксов, прогресса */
  --accent-solid-hover:  #166534;  /* green-800 */
  --accent-foreground:   #FFFFFF;  /* текст на акцентной заливке */
  --accent-subtle:       #F0FDF4;  /* green-50 — фон акцентных бейджей и баннеров */

  /* Семантика */
  --destructive:         #DC2626;  /* red-600 */
  --destructive-hover:   #B91C1C;  /* red-700 */
  --destructive-subtle:  #FEF2F2;  /* red-50 */
  --warning:             #B45309;  /* amber-700 — только текст/иконки */
  --warning-subtle:      #FFFBEB;  /* amber-50 */
  --info:                #1D4ED8;  /* blue-700 — бейджи Editor */
  --info-subtle:         #EFF6FF;  /* blue-50 */

  /* Единственное брендовое исключение */
  --twitch:              #9146FF;
  --twitch-hover:        #7C35E8;
}
```

### 3.2 Тёмная тема

```css
.dark {
  --background:        #0F0E0D;
  --surface:           #171512;
  --elevated:          #201D1A;  /* floating-слои светлее фона + shadow-md */
  --subtle:            #26231F;

  --border:            #2C2925;
  --border-strong:     #403B35;
  --input-border:      #57534E;

  --foreground:          #EDEBE8;
  --secondary-foreground:#B8B3AC;
  --muted-foreground:    #8A847C;

  --accent:              #4ADE80;  /* green-400 — текст/иконки/фокус на тёмном */
  --accent-solid:        #16A34A;  /* green-600 — заливка (контраст с белым текстом) */
  --accent-solid-hover:  #15803D;
  --accent-foreground:   #FFFFFF;
  --accent-subtle:       rgba(34, 197, 94, 0.14);

  --destructive:         #EF4444;  /* red-500 */
  --destructive-hover:   #DC2626;
  --destructive-subtle:  rgba(239, 68, 68, 0.14);
  --warning:             #F59E0B;  /* amber-500 */
  --warning-subtle:      rgba(245, 158, 11, 0.14);
  --info:                #60A5FA;  /* blue-400 */
  --info-subtle:         rgba(96, 165, 250, 0.14);

  --twitch:              #9146FF;
  --twitch-hover:        #A875FF;
}
```

### 3.3 Маппинг в Tailwind

```js
// tailwind.config — только эти токены используются в разметке
colors: {
  background: 'var(--background)',
  surface: 'var(--surface)',
  elevated: 'var(--elevated)',
  subtle: 'var(--subtle)',
  border: 'var(--border)',
  'border-strong': 'var(--border-strong)',
  'input-border': 'var(--input-border)',
  foreground: 'var(--foreground)',
  'secondary-foreground': 'var(--secondary-foreground)',
  'muted-foreground': 'var(--muted-foreground)',
  accent: 'var(--accent)',
  'accent-solid': 'var(--accent-solid)',
  'accent-solid-hover': 'var(--accent-solid-hover)',
  'accent-foreground': 'var(--accent-foreground)',
  'accent-subtle': 'var(--accent-subtle)',
  destructive: 'var(--destructive)',
  'destructive-hover': 'var(--destructive-hover)',
  'destructive-subtle': 'var(--destructive-subtle)',
  warning: 'var(--warning)',
  'warning-subtle': 'var(--warning-subtle)',
  info: 'var(--info)',
  'info-subtle': 'var(--info-subtle)',
}
```

### 3.4 Правила применения

- **Разделение блоков — рамками, не заливкой и не тенью.** Соседние поверхности различаются через `border border-border`. Разница `bg-background` ↔ `bg-surface` — вторичный сигнал, никогда не единственный.
- `bg-subtle` — только для hover-состояний, бейджей, скелетонов и трека прогресс-бара. Не использовать как фон целых секций.
- `--accent` (текст/рамки) и `--accent-solid` (заливки) — разные роли. На тёмной теме они различаются (green-400 vs green-600), не путать.
- Семантические `*-subtle` — всегда в паре с соответствующим текстовым цветом: `bg-accent-subtle text-accent`, `bg-destructive-subtle text-destructive`.
- Кнопка «Войти через Twitch» — единственное место с `#9146FF`: `bg-[#9146FF] text-white hover:bg-[#7C35E8]` (светлая тема). В остальном приложении фиолетовый не встречается.
- `--warning` используется только для текста и иконок (например, предупреждение «Токен показывается один раз»), никогда — как заливка кнопки.

---

## 4. Типографика

### 4.1 Шрифты

| Роль | Шрифт | Fallback |
|---|---|---|
| Интерфейс | **IBM Plex Sans** (400, 500, 600; полная кириллица) | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` |
| Моноширинный | **JetBrains Mono** (400, 500; кириллица) | `ui-monospace, 'SF Mono', Menlo, monospace` |

```css
--font-sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

Подключение — через `fontsource` (`@fontsource/ibm-plex-sans`, `@fontsource/jetbrains-mono`) с самохостингом; Google Fonts — допустимый fallback на время разработки. IBM Plex Sans выбран за технический, «инструментальный» характер и честную кириллицу; Inter, Arial и системные дефолты не используются.

### 4.2 Шкала

| Токен | Размер / межстрочный | Вес | Tailwind | Где применяется |
|---|---|---|---|---|
| `display` | 24px / 32px | 600 | `text-2xl font-semibold tracking-[-0.01em]` | Заголовки экранов («Настройки») |
| `title` | 20px / 28px | 600 | `text-xl font-semibold tracking-[-0.01em]` | Заголовок страницы в PageView (inline-edit) |
| `heading` | 16px / 24px | 600 | `text-base font-semibold` | Заголовки карточек, диалогов, секций |
| `label` | 14px / 20px | 500 | `text-sm font-medium` | Кнопки, label полей, заголовки списков-колонок |
| `body` | 14px / 20px | 400 | `text-sm` | Основной текст, содержимое пунктов |
| `small` | 13px / 18px | 400 | `text-[13px]` | Описания карточек, вторичные строки |
| `caption` | 12px / 16px | 400/500 | `text-xs` | Даты, бейджи, счётчики, подписи под полями |
| `mono` | 13px / 20px | 400 | `text-[13px] font-mono` | API-токены, public slug, scopes |

### 4.3 Правила

- Веса: только 400 / 500 / 600. `font-bold` (700) запрещён везде, включая логотип.
- Заголовки — `tracking-[-0.01em]`, остальной текст — без letter-spacing. Uppercase в бейджах и подписях не используется.
- Числа в счётчиках и прогрессе — `tabular-nums` (класс `tabular-nums`), чтобы «3/7» не прыгало при обновлении.
- Инпуты на вьюпортах < 768px — `text-base` (16px), чтобы iOS не зумил фокус; на десктопе — `text-sm`.
- Описания и контент обрезаются `line-clamp-2` (карточки) или `truncate` (заголовки в узких местах). Многоточие — всегда CSS, никогда не «ручное» `...` в данных.
- Длинные токены и slug переносятся `break-all` внутри `font-mono` блока.

---

## 5. Масштаб отступов (spacing)

Плотность — конкурентная фича. Работаем на стандартной шкале Tailwind, но с жёсткими потолками.

### 5.1 Утверждённые значения

| Контекст | Значение | Tailwind |
|---|---|---|
| Внутренний отступ карточек (PageCard, секции профиля) | 16px | `p-4` |
| Внутренний отступ диалогов | 20px | `p-5` (максимум для любого блока) |
| Отступы колонки-списка (header/footer) | 8–12px | `px-2 py-2`, `p-1.5` |
| Ритм между секциями страницы | 24px | `space-y-6` (потолок — `space-y-8`) |
| Ритм между полями формы | 16px | `space-y-4` |
| Сетка карточек дашборда | 16px | `gap-4` |
| Горизонтальный зазор между колонками списков | 12px | `gap-3` |
| Вертикальный зазор между пунктами списка | 2px | `space-y-0.5` |
| Контент после шапки | 16–24px | `py-4`…`py-6` |
| Контейнер дашборда/профиля | `max-w-6xl` (1152px) / `max-w-2xl` (672px) | `mx-auto px-4 md:px-6` |
| PageView (доска) | полная ширина | `px-4 md:px-6`, без `max-w` |

### 5.2 Запреты по плотности

- Запрещены `p-8` и выше внутри карточек и диалогов; `p-6` — только если карточка содержит форму из 4+ полей.
- Запрещены `py-12`+ для секций, `gap-6`+ в сетках карточек, `space-y-10`+ на странице.
- Запрещён `min-h-screen` как единственный «наполнитель» экрана (исключения по смыслу: Login, AuthCallback, 404 — там центрирование оправдано, но контент внутри всё равно собран плотно, см. §11).
- Контрольные плотности (проверяются на ревю скриншотом 1440×900):
  - Дашборд: шапка + заголовки двух секций + ≥ 8 карточек страниц видны без скролла.
  - PageView: колонка списка показывает ≥ 12 пунктов без внутреннего скролла при 900px высоты.
  - Профиль: обе карточки начинаются в первом экране.

---

## 6. Рамки и разделение

Рамки — **основной** способ разделения в системе, заменяющий тени.

| Роль | Токен | Применение |
|---|---|---|
| Декоративная рамка | `border-border` (1px) | Карточки, шапка (`border-b`), разделители (`divide-y`), колонки |
| Усиленная рамка | `border-border-strong` | Hover на рамках карточек, dashed-плейсхолдеры |
| Интерактивная рамка | `border-input-border` | Input, Textarea, Select, Checkbox, outline-кнопки |
| Рамка фокуса | `border-accent` | Focus-visible у контролов (в паре с `ring-2 ring-accent/30`) |

Правила:

- Толщина — всегда 1px. `border-2` не используется нигде, кроме focus-индикатора (который реализован через `ring`, а не `border`).
- Шапка отделяется от контента `border-b border-border` на непрозрачном фоне. Sticky-шапки с `bg-background/80 backdrop-blur` запрещены (пункт 2 запретов) — только сплошной `bg-background`.
- Вложенные списки-плитки (ключи API, участники) разделяются `divide-y divide-border`, без внешних рамок у каждой строки.
- Пункты чек-листа разделителей не имеют — группировка через hover-фон `hover:bg-subtle`.
- Dashed-рамки (`border-dashed border-border-strong`) зарезервированы за плейсхолдерами: «Добавить список», drop-зоны. Обычным карточкам dashed запрещён.
- Фоновый контраст (`bg-background` ↔ `bg-surface`) допустим как второй слой разделения, но никогда — как единственный.

---

## 7. Скругления

Шкала закрытая. `rounded-xl`, `rounded-2xl`, `rounded-3xl` запрещены везде (пункт 5 запретов).

| Значение | px | Компоненты |
|---|---|---|
| `rounded-sm` | 2px | Пункты меню, мелкие вложенные элементы |
| `rounded` | 4px | Badge (role/permission/status), Checkbox, скелетоны строк |
| `rounded-md` | 6px | Button, Input, Textarea, Select, DropdownMenu popover, Toast, скелетоны карточек |
| `rounded-lg` | 8px | **Максимум в системе.** Card (все виды), Dialog, AlertDialog |
| `rounded-full` | 9999px | Avatar, ProgressBar (трек и заливка), counter-бейдж |

Скругление наследуется по вложенности: у карточки `rounded-lg` у внутренних контролов `rounded-md`, у пунктов меню `rounded-sm`. Скруглять «под стать родителю» (8px внутри 8px) не нужно.

---

## 8. Тени

Почти всё в системе — `shadow-none`. Тень означает физическое парение слоя над контентом, и только это.

| Тень | Разрешено | Запрещено |
|---|---|---|
| `shadow-none` | Всё по умолчанию: карточки, кнопки, инпуты, шапки | — |
| `shadow-sm` | Hover PageCard и ListCard (единственный hover-«подъём») | Использование как постоянный стиль |
| `shadow-md` | Только floating-слои: Dialog, AlertDialog, DropdownMenu popover, Toast, drag-overlay при перетаскивании | Любое другое применение |
| `shadow-lg`, `shadow-xl`, `shadow-2xl` | — | **Запрещены полностью** (пункт 4 запретов) |
| Цветные/светящиеся тени (`shadow-green-500/30`, `[box-shadow:0_0_…]`) | — | **Запрещены полностью** |

Focus-индикатор (`ring-2`) тенью не считается — это outline, его правила в §15.

---

## 9. Иконки

Набор закрыт — только перечисленные `lucide-react`:

`AlertCircle, ArrowLeft, ArrowRight, Check, ChevronLeft, Copy, ExternalLink, Globe, GripVertical, Key, Link, ListTodo, Loader2, LogOut, Pencil, Plus, Search, Settings, Share2, Shield, ShieldCheck, Trash2, User, UserPlus, X`

Правила:

- `strokeWidth={2}` везде. Исключение: `Check` внутри чекбокса — `strokeWidth={3}` при размере 12px.
- Шкала размеров: 14px (бейджи, пункты меню), 16px (кнопки, инпуты — дефолт), 20px (шапки, логотип), 24px (полноэкранный спиннер), 32–40px (только empty- и error-состояния, цвет `text-muted-foreground`).
- Недостающие стрелки «вниз» делаются поворотом: `ChevronLeft` с `-rotate-90` (стрелка Select), никаких новых иконок.
- Меню колонки-списка открывается кнопкой с `Settings` (иконки «троеточие» в наборе нет).
- Icon-only кнопки обязаны иметь локализованный `aria-label` (см. §15). Размеры: дефолт `h-8 w-8`, в плотных строках `h-7 w-7`.
- Иконка + текст в кнопке: `gap-1.5`, иконка 16px. Иконка не заменяет текст там, где действие неочевидно (Share — всегда с подписью «Поделиться» на десктопе).
- Эмодзи вместо иконок запрещены (пункт 8 запретов).

---

## 10. Компоненты

Легенда состояний: **Default / Hover / Focus-visible / Active / Disabled / Loading**. Везде, где не указано иное, переходы — `transition-colors duration-150` (см. §14).

### 10.1 Button

Анатомия: `[icon?] label [icon?]`, одна строка, `whitespace-nowrap`.

Базовые классы:

```
inline-flex items-center justify-center gap-1.5 rounded-md font-medium
transition-colors duration-150
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
focus-visible:ring-offset-1 focus-visible:ring-offset-background
disabled:opacity-50 disabled:pointer-events-none
```

Размеры:

| Размер | Классы | Где |
|---|---|---|
| `sm` | `h-8 px-3 text-[13px]` | Действия в карточках, «Отозвать» ключ |
| `md` | `h-9 px-4 text-sm` | Дефолт везде |
| `lg` | `h-10 px-5 text-sm` | Только CTA на Login |
| `icon` | `h-8 w-8` | Дефолтные icon-only |
| `icon-dense` | `h-7 w-7` | Строки пунктов, шапки колонок |

Варианты:

| Вариант | Классы |
|---|---|
| `primary` | `bg-accent-solid text-accent-foreground hover:bg-accent-solid-hover active:bg-accent-solid-hover` |
| `destructive` | `bg-destructive text-white hover:bg-destructive-hover` |
| `outline` | `border border-input-border bg-surface text-foreground hover:bg-subtle` |
| `secondary` | `bg-subtle text-foreground hover:bg-border` |
| `ghost` | `text-secondary-foreground hover:bg-subtle hover:text-foreground` |
| `ghost-destructive` (icon-only) | `text-muted-foreground hover:bg-destructive-subtle hover:text-destructive` |
| `link` | `h-auto px-0 text-accent underline-offset-4 hover:underline` |
| `twitch` (только /login) | `bg-[#9146FF] text-white hover:bg-[#7C35E8]` |

Состояния:

- **Loading**: `Loader2` 16px `animate-spin` заменяет левую иконку, подпись сохраняется, кнопка `disabled`. Пример: «Создание…» со спиннером.
- **Disabled**: `opacity-50`, без изменения цветов.
- **Active**: без `scale`/`translate` — только затемнение заливки (класс active = hover-цвету).

```tsx
<Button className="h-9 px-4 rounded-md bg-accent-solid text-sm font-medium text-accent-foreground hover:bg-accent-solid-hover">
  <Plus className="h-4 w-4" /> Создать страницу
</Button>
```

### 10.2 Input

```
h-9 w-full rounded-md border border-input-border bg-surface px-3 text-sm text-foreground
placeholder:text-muted-foreground
focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30
disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60
md:text-sm text-base   /* 16px на мобильных против iOS-зума */
```

- Label над полем: `mb-1.5 block text-sm font-medium`.
- Подсказка под полем: `mt-1.5 text-xs text-muted-foreground`.
- **Error**: `border-destructive focus-visible:ring-destructive/30` + `mt-1.5 text-xs text-destructive` (например: «Страница с slug „dacha-avgust“ уже существует»).
- Внутри строк (inline добавление пункта) допустима borderless-версия: `border-transparent hover:border-border focus:border-accent`.

### 10.3 Textarea

Те же рамки/фокус/ошибки, что у Input, плюс:

```
min-h-[72px] resize-y px-3 py-2
```

Используется для описания страницы (в CreatePageDialog и inline-edit). Автовысота не обязательна; `resize-y` оставляем пользователю.

### 10.4 Checkbox

```
h-4 w-4 shrink-0 rounded-[4px] border border-input-border bg-surface
transition-colors duration-150
hover:border-accent
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-1
data-[state=checked]:border-accent-solid data-[state=checked]:bg-accent-solid data-[state=checked]:text-white
disabled:cursor-not-allowed disabled:opacity-50
```

- Галка: `Check` 12px `strokeWidth={3}`.
- Кликабельная область расширяется padding строки-родителя (визуально 16px, hit-area ≥ 32px высотой строки).
- На публичной странице (`/p/:slug`) чекбоксы рендерятся `disabled` — состояние «только просмотр» читается по `opacity-50` и отсутствию hover.

### 10.5 Select (native, выбор языка)

```
relative h-9 w-full appearance-none rounded-md border border-input-border bg-surface
pl-3 pr-8 text-sm text-foreground
focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30
```

- Стрелка: `ChevronLeft` 16px `-rotate-90`, абсолютно `right-2 top-1/2 -translate-y-1/2`, `pointer-events-none text-muted-foreground`.
- Опции: «Русский» / «English» (значения `ru` / `en`).

### 10.6 Card: PageCard (дашборд)

```
group relative rounded-lg border border-border bg-surface p-4
transition-[border-color,box-shadow] duration-150
hover:border-border-strong hover:shadow-sm
```

Анатомия (сверху вниз, `flex flex-col gap-2`):

1. Заголовок: `truncate text-[15px] font-medium` — «Поездка на дачу». Клик ведёт на `/pages/:pageId`.
2. Описание: `line-clamp-2 min-h-[36px] text-[13px] text-secondary-foreground` — «Список покупок и вещей на выходные 25–26 июля». `min-h` выравнивает сетку при пустом описании (тогда рендерится пустая строка, не плейсхолдер).
3. Футер (`mt-auto flex items-center justify-between pt-2`): слева `text-xs text-muted-foreground` — «Обновлена 12 сентября»; справа role-бейдж (только в секции «Со мной поделились») и/или hover-reveal кнопка удаления (только свои страницы).

Кнопка удаления — `Trash2`, `ghost-destructive icon-dense`, паттерн hover-reveal (§12.4). Вся карточка кликабельна; кнопка удаления — `stopPropagation`.

### 10.7 Card: ListCard (колонка на доске)

```
flex w-[320px] shrink-0 flex-col rounded-lg border border-border bg-surface
/* мобильные: w-[min(320px,85vw)] */
max-h-[calc(100vh-180px)]
```

Анатомия:

1. **Header** (`flex items-center gap-1.5 border-b border-border px-2 py-2`):
   - drag-handle `GripVertical` 14px `text-muted-foreground cursor-grab active:cursor-grabbing` — виден при `can_edit`, по hover-reveal (§12.4);
   - заголовок колонки: `flex-1 truncate px-1 text-sm font-medium`, double-click → inline-edit (§10.14);
   - счётчик: counter-бейдж `3/7` (если `show_progress`) либо просто `7` (всегда);
   - меню колонки: ghost-кнопка `Settings` 16px (`icon-dense`) → DropdownMenu: чекбокс-пункт «Показывать чекбоксы», чекбокс-пункт «Показывать прогресс», сепаратор, «Переименовать», сепаратор, «Удалить список» (destructive).
2. **Прогресс** (только при `show_progress`): `border-b border-border px-3 py-2` — ProgressBar + подпись «3 из 7 выполнено».
3. **Пункты** (`flex-1 space-y-0.5 overflow-y-auto p-1.5`): строки ListItemRow (§10.11). Если `show_checkboxes=false`, чекбоксы не рендерятся, пункты остаются текстовыми строками с drag/edit/delete.
4. **Footer** (`border-t border-border p-1.5`, только при `can_edit`): строка добавления — `Plus` 16px `text-muted-foreground` + borderless Input «Добавить пункт…», Enter создаёт пункт и оставляет фокус в поле.

### 10.8 Card: AddListCard (плейсхолдер)

```
flex h-28 w-[320px] shrink-0 items-center justify-center gap-2
rounded-lg border border-dashed border-border-strong
text-sm text-muted-foreground
transition-colors duration-150
hover:border-input-border hover:bg-subtle hover:text-foreground
```

Содержимое: `Plus` 16px + «Добавить список». Рендерится последним в ряду колонок, только при `can_edit`. Клик превращает карточку в форму (Input + «Создать» / отмена по Escape) на месте плейсхолдера.

### 10.9 Card: PublicListCard (публичная страница)

Та же геометрия, что у ListCard, но: без drag-handle, без меню, без футера добавления; чекбоксы `disabled`; прогресс-бар показывается, если включён владельцем. Hover-эффекты на строках отключены (`hover:bg-subtle` не применяется) — страница явно read-only.

### 10.10 Dialog / AlertDialog

Overlay (оба):

```
fixed inset-0 z-50 bg-black/50
data-[state=open]:animate-in data-[state=open]:fade-in-0
/* backdrop-blur ЗАПРЕЩЁН (пункт 2 запретов) */
```

Dialog content:

```
fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2
rounded-lg border border-border bg-elevated p-5 shadow-md
```

| Диалог | Ширина | Содержимое |
|---|---|---|
| CreatePageDialog | `max-w-md` (448px) | Заголовок, Input «Название» (required), Textarea «Описание (необязательно)», footer |
| ShareDialog | `max-w-lg` (512px) | Заголовок + Tabs «Ссылка» / «Участники» (§10.12) |
| AlertDialog (все подтверждения) | `max-w-sm` (384px) | Заголовок-вопрос, текст последствий, footer |

Анатомия Dialog:

1. Header: `text-base font-semibold` + описание `mt-1 text-[13px] text-secondary-foreground`.
2. Кнопка закрытия: `X` 16px, `ghost icon-dense`, абсолютно `right-4 top-4`, `aria-label="Закрыть"`.
3. Тело: `mt-4 space-y-4`.
4. Footer: `mt-5 flex justify-end gap-2` — слева-направо: «Отмена» (`outline`), действие (`primary` / `destructive`).

AlertDialog — та же анатомия без полей. Примеры текстов — в §12.5. Кнопка подтверждения удаления всегда `destructive` и всегда справа; `autoFocus` на ней **не** ставим (фокус на «Отмена» — защита от случайного Enter).

### 10.11 ListItemRow (пункт списка)

```
group flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1
transition-colors duration-150 hover:bg-subtle
```

Анатомия (слева направо):

1. Drag-handle: `GripVertical` 14px, `text-muted-foreground cursor-grab active:cursor-grabbing`, hover-reveal (§12.4), `aria-label="Перетащить пункт"`.
2. Checkbox (§10.4), если у списка `show_checkboxes`.
3. Контент: `flex-1 text-sm leading-5`.
4. Действия (hover-reveal): `Pencil` и `Trash2`, `ghost icon-dense`, delete — `ghost-destructive`. `aria-label` «Редактировать пункт» / «Удалить пункт».

Состояния:

| Состояние | Спецификация |
|---|---|
| `checked` | Контент: `text-muted-foreground line-through decoration-muted-foreground/60`. Чекбокс — checked. Без изменения фона строки |
| inline-edit | Контент заменяется Input: `h-7 w-full rounded border border-accent bg-surface px-1.5 text-sm`. Enter/blur — сохранить, Escape — отменить. Во время сохранения строка `opacity-60 pointer-events-none` |
| deleting | `animate-pulse pointer-events-none` на всю строку (optimistic delete) |
| drag | См. §10.15: исходная строка `opacity-40`, overlay — копия строки с `shadow-md` |

### 10.12 Tabs (ShareDialog)

Underline-вариант, без «таблеток»:

- Список: `flex gap-4 border-b border-border`.
- Триггер: `relative h-9 px-1 text-sm font-medium text-secondary-foreground transition-colors hover:text-foreground data-[state=active]:text-foreground` + активный индикатор `data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-accent`.
- Контент: `pt-4`. Табы: «Ссылка» (public link: Input со slug, кнопки «Копировать» / «Удалить ссылку», подсказка) и «Участники» (поиск + список collaborators).

### 10.13 DropdownMenu (UserMenu, меню колонки)

Popover:

```
min-w-[180px] rounded-md border border-border bg-elevated p-1 shadow-md
```

- Пункт: `flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-[13px] outline-none hover:bg-subtle focus:bg-subtle`, иконка 14px.
- Пункт destructive: `text-destructive hover:bg-destructive-subtle focus:bg-destructive-subtle`.
- Сепаратор: `-mx-1 my-1 h-px bg-border`.
- Шапка (не кликабельна): `px-2 py-1.5` — имя `text-[13px] font-medium` + логин `text-xs text-muted-foreground` («streamer_max»).
- Чекбокс-пункт (в меню колонки): слева слот 16px с `Check` 14px при включении.
- UserMenu: триггер — Avatar 32px + display_name (`text-sm font-medium`), контент: шапка с пользователем, сепаратор, «Профиль» (`Settings`), сепаратор, «Выйти» (`LogOut`, destructive).

### 10.14 Inline editing (единый паттерн)

Применяется к: заголовку страницы, описанию страницы, заголовку колонки, содержимому пункта.

- Вход: **double-click** по тексту (колонка также — через пункт меню «Переименовать»).
- Поле заменяет текст **на месте, в том же размере шрифта**: заголовок страницы `text-xl font-semibold`, описание `text-[13px]`, пункт `text-sm`. Input получает `border-accent bg-surface px-1.5 -mx-1.5` (компенсация, чтобы текст не прыгал).
- Enter — сохранить, Escape — отменить, blur — сохранить. Пустое значение откатывается к предыдущему (названия не бывают пустыми); для описания пустое значение валидно (описание удаляется).
- Placeholder пустого описания: «Добавить описание…» в `text-muted-foreground`, при `can_edit` — с `cursor-text`.
- Во время мутации: `opacity-60 pointer-events-none`. Ошибка — toast (§10.17) и откат значения.

### 10.15 Drag-and-drop (@dnd-kit)

- Списки-колонки реордерятся **горизонтально**, пункты — **вертикально** внутри своей колонки. Перетаскивание пунктов между колонками в v1 не поддерживается (не рисуем индикаторы для этого кейса).
- Drag-handle — только `GripVertical` (не вся карточка), чтобы не конфликтовать с выделением текста и double-click.
- Исходный элемент во время drag: `opacity-40`. DragOverlay: точная копия элемента с `shadow-md` и `border-border-strong`, без поворотов и scale.
- Drop-индикатор: полоса 2px `bg-accent` — вертикальная между колонками, горизонтальная между строками. Никаких «призрачных» подсвеченных зон.
- Клавиатура: sortable keyboard sensor — Space поднимает элемент, стрелки двигают, Space ставит, Escape отменяет (§15).
- Курсоры: `cursor-grab` на handle, `cursor-grabbing` на `document.body` во время drag.

### 10.16 Badge

База: `inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-xs font-medium`.

| Вариант | Классы | Где |
|---|---|---|
| Creator | `bg-accent-subtle text-accent` | Дашборд, PageView (создатель) |
| Editor / «Может редактировать» | `bg-info-subtle text-info` | Роль на shared-страницах, права участника |
| Viewer / «Может смотреть» | `bg-subtle text-secondary-foreground` | Роль, права участника |
| Active («Активен») | `bg-accent-subtle text-accent` | Статус API-ключа |
| Revoked («Отозван») | `bg-destructive-subtle text-destructive` | Статус API-ключа |
| Counter | `rounded-full bg-subtle px-2 py-0.5 font-mono text-[11px] tabular-nums text-secondary-foreground` | «3/7» в шапке колонки |
| Public | `bg-subtle text-secondary-foreground` + `Globe` 12px | «Публичная» в ShareDialog |

Роль и права дублируются текстом всегда — цвет никогда не единственный носитель смысла (§15).

### 10.17 Toast (Sonner)

```
max-w-[360px] items-start gap-2.5 rounded-lg border border-border bg-elevated p-3 shadow-md
```

- Позиция: `top-right`, offset 16px. Длительность 4000ms, error — 6000ms.
- `richColors={false}` — стиль всегда «рамка + elevated», не цветные заливки.
- Иконка 16px: success — `Check` `text-accent`; error — `AlertCircle` `text-destructive`.
- Заголовок `text-sm font-medium`, описание `text-[13px] text-secondary-foreground`.
- Примеры: «Страница создана» / «Не удалось удалить список. Попробуйте ещё раз.»

### 10.18 Avatar

| Размер | Классы | Где |
|---|---|---|
| `xs` 24px | `h-6 w-6` | Строки участников в ShareDialog |
| `sm` 32px | `h-8 w-8` | UserMenu в шапке |
| `md` 40px | `h-10 w-10` | Профиль (превью рядом с полем URL) |

```
rounded-full border border-border object-cover
```

- Fallback (нет `profile_image_url`): первая буква display_name в верхнем регистре, `bg-accent-subtle text-accent font-medium` (размер текста: 10 / 12 / 14px по шкале выше).
- Пустой placeholder (пользователь не загружен): `bg-subtle text-muted-foreground` + иконка `User` 50% размера.

### 10.19 ProgressBar

```
<div class="h-1.5 w-full rounded-full bg-subtle">
  <div class="h-full rounded-full bg-accent-solid transition-[width] duration-300 ease-out" style="width: 43%" />
</div>
```

- В колонке — в паре с подписью `mt-1.5 text-xs text-muted-foreground tabular-nums` «3 из 7 выполнено».
- A11y: `role="progressbar" aria-valuenow={3} aria-valuemin={0} aria-valuemax={7}` (§15).
- 100% — тот же акцентный цвет, отдельного «всё готово» цвета нет; факт завершения читается из подписи «7 из 7 выполнено».

---

## 11. Экраны и макеты

Общая оболочка: шапка `sticky top-0 z-10 h-14 border-b border-border bg-background` (непрозрачная, без blur). Десктоп-первичная вёрстка; правила схлопывания указаны у каждого экрана. Брейкпоинты: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

### 11.1 `/login` — вход через Twitch

Единственный «маркетинговый» экран — и тот плотный, в одной карточке.

```
<main class="grid min-h-screen place-items-center bg-background px-4 py-10">
  <div class="w-full max-w-[400px] rounded-lg border border-border bg-surface p-6">
```

Анатомия карточки (`flex flex-col`):

1. Логоблок (`flex items-center gap-3`): квадрат `h-10 w-10 rounded-lg bg-accent-subtle` с `ListTodo` 20px `text-accent`; рядом «Shared Lists» `text-xl font-semibold`.
2. Таглайн `mt-2 text-[13px] text-secondary-foreground`: «Общие чек-листы для стрима, поездок и проектов».
3. Разделитель `my-5 border-t border-border`.
4. Фичи (`space-y-2.5`, каждая: `Check` 16px `text-accent` + `text-sm`):
   - «Неограниченные страницы и списки»
   - «Совместное редактирование по приглашению»
   - «Публичные ссылки для зрителей — только чтение»
   - «API-ключи для ботов и интеграций»
5. Кнопка (`mt-6`, размер `lg`, вариант `twitch`, `w-full`): «Войти через Twitch».
6. Подпись `mt-3 text-center text-xs text-muted-foreground`: «Регистрация не нужна — аккаунт создаётся при первом входе».

Никакого hero-фона, иллюстраций и градиентов. Фон страницы — `bg-background`, без декора.

### 11.2 `/auth/callback` — OAuth-редирект

```
<main class="grid min-h-screen place-items-center px-4">
  <div class="space-y-3 text-center">
    <Loader2 class="mx-auto h-6 w-6 animate-spin text-accent" />
    <p class="text-sm font-medium">Завершаем вход через Twitch…</p>
    <p class="text-xs text-muted-foreground">Вы будете перенаправлены автоматически.</p>
  </div>
```

Ошибка (например, `?error=access_denied`): `AlertCircle` 32px `text-destructive`, «Не удалось войти» `text-base font-semibold`, пояснение `text-sm text-secondary-foreground` («Twitch отклонил авторизацию или сессия истекла»), кнопка `outline` «Вернуться ко входу» → `/login`.

### 11.3 `/` — дашборд

**Шапка** (`max-w-6xl mx-auto px-4 md:px-6`, `flex h-full items-center justify-between`):

- Слева: лого `ListTodo` 20px `text-accent` + «Shared Lists» `text-[15px] font-semibold`.
- Справа: UserMenu (§10.13).

**Контент** (`mx-auto max-w-6xl px-4 py-6 md:px-6`, `space-y-8`):

Секция «Мои страницы»:

1. Заголовочная строка (`flex items-center justify-between`): `h2` `text-base font-semibold` «Мои страницы» + счётчик `text-xs text-muted-foreground tabular-nums` «4»; справа primary-кнопка `Plus` «Создать страницу».
2. Сетка: `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4` из PageCard (§10.6).
3. Empty-state (§12.1), если страниц нет.

Секция «Со мной поделились» — аналогично, заголовок «Со мной поделились», кнопки создания нет; у карточек — role-бейдж (Creator/Editor/Viewer) и нет удаления. Если пусто — компактный empty-state одной строкой: «С вами пока никто не поделился страницей».

**CreatePageDialog** (§10.10): поле «Название» (placeholder «Например: Поездка на дачу», required), «Описание (необязательно)» Textarea. Footer: «Отмена» / «Создать страницу» (loading «Создание…»).

**DeleteConfirmDialog** (AlertDialog): заголовок «Удалить страницу „Поездка на дачу“?», текст «Вместе со страницей удалятся 4 списка и 26 пунктов. Действие необратимо.», кнопки «Отмена» / «Удалить» (destructive, loading «Удаление…»).

**Узкие экраны**: сетка сама схлопывается до 2 (`sm`) и 1 колонки; заголовочные строки секций не переносятся (кнопка «Создать страницу» на < 480px становится icon-only `Plus` с `aria-label`).

### 11.4 `/pages/:pageId` — редактор страницы

**Шапка** (не sticky по высоте доски; `border-b border-border bg-background`):

```
<div class="flex items-start gap-3 px-4 py-3 md:px-6">
  <Button ghost icon ArrowLeft → /  (aria-label="Назад к списку страниц", mt-0.5)
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2">
      <h1 class="truncate text-xl font-semibold">  ← inline-edit по double-click
      <Badge role />                             ← Creator / Editor / Viewer
    </div>
    <p class="mt-0.5 text-[13px] text-secondary-foreground"> ← inline-edit описание
  </div>
  <actions: [Share2 «Поделиться» (creator)] [Trash2 ghost-destructive icon (creator)] [UserMenu]
</div>
```

- Кнопка «Поделиться» — `outline` с иконкой `Share2` 16px; на < 640px подпись скрывается (icon-only с `aria-label="Поделиться"`).
- Удаление страницы — `ghost-destructive icon` `Trash2`, открывает DeleteConfirmDialog (текст как на дашборде).
- Если `!can_edit` (viewer): inline-edit недоступен (нет double-click, `cursor-default`), действий нет — только role-бейдж и UserMenu.

**Доска**:

```
<main class="px-4 py-4 md:px-6">
  <div class="flex items-start gap-3 overflow-x-auto pb-4">
    <ListCard /> × N
    <AddListCard />   ← только can_edit
  </div>
</main>
```

- Колонки выравниваются по верху (`items-start`), прокрутка — горизонтальная, скроллбар тонкий, под доской (`pb-4` оставляет ему место).
- DnD колонок — §10.15 (индикатор — вертикальная полоса 2px `bg-accent` между колонками).
- Высота колонки ограничена `max-h-[calc(100vh-180px)]`, пункты скроллятся внутри колонки — доска не растягивает страницу.

**Узкие экраны**: колонки `w-[min(320px,85vw)]`, горизонтальный скролл сохраняется (это естественный паттерн канбана); шапка переносит описание на вторую строку, действия остаются icon-only.

### 11.5 `/p/:slug` — публичная страница (только чтение)

**Шапка** (`border-b border-border bg-surface`):

```
<div class="mx-auto max-w-5xl px-4 py-4 md:px-6">
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Globe 12px /> Публичная страница · только просмотр
      </div>
      <h1 class="mt-1 truncate text-xl font-semibold">Поездка на дачу</h1>
      <p class="mt-0.5 text-[13px] text-secondary-foreground">Список покупок и вещей на выходные 25–26 июля</p>
    </div>
    <Button outline> <Link 16px /> Копировать ссылку </Button>
  </div>
</div>
```

- «Копировать ссылку» после клика на 2 секунды меняется на `Check` «Скопировано» (иконка и текст, без toast).
- Контент: тот же ряд колонок (`mx-auto max-w-5xl px-4 py-4 md:px-6`, `flex items-start gap-3 overflow-x-auto`), но PublicListCard (§10.9).
- **Loading**: skeleton (§12.2) — шапка (строка заголовка + строка описания) и 3 колонки.
- **404** (slug не найден или ссылка удалена): §12.3, кнопка «Перейти ко входу» → `/login`.
- Бейдж «Публичная страница» вверху — единственное отличие в информационной иерархии; никаких баннеров и CTA «зарегистрируйтесь» в v1 нет.

### 11.6 `/profile` — настройки

**Шапка**: слева ghost-кнопка `ArrowLeft` «Назад» (на < 640px — icon-only), по центру ничего, справа UserMenu.

**Контент** (`mx-auto max-w-2xl px-4 py-6 md:px-6`, `space-y-6`):

Заголовок страницы: «Настройки» `text-2xl font-semibold`.

**Карточка 1 — «Профиль»** (`rounded-lg border border-border bg-surface`):

- Header карточки: `border-b border-border p-4` — `h2 text-base font-semibold` «Профиль» + `mt-1 text-[13px] text-secondary-foreground` «Имя и avatar видны участникам ваших страниц».
- Тело `p-4 space-y-4`:
  - Строка аватара (`flex items-center gap-3`): Avatar `md` (превью) + Input `flex-1` с label «URL изображения профиля», placeholder `https://static-cdn.jtvnw.net/jtv_user_pictures/…`. Превью обновляется по blur (ошибка загрузки → fallback с буквой).
  - Input «Отображаемое имя», placeholder «streamer_max».
  - Input «Email», `type="email"`, placeholder «anna.plays@gmail.com».
  - Select «Язык интерфейса»: «Русский» / «English».
- Footer `flex justify-end border-t border-border p-4`: primary «Сохранить» (disabled, пока форма не изменена; loading «Сохранение…»).

**Карточка 2 — «Ключи API»**:

- Header: «Ключи API» + подпись «Ключи дают внешним приложениям доступ к вашим страницам. Храните их как пароли.»
- Форма создания (`p-4`, `flex flex-col gap-3 sm:flex-row sm:items-end`): Input «Название» (placeholder «Stream Bot», `flex-1`); группа scopes (`flex gap-4`, label «Права»): Checkbox «pages:read» + Checkbox «pages:write» (оба — `text-[13px] font-mono`); primary-кнопка `Key` 16px «Создать ключ».
- **Баннер нового токена** (появляется после создания): `rounded-md border border-accent bg-accent-subtle p-3` — подпись `flex items-center gap-1.5 text-[13px] font-medium` (`ShieldCheck` 14px `text-accent`) «Сохраните токен — он показывается только один раз»; строка `mt-2 flex items-center gap-2`: `code` `flex-1 break-all rounded bg-surface px-2 py-1.5 font-mono text-[13px]` (`shl_9f2c4a7e1b3d4f5a6c8e9d0b2a4c6e8f`), icon-кнопка `Copy` («Скопировать токен»), icon-кнопка `X` («Скрыть»).
- Список ключей (`divide-y divide-border`): строка `flex items-center gap-3 px-4 py-3`:
  - `Key` 16px `text-muted-foreground`;
  - имя `text-sm font-medium` («Stream Bot»);
  - scopes — counter-стилем бейджи `font-mono` («pages:read»);
  - `text-xs text-muted-foreground` «Создан 3 марта 2026»;
  - `ml-auto` — статус-бейдж «Активен» / «Отозван»;
  - действия: `outline sm` «Отозвать» (только активным), `ghost-destructive icon-dense` `Trash2`.
  - Отозванный ключ: вся строка `opacity-60`, кнопки «Отозвать» нет, остаётся удаление.
- Empty-state списка: §12.1.
- Подтверждения (AlertDialog):
  - Отзыв: «Отозвать ключ „Stream Bot“?» / «Запросы с этим ключом сразу перестанут работать. Ключ останется в списке как отозванный.» — «Отозвать» (destructive).
  - Удаление: «Удалить ключ „Stream Bot“ полностью?» / «Запись о ключе будет стёрта без возможности восстановления.» — «Удалить» (destructive).

**Узкие экраны**: форма создания ключа складывается в колонку; строка ключа переносит scopes и дату под имя (`flex-wrap`).

---

## 12. Состояния

### 12.1 Empty states

Общая анатомия (в карточке/секции): иконка 32px `text-muted-foreground`, заголовок `text-sm font-medium`, пояснение `mt-1 text-[13px] text-secondary-foreground`, CTA-кнопка `mt-4` (если есть). На дашборде empty-state центрирован в рамке `rounded-lg border border-dashed border-border-strong py-10` — это рамка-плейсхолдер, а не «пустой экран с двумя элементами».

| Место | Иконка | Заголовок | Пояснение | CTA |
|---|---|---|---|---|
| Дашборд, «Мои страницы» | `ListTodo` | «У вас пока нет страниц» | «Создайте первую страницу, чтобы собрать списки покупок, задачи или планы в одном месте.» | primary «Создать страницу» |
| Дашборд, «Со мной поделились» | — (однострочный) | «С вами пока никто не поделился страницей» | — | — |
| Колонка без пунктов | — (компактный, `px-3 py-2`) | «Список пуст. Добавьте первый пункт ниже.» | — | — |
| ShareDialog, участники | `UserPlus` | «Пока нет участников» | «Найдите пользователя по никнейму Twitch, например: anna_plays» | — |
| ShareDialog, поиск без результата | `Search` | «Пользователь „speedrunner_lena“ не найден» | «Проверьте никнейм — пользователь должен хотя бы раз войти в Shared Lists.» | — |
| Профиль, ключи API | `Key` | «Ключи API не созданы» | «Создайте ключ, чтобы подключить бота или внешний скрипт.» | — |
| Публичная пустая колонка | — | «В этом списке пока нет пунктов» | — | — |

### 12.2 Loading

- **Skeleton**: `rounded-md bg-subtle animate-pulse` (карточки), строки — `rounded bg-subtle`. Скелетон повторяет геометрию контента: дашборд — сетка из 6 карточек (заголовок 60% ширины, две строки описания, строка футера); публичная страница — шапка (строка `h-7 w-64` + `h-4 w-96`) и 3 колонки по 5 строк `h-9`.
- **Spinner**: `Loader2 animate-spin`. Inline (кнопки) — 16px; центр секции — 20px `text-accent`; полноэкранный — 24px + подпись («Загружаем страницу…»).
- Полноэкранный loading используется только на первом входе на маршрут; все последующие обновления — молча через TanStack Query (staleTime 5 минут), без мелькания скелетонов.

### 12.3 Error

- **Поле формы**: красная рамка + `text-xs text-destructive` под полем (§10.2).
- **Секция**: `AlertCircle` 20px `text-destructive` + текст + `outline`-кнопка «Повторить» (refetch).
- **Страница 404 (публичная)**: центр экрана — `AlertCircle` 32px `text-muted-foreground`, «Страница не найдена» `text-base font-semibold`, «Ссылка могла быть удалена, а slug — изменён владельцем.» `text-sm text-secondary-foreground`, кнопка `outline` «Перейти ко входу».
- **Ошибки мутаций**: toast error (§10.17) + откат optimistic-состояния.

### 12.4 Hover-reveal (единый паттерн скрытых действий)

Применяется к: удаление PageCard, edit/delete пункта, drag-handle.

```
opacity-0 transition-opacity duration-150
group-hover:opacity-100
focus-visible:opacity-100
[@media(hover:none)]:opacity-100   /* на тач-устройствах видны всегда */
```

Родителю добавляется `group`. Скрытие только визуальное — элементы остаются в tab-порядке, поэтому `focus-visible` обязателен.

---

## 13. Контентные принципы

Интерфейс всегда наполнен правдоподобным контентом — в макетах, скриншотах, storybook, демо-данных и тестах.

### 13.1 Утверждённые примеры

| Сущность | Примеры |
|---|---|
| Страницы | «Поездка на дачу», «Релиз v2.0», «Свадьба 12 сентября», «Переезд в новый офис», «Подготовка к стрим-марафону» |
| Описания страниц | «Список покупок и вещей на выходные 25–26 июля», «Чек-лист выкатки: от фриза фич до поста в блоге» |
| Списки | «Купить», «Упаковать», «Документы», «Задачи», «Сделать до пятницы», «В день стрима» |
| Пункты | «Молоко 2л», «Паспорт», «Зарядка для телефона», «Картошка 5 кг», «Обновить оверлей „Начало стрима“», «Проверить звук на гостевом ПК», «Отправить приглашения гостям» |
| Пользователи | `streamer_max` (Максим), `anna_plays` (Анна), `dj_kotleta`, `mira_speedrun`, `boris_builds` |
| Public slug | `dacha-avgust`, `svadba-12-09`, `release-v2` |
| API-ключи | «Stream Bot», «OBS Overlay», scopes `pages:read` / `pages:write`; токен формата `shl_` + 32 hex-символа |
| Счётчики | «3/7», «12 пунктов», «2 участника» |
| Даты | Формат `d MMMM yyyy` в локали: «12 сентября», «3 марта 2026» (год добавляется, если не текущий) |

### 13.2 Запрещено

- Lorem Ipsum и любые бессмысленные строки («asdf», «test», «qwerty»).
- Выдуманные «системные» имена: «User 1», «Page 1», «Item 1», «Test page».
- Абстрактные числа: «999 items», «0/0», «1000000 просмотров».
- Фейковые домены и email в видимом контенте (допустимо только в placeholder поля email — `anna.plays@gmail.com` — как пример формата).
- Плейсхолдер-аватары со стоковыми лицами; допустимы letter-fallback и Twitch CDN URL вида `https://static-cdn.jtvnw.net/jtv_user_pictures/…`.

### 13.3 Язык

- Все строки — через i18n (`ru` / `en`), дефолтная локаль — из браузера, fallback — `en`. Переключатель — в профиле (§11.6).
- Примеры в этом документе даны на русском; английские эквиваленты обязаны сохранять смысл и длину ±30% (проверяется на узких кнопках и бейджах).
- Числа, даты и plurals — через ICU-форматтер i18n-библиотеки, не строковой конкатенацией («3 из 7 выполнено» ↔ «3 of 7 completed»).

---

## 14. Анимации и движение

Движение — только функциональное: подтвердить смену состояния, показать появление слоя, сопроводить drag. Декоративная анимация запрещена (пункт 10 запретов).

| Сценарий | Значение |
|---|---|
| Hover цветов/рамок/фона | `transition-colors duration-150 ease-out` (дефолт Tailwind) |
| Hover-reveal действий | `transition-opacity duration-150` |
| Hover-подъём карточки | появление `shadow-sm`, `duration-150`, без `translateY` и `scale` |
| Dialog/AlertDialog | overlay fade 150ms; контент — fade + `zoom-in-95` → 100, 200ms `ease-out` |
| DropdownMenu | fade + `slide-in-from-top-1`, 150ms |
| Toast | `slide-in-from-right` 200ms, fade-out 150ms |
| ProgressBar | `transition-[width] duration-300 ease-out` |
| Skeleton | `animate-pulse` (2s) |
| Spinner | `animate-spin` (1s linear infinite) |
| DnD | transform-перестановка соседей 200ms ease; overlay без анимации, следует за курсором |

- Easing по умолчанию — `ease-out`; `ease-in-out` не используется, spring/bounce — запрещены.
- Одновременно анимируется не более двух свойств (`colors` либо `opacity`/`transform`).
- `prefers-reduced-motion`: все переходы ≤ 0.01ms; skeleton становится статичным (`opacity-60` без pulse); спиннер остаётся (это индикатор процесса, а не декор); DnD-перестановки мгновенные.

---

## 15. Доступность

### 15.1 Focus-visible

Единый индикатор на всех интерактивных элементах:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
focus-visible:ring-offset-1 focus-visible:ring-offset-background
```

`ring` разрешён **только** как focus-индикатор (и `ring-accent/30` на фокусе инпутов). Класс `outline-none` без замены индикатора запрещён.

### 15.2 Контраст (проверяемые пары)

| Пара | Контраст | Требование |
|---|---|---|
| `--foreground` на `--background` / `--surface` (светлая) | 15.9:1 | ≥ 4.5:1 |
| `--secondary-foreground` на белом | 7.4:1 | ≥ 4.5:1 |
| `--muted-foreground` (stone-500) на белом | 4.6:1 | ≥ 4.5:1 — только caption/даты |
| `--accent` (green-700) на белом и на `--accent-subtle` | 4.9:1 | ≥ 4.5:1 |
| `--destructive` (red-600) на белом | 4.5:1 | ≥ 4.5:1 |
| Белый на `--accent-solid` (green-700) | 4.9:1 | ≥ 4.5:1 |
| Тёмная тема: `--foreground` на `--background` | 14.8:1 | ≥ 4.5:1 |
| Тёмная тема: `--accent` (green-400) на `--background` | 8.1:1 | ≥ 4.5:1 |

Декоративные рамки (`--border`) контрастом не нормируются — смысл всегда дублируется не цветом и не рамкой. Интерактивные рамки (`--input-border`, stone-400, ~2.9:1) подкрепляются обязательным focus-индикатором (4.9:1) и hover-изменением.

### 15.3 Клавиатура

- **Dialog/AlertDialog**: focus trap, `Escape` закрывает, фокус возвращается на триггер; начальный фокус — первое поле (Dialog) или кнопка «Отмена» (AlertDialog).
- **DropdownMenu**: стрелки вверх/вниз, `Home`/`End`, `Escape`, `typeahead` по первым буквам.
- **Tabs**: стрелки влево/вправо, активация автоматическая (`activationMode="automatic"`).
- **Checkbox**: `Space`; строка пункта не перехватывает клавиши.
- **DnD**: keyboard sensor — `Space` поднять/поставить, стрелки перемещают, `Escape` отменяет; drag-handle имеет `aria-roledescription="sortable"` и `aria-label`.
- **Inline-edit**: `Enter` — сохранить, `Escape` — отменить; вход в редактирование по double-click дублируется клавиатурным способом (пункт меню «Переименовать» / кнопка `Pencil`).

### 15.4 ARIA и семантика

- Все icon-only кнопки — локализованный `aria-label` («Удалить страницу», «Перетащить пункт», «Скопировать токен»).
- Role-бейджи и статусы — текстом (цвет не единственный носитель).
- ProgressBar: `role="progressbar"` + `aria-valuenow/-min/-max` + `aria-label="Прогресс списка Купить"`.
- Чекбокс пункта: `aria-label` = содержимому пункта («Молоко 2л»).
- Toast-регион: `aria-live="polite"` (error — `assertive` через настройки Sonner).
- Удаляющиеся строки: `aria-busy="true"` на время мутации.
- Колонки списков — `<section aria-label="Список Купить">`, пункты — `<ul>/<li>`.

### 15.5 Прочее

- Минимальный hit-area интерактивных элементов — 32×32px (визуально меньшие элементы, как чекбокс 16px, расширяются padding строки).
- `prefers-reduced-motion` — см. §14.
- Порядок фокуса совпадает с визуальным порядком; hover-reveal кнопки не выпадают из tab-последовательности (§12.4).
- Ошибки полей связаны с полями через `aria-describedby` + `aria-invalid="true"`.

---

## Приложение. Быстрая шпаргалка

```
Поверхности:  bg-background / bg-surface / bg-elevated / bg-subtle
Рамки:        border-border (декор) · border-strong (hover) · input-border (контролы)
Текст:        text-foreground / text-secondary-foreground / text-muted-foreground
Акцент:       accent (текст/рамки) · accent-solid (заливки) · accent-subtle (фоны)
Радиусы:      controls rounded-md · cards/dialogs rounded-lg · badges rounded · pills/avatars rounded-full
Тени:         shadow-none — везде; shadow-sm — hover карточек; shadow-md — floating-слои
Отступы:      карточки p-4 · диалоги p-5 · секции space-y-6 · сетки gap-4 · колонки gap-3
Контейнеры:   max-w-6xl (дашборд) · max-w-2xl (профиль) · max-w-5xl (публичная) · full (доска)
Фокус:        ring-2 ring-accent ring-offset-1
Запрещено:    gradients · backdrop-blur · glow · shadow-lg/xl/2xl · rounded-xl+ · p-8+ · lorem ipsum · эмодзи
```
