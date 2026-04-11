export type MessageType = 'user' | 'bot-text' | 'bot-card' | 'bot-actions'

export interface CardField {
  icon: string
  label: string
  value: string
}

export interface ScenarioMessage {
  type: MessageType
  content?: string
  card?: {
    title: string
    fields: CardField[]
  }
  actions?: string[]
  delayMs: number
}

export interface Scenario {
  id: string
  name: string
  icon: string
  keywords: string[]
  messages: ScenarioMessage[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'reservation',
    name: 'Rezervacija',
    icon: '📋',
    keywords: ['rezervacija', 'dolaze', 'gosti', 'booking', 'apartman', 'noćenje', 'nocenje'],
    messages: [
      {
        type: 'user',
        content: 'Sutra dolaze Markovići u apartman 2, 4 gosta, odlaze u nedjelju',
        delayMs: 600,
      },
      {
        type: 'bot-card',
        card: {
          title: '✅ Rezervacija upisana!',
          fields: [
            { icon: '🏠', label: 'Apartman', value: 'Apartman 2' },
            { icon: '👥', label: 'Gosti', value: 'Marković (4 osobe)' },
            { icon: '📅', label: 'Termin', value: '20.06 → 25.06' },
            { icon: '💰', label: 'Cijena', value: '€480 (5 noći)' },
          ],
        },
        delayMs: 1200,
      },
      {
        type: 'bot-text',
        content: '🧹 Čistačica Marica obaviještena za 20.06 u 8:00.',
        delayMs: 800,
      },
      {
        type: 'bot-actions',
        actions: ['Pošalji check-in info', 'Pregled rasporeda', 'Dodaj napomenu'],
        delayMs: 400,
      },
    ],
  },
  {
    id: 'checkin',
    name: 'Check-in',
    icon: '🔑',
    keywords: ['check-in', 'checkin', 'posalji', 'pošalji', 'wifi', 'info', 'gost'],
    messages: [
      {
        type: 'user',
        content: 'Pošalji check-in info Marković obitelji',
        delayMs: 600,
      },
      {
        type: 'bot-text',
        content: '✅ Poslano! Gosti su dobili poruku na HR i EN:',
        delayMs: 1000,
      },
      {
        type: 'bot-card',
        card: {
          title: '📨 Check-in info — Apartman 2',
          fields: [
            { icon: '📶', label: 'WiFi', value: 'ApartNet / pass1234' },
            { icon: '🅿️', label: 'Parking', value: 'Ispred kuće, mjesta 3 i 4' },
            { icon: '🔑', label: 'Ključ', value: 'Kod na ulazu: 4821' },
            { icon: '📋', label: 'Check-out', value: 'Do 10h, ključ na recepciji' },
          ],
        },
        delayMs: 800,
      },
      {
        type: 'bot-actions',
        actions: ['Dodaj napomenu gostu', 'Pregled rasporeda'],
        delayMs: 400,
      },
    ],
  },
  {
    id: 'schedule',
    name: 'Raspored',
    icon: '📅',
    keywords: ['raspored', 'tjedan', 'danas', 'sutra', 'dolazak', 'odlazak', 'sto imam', 'što imam', 'pregled'],
    messages: [
      {
        type: 'user',
        content: 'Što imam ovaj tjedan?',
        delayMs: 600,
      },
      {
        type: 'bot-text',
        content: '📅 Raspored za ovaj tjedan:',
        delayMs: 1000,
      },
      {
        type: 'bot-card',
        card: {
          title: 'Ponedjeljak, 20.06',
          fields: [
            { icon: '🟢', label: 'Dolazak', value: 'Marković (4) → Apt 2' },
            { icon: '🧹', label: 'Čišćenje', value: 'Apt 2, 8:00 — Marica' },
          ],
        },
        delayMs: 600,
      },
      {
        type: 'bot-card',
        card: {
          title: 'Srijeda, 22.06',
          fields: [
            { icon: '🔴', label: 'Odlazak', value: 'Petrović (2) → Apt 1' },
            { icon: '🟢', label: 'Dolazak', value: 'Schmidt (3) → Apt 1' },
            { icon: '🧹', label: 'Čišćenje', value: 'Apt 1, 10:00 — Marica' },
          ],
        },
        delayMs: 600,
      },
      {
        type: 'bot-card',
        card: {
          title: 'Nedjelja, 25.06',
          fields: [
            { icon: '🔴', label: 'Odlazak', value: 'Marković (4) → Apt 2' },
          ],
        },
        delayMs: 400,
      },
      {
        type: 'bot-actions',
        actions: ['Dodaj rezervaciju', 'Obavijesti čistačicu', 'Pošalji check-in'],
        delayMs: 400,
      },
    ],
  },
  {
    id: 'campaign',
    name: 'Kampanja',
    icon: '📣',
    keywords: ['kampanja', 'last-minute', 'popust', 'termin', 'slobodan', 'email', 'slanje'],
    messages: [
      {
        type: 'user',
        content: 'Kampanja 14.08 17.08 15%',
        delayMs: 600,
      },
      {
        type: 'bot-text',
        content: '📣 Pripremam last-minute kampanju...',
        delayMs: 1200,
      },
      {
        type: 'bot-card',
        card: {
          title: '✅ Kampanja poslana!',
          fields: [
            { icon: '📅', label: 'Termin', value: '14.08 → 17.08 (3 noći)' },
            { icon: '💸', label: 'Popust', value: '15%' },
            { icon: '📧', label: 'Poslano', value: '23 bivša gosta' },
            { icon: '🚫', label: 'Preskočeno', value: '4 (Airbnb relay)' },
          ],
        },
        delayMs: 800,
      },
      {
        type: 'bot-text',
        content: 'Pratit ću odgovore i javiti vam kad netko pokaže interes.',
        delayMs: 600,
      },
    ],
  },
  {
    id: 'evisitor',
    name: 'eVisitor',
    icon: '🏛️',
    keywords: ['evisitor', 'e-visitor', 'prijava', 'turisti', 'policija', 'boravišna'],
    messages: [
      {
        type: 'user',
        content: 'Prijavi Markoviće na eVisitor, 4 gosta iz Hrvatske',
        delayMs: 600,
      },
      {
        type: 'bot-text',
        content: '🏛️ Šaljem prijavu na eVisitor sustav...',
        delayMs: 1400,
      },
      {
        type: 'bot-card',
        card: {
          title: '✅ eVisitor prijava uspješna!',
          fields: [
            { icon: '🏠', label: 'Apartman', value: 'Apartman 2' },
            { icon: '👥', label: 'Gosti', value: 'Marković (4 osobe)' },
            { icon: '🌍', label: 'Država', value: 'Hrvatska' },
            { icon: '📅', label: 'Boravak', value: '20.06 → 25.06' },
            { icon: '📋', label: 'Status', value: 'Prijavljeno ✓' },
          ],
        },
        delayMs: 800,
      },
      {
        type: 'bot-actions',
        actions: ['Pregled rasporeda', 'Nova prijava'],
        delayMs: 400,
      },
    ],
  },
  {
    id: 'askme',
    name: 'AI',
    icon: '🤖',
    keywords: ['pitaj', 'pomoc', 'pomoć', 'kako', 'zašto', 'što je', 'sto je', 'objasni', 'savjet', 'preporuci', 'cijena', 'sezona', 'recenzija', 'gost'],
    messages: [
      {
        type: 'user',
        content: 'Koji je najbolji period za podići cijene u Splitu?',
        delayMs: 600,
      },
      {
        type: 'bot-text',
        content: '📊 Na temelju podataka za Split i vašeg apartmana:',
        delayMs: 1200,
      },
      {
        type: 'bot-card',
        card: {
          title: '📈 Analiza cijena — Split',
          fields: [
            { icon: '🔥', label: 'Vrhunac sezone', value: '15.06 — 15.09' },
            { icon: '💰', label: 'Preporučena cijena', value: '€120-160/noć' },
            { icon: '📅', label: 'Najbolji mjesec', value: 'Srpanj (+35% vs. lipanj)' },
            { icon: '⚡', label: 'Brza popunjenost', value: 'Objavi do 01.03 za ljeto' },
          ],
        },
        delayMs: 800,
      },
      {
        type: 'bot-text',
        content: 'Vaš Apartman 2 je prošle godine imao 89% popunjenost u srpnju. Preporučam podići cijenu za 15% u odnosu na prošlu godinu.',
        delayMs: 1000,
      },
      {
        type: 'bot-actions',
        actions: ['Usporedi s konkurencijom', 'Postavi novu cijenu', 'Analiza za Dubrovnik'],
        delayMs: 400,
      },
    ],
  },
]

const FALLBACK_RESPONSE: ScenarioMessage[] = [
  {
    type: 'bot-text',
    content: 'Hmm, nisam siguran što želite. Evo što mogu:',
    delayMs: 800,
  },
  {
    type: 'bot-actions',
    actions: ['📋 Nova rezervacija', '📅 Raspored', '🔑 Check-in info', '🧹 Čišćenje', '📣 Kampanja', '🏛️ eVisitor', '🤖 AI'],
    delayMs: 400,
  },
]

export function matchScenario(input: string): Scenario | null {
  const normalized = input.toLowerCase().replace(/[čćžšđ]/g, (c) => {
    const map: Record<string, string> = { č: 'c', ć: 'c', ž: 'z', š: 's', đ: 'd' }
    return map[c] || c
  })

  for (const scenario of SCENARIOS) {
    for (const keyword of scenario.keywords) {
      const normalizedKeyword = keyword.toLowerCase().replace(/[čćžšđ]/g, (c) => {
        const map: Record<string, string> = { č: 'c', ć: 'c', ž: 'z', š: 's', đ: 'd' }
        return map[c] || c
      })
      if (normalized.includes(normalizedKeyword)) {
        return scenario
      }
    }
  }

  return null
}

export function getFallbackMessages(): ScenarioMessage[] {
  return FALLBACK_RESPONSE
}
