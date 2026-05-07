export const BRAND = {
  name: 'BepoBot',
  tagline: { hr: 'Vaš apartman radi dok vi uživate.', en: 'Your apartment works while you enjoy.' },
  subtitle: {
    hr: 'AI asistent koji automatizira rezervacije, koordinira čišćenje i brine o gostima — sve putem jedne poruke.',
    en: 'AI assistant that automates bookings, coordinates cleaning and takes care of guests — all through one message.',
  },
  email: 'info@bepobot.hr',
  company: 'Noēsiss',
} as const

export const NAV_LINKS = [
  { label: { hr: 'Značajke', en: 'Features' }, href: '#features' },
  { label: { hr: 'Kako radi', en: 'How it works' }, href: '#how-it-works' },
  { label: { hr: 'Cijene', en: 'Pricing' }, href: '#pricing' },
  { label: { hr: 'FAQ', en: 'FAQ' }, href: '#faq' },
] as const

export const STATS = [
  { value: '22h', label: { hr: 'uštede tjedno', en: 'saved weekly' } },
  { value: '3 min', label: { hr: 'do check-in infoa', en: 'to check-in info' } },
  { value: '0€', label: { hr: 'ekstra osoblja', en: 'extra staff' } },
] as const

export const PROBLEMS = [
  {
    icon: '📧',
    title: { hr: 'Inbox koji nikad ne staje', en: 'An inbox that never stops' },
    description: {
      hr: 'Upiti, potvrde, WiFi lozinke... svaki gost pita isto, vi svaki put odgovarate ručno.',
      en: 'Inquiries, confirmations, WiFi passwords... every guest asks the same thing, you answer manually every time.',
    },
  },
  {
    icon: '🧹',
    title: { hr: 'Koordinacija čišćenja', en: 'Cleaning coordination' },
    description: {
      hr: 'Zaboravite obavijestiti čistačicu jednom i imate problem s gostima.',
      en: 'Forget to notify the cleaner once and you have a problem with guests.',
    },
  },
  {
    icon: '📅',
    title: { hr: 'Praćenje rasporeda', en: 'Tracking the schedule' },
    description: {
      hr: 'Sve u Excelu ili u glavi. Jedan propust = loša recenzija.',
      en: 'Everything in Excel or in your head. One mistake = a bad review.',
    },
  },
  {
    icon: '💸',
    title: { hr: 'Slobodni termini = izgubljeni novac', en: 'Empty dates = lost money' },
    description: {
      hr: 'Prazan termin koji se ne popunjava. Kontaktirati bivše goste ručno traje satima.',
      en: 'Empty dates that stay empty. Contacting past guests manually takes hours.',
    },
  },
] as const

export const FEATURES = [
  {
    icon: '📋',
    title: { hr: 'Upis rezervacija', en: 'Booking entry' },
    description: {
      hr: 'Jedna poruka i rezervacija je upisana, kalendar ažuriran.',
      en: 'One message and the booking is logged, calendar updated.',
    },
    example: 'Sutra dolaze 4 gosta u Apt 2, Horvat, odlaze u nedjelju',
  },
  {
    icon: '🧹',
    title: { hr: 'Koordinacija čišćenja', en: 'Cleaning coordination' },
    description: {
      hr: 'Automatska obavijest čistačici — koji apartman, kad, napomene.',
      en: 'Automatic notification to the cleaner — which apartment, when, notes.',
    },
    example: 'Javi Marici da dođe u petak u Apt 3 ujutro',
  },
  {
    icon: '🔑',
    title: { hr: 'Check-in za goste', en: 'Guest check-in' },
    description: {
      hr: 'Gost automatski dobiva WiFi, parking, pravila — na HR i EN.',
      en: 'Guest automatically receives WiFi, parking, rules — in HR and EN.',
    },
    example: 'Pošalji check-in info Horvat obitelji',
  },
  {
    icon: '📅',
    title: { hr: 'Pregled rasporeda', en: 'Schedule overview' },
    description: {
      hr: 'Pitajte bota i dobijete pregledan popis dolazaka i odlazaka.',
      en: 'Ask the bot and get a clear list of arrivals and departures.',
    },
    example: 'Što imam ovaj tjedan?',
  },
  {
    icon: '📣',
    title: { hr: 'Last-minute kampanje', en: 'Last-minute campaigns' },
    description: {
      hr: 'Slobodan termin? Jednom porukom šaljete ponudu bivšim gostima.',
      en: 'Free dates? One message and you send an offer to past guests.',
    },
    example: 'Kampanja 14.08 17.08 15%',
  },
  {
    icon: '🏛️',
    title: { hr: 'eVisitor prijava', en: 'eVisitor registration' },
    description: {
      hr: 'Bot pripremi sve, vi samo upišete TAN — 10 sekundi umjesto 5 minuta.',
      en: 'Bot prepares everything, you just enter the TAN — 10 seconds instead of 5 minutes.',
    },
    example: '"Prijavi Markoviće na eVisitor" → bot: "Trebam TAN #47" → "284619" → ✅',
  },
  {
    icon: '⏰',
    title: { hr: 'Jutarnji pregled', en: 'Morning summary' },
    description: {
      hr: 'Svako jutro u 8h sažetak — tko dolazi, odlazi, što pripremiti.',
      en: 'Every morning at 8am a summary — who is arriving, departing, what to prepare.',
    },
    example: 'Automatski, svaki dan u 08:00h',
  },
] as const

export const STEPS = [
  {
    number: '01',
    title: { hr: 'Registrirajte se', en: 'Sign up' },
    description: {
      hr: 'Kreirajte account i instalirajte app na mobitel.',
      en: 'Create an account and install the app on your phone.',
    },
  },
  {
    number: '02',
    title: { hr: 'Razgovarajte s botom', en: 'Chat with the bot' },
    description: {
      hr: 'BepoBot vas vodi kroz postavljanje apartmana, kontakata i pravila — kroz razgovor, ne forme.',
      en: 'BepoBot guides you through setting up apartments, contacts and rules — through conversation, not forms.',
    },
  },
  {
    number: '03',
    title: { hr: 'Koristite svaki dan', en: 'Use it every day' },
    description: {
      hr: 'Od prvog dana uštedite 20+ sati tjedno. Bot radi 24/7.',
      en: 'From day one save 20+ hours a week. The bot works 24/7.',
    },
  },
] as const

export const TESTIMONIALS = [
  {
    name: 'Ivan K.',
    detail: '3 apartmana, Split',
    quote: {
      hr: 'BepoBot mi je vratio vikende.',
      en: 'BepoBot gave me my weekends back.',
    },
  },
  {
    name: 'Marina D.',
    detail: '1 apartman, Dubrovnik',
    quote: {
      hr: 'Gosti su oduševljeni check-in porukama. Recenzije su skočile.',
      en: 'Guests love the check-in messages. Reviews went up.',
    },
  },
  {
    name: 'Ante P.',
    detail: 'agencija, Zadar',
    quote: {
      hr: 'Za 8 apartmana je ovo game changer.',
      en: 'For 8 apartments this is a game changer.',
    },
  },
] as const

export const PRICING_PLANS = [
  {
    name: 'Starter',
    price: 89,
    period: { hr: '/mj', en: '/mo' },
    description: { hr: '1 apartman', en: '1 apartment' },
    highlighted: false,
    features: [
      { text: { hr: 'BepoBot chat app', en: 'BepoBot chat app' }, included: true },
      { text: { hr: 'Upis i pregled rezervacija', en: 'Booking entry & overview' }, included: true },
      { text: { hr: 'Automatski check-in za goste', en: 'Automatic guest check-in' }, included: true },
      { text: { hr: 'Jutarnji pregled rasporeda', en: 'Morning schedule summary' }, included: true },
      { text: { hr: 'eVisitor automatska prijava', en: 'eVisitor auto-registration' }, included: false },
      { text: { hr: 'Last-minute kampanje', en: 'Last-minute campaigns' }, included: false },
      { text: { hr: 'Koordinacija čišćenja', en: 'Cleaning coordination' }, included: false },
    ],
  },
  {
    name: 'Pro',
    price: 149,
    period: { hr: '/mj', en: '/mo' },
    description: { hr: 'do 5 apartmana', en: 'up to 5 apartments' },
    highlighted: true,
    badge: { hr: 'NAJPOPULARNIJE', en: 'MOST POPULAR' },
    features: [
      { text: { hr: 'Sve iz Startera', en: 'Everything in Starter' }, included: true },
      { text: { hr: 'eVisitor automatska prijava/odjava gostiju', en: 'eVisitor auto check-in/out' }, included: true },
      { text: { hr: 'Last-minute kampanje emailom', en: 'Last-minute email campaigns' }, included: true },
      { text: { hr: 'Koordinacija čišćenja', en: 'Cleaning coordination' }, included: true },
      { text: { hr: 'Do 5 apartmana', en: 'Up to 5 apartments' }, included: true },
    ],
  },
  {
    name: 'Business',
    price: 299,
    period: { hr: '/mj', en: '/mo' },
    description: { hr: 'agencije i hoteli', en: 'agencies & hotels' },
    highlighted: false,
    features: [
      { text: { hr: 'Sve iz Pro', en: 'Everything in Pro' }, included: true },
      { text: { hr: 'Neograničen broj apartmana', en: 'Unlimited apartments' }, included: true },
      { text: { hr: 'Booking.com / Airbnb sync', en: 'Booking.com / Airbnb sync' }, included: true },
      { text: { hr: 'Prilagodba na vaš brend', en: 'Custom branding' }, included: true },
      { text: { hr: 'Dedicirani account manager', en: 'Dedicated account manager' }, included: true },
    ],
  },
] as const

export const FAQ_ITEMS = [
  {
    question: { hr: 'Trebam li biti tehničan?', en: 'Do I need to be technical?' },
    answer: {
      hr: 'Ne. Postavljanje ide kroz razgovor s botom — kao da pišete prijatelju.',
      en: 'No. Setup happens through a conversation with the bot — like writing to a friend.',
    },
  },
  {
    question: { hr: 'Je li ovo app ili web stranica?', en: 'Is this an app or a website?' },
    answer: {
      hr: 'Oboje! Instalirajte na mobitel kao app ili koristite u browseru.',
      en: 'Both! Install on your phone as an app or use it in the browser.',
    },
  },
  {
    question: {
      hr: 'Može li bot razgovarati s mojim gostima direktno?',
      en: 'Can the bot talk to my guests directly?',
    },
    answer: {
      hr: 'Da! Check-in poruke se šalju automatski.',
      en: 'Yes! Check-in messages are sent automatically.',
    },
  },
  {
    question: {
      hr: 'Što ako imam apartmane na različitim lokacijama?',
      en: 'What if I have apartments in different locations?',
    },
    answer: {
      hr: 'Nema problema — svaki apartman ima svoje podatke.',
      en: 'No problem — each apartment has its own data.',
    },
  },
  {
    question: { hr: 'Na kojem jeziku bot komunicira?', en: 'What language does the bot use?' },
    answer: { hr: 'Hrvatski i engleski.', en: 'Croatian and English.' },
  },
  {
    question: { hr: 'Kako radi eVisitor integracija?', en: 'How does eVisitor integration work?' },
    answer: {
      hr: 'BepoBot pripremi sve podatke za prijavu automatski. Jedino što vi trebate je upisati TAN broj s vaše liste kad bot zatraži — 10 sekundi umjesto 5 minuta ručnog unosa.',
      en: 'BepoBot prepares all registration data automatically. All you need to do is enter the TAN number from your list when the bot asks — 10 seconds instead of 5 minutes of manual entry.',
    },
  },
  {
    question: { hr: 'Jesu li moji eVisitor podaci sigurni?', en: 'Is my eVisitor data safe?' },
    answer: {
      hr: 'Da. Vaši podaci su enkriptirani i pohranjeni sigurno. Nikad ih ne dijelimo s trećim stranama.',
      en: 'Yes. Your data is encrypted and stored securely. We never share it with third parties.',
    },
  },
  {
    question: { hr: 'Mogu li otkazati kad želim?', en: 'Can I cancel anytime?' },
    answer: { hr: 'Da, bez kazne, bez ugovorne obveze.', en: 'Yes, no penalty, no contract.' },
  },
] as const
