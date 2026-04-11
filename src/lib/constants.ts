export const BRAND = {
  name: 'BepoBot',
  tagline: 'Vaš apartman radi dok vi uživate.',
  subtitle: 'AI asistent koji automatizira rezervacije, koordinira čišćenje i brine o gostima — sve putem jedne poruke.',
  email: 'info@bepobot.hr',
  company: 'Noēsiss',
} as const

export const NAV_LINKS = [
  { label: 'Značajke', href: '#features' },
  { label: 'Kako radi', href: '#how-it-works' },
  { label: 'Cijene', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
] as const

export const STATS = [
  { value: '22h', label: 'uštede tjedno' },
  { value: '3 min', label: 'do check-in infoa' },
  { value: '0€', label: 'ekstra osoblja' },
] as const

export const PROBLEMS = [
  {
    icon: '📧',
    title: 'Inbox koji nikad ne staje',
    description: 'Upiti, potvrde, WiFi lozinke... svaki gost pita isto, vi svaki put odgovarate ručno.',
  },
  {
    icon: '🧹',
    title: 'Koordinacija čišćenja',
    description: 'Zaboravite obavijestiti čistačicu jednom i imate problem s gostima.',
  },
  {
    icon: '📅',
    title: 'Praćenje rasporeda',
    description: 'Sve u Excelu ili u glavi. Jedan propust = loša recenzija.',
  },
  {
    icon: '💸',
    title: 'Slobodni termini = izgubljeni novac',
    description: 'Prazan termin koji se ne popunjava. Kontaktirati bivše goste ručno traje satima.',
  },
] as const

export const FEATURES = [
  {
    icon: '📋',
    title: 'Upis rezervacija',
    description: 'Jedna poruka i rezervacija je upisana, kalendar ažuriran.',
    example: 'Sutra dolaze 4 gosta u Apt 2, Horvat, odlaze u nedjelju',
  },
  {
    icon: '🧹',
    title: 'Koordinacija čišćenja',
    description: 'Automatska obavijest čistačici — koji apartman, kad, napomene.',
    example: 'Javi Marici da dođe u petak u Apt 3 ujutro',
  },
  {
    icon: '🔑',
    title: 'Check-in za goste',
    description: 'Gost automatski dobiva WiFi, parking, pravila — na HR i EN.',
    example: 'Pošalji check-in info Horvat obitelji',
  },
  {
    icon: '📅',
    title: 'Pregled rasporeda',
    description: 'Pitajte bota i dobijete pregledan popis dolazaka i odlazaka.',
    example: 'Što imam ovaj tjedan?',
  },
  {
    icon: '📣',
    title: 'Last-minute kampanje',
    description: 'Slobodan termin? Jednom porukom šaljete ponudu bivšim gostima.',
    example: 'Kampanja 14.08 17.08 15%',
  },
  {
    icon: '🏛️',
    title: 'eVisitor prijava',
    description: 'Bot pripremi sve, vi samo upišete TAN — 10 sekundi umjesto 5 minuta.',
    example: '"Prijavi Markoviće na eVisitor" → bot: "Trebam TAN #47" → "284619" → ✅',
  },
  {
    icon: '⏰',
    title: 'Jutarnji pregled',
    description: 'Svako jutro u 8h sažetak — tko dolazi, odlazi, što pripremiti.',
    example: 'Automatski, svaki dan u 08:00h',
  },
] as const

export const STEPS = [
  {
    number: '01',
    title: 'Registrirajte se',
    description: 'Kreirajte account i instalirajte app na mobitel.',
  },
  {
    number: '02',
    title: 'Razgovarajte s botom',
    description: 'BepoBot vas vodi kroz postavljanje apartmana, kontakata i pravila — kroz razgovor, ne forme.',
  },
  {
    number: '03',
    title: 'Koristite svaki dan',
    description: 'Od prvog dana uštedite 20+ sati tjedno. Bot radi 24/7.',
  },
] as const

export const TESTIMONIALS = [
  {
    name: 'Ivan K.',
    detail: '3 apartmana, Split',
    quote: 'BepoBot mi je vratio vikende.',
  },
  {
    name: 'Marina D.',
    detail: '1 apartman, Dubrovnik',
    quote: 'Gosti su oduševljeni check-in porukama. Recenzije su skočile.',
  },
  {
    name: 'Ante P.',
    detail: 'agencija, Zadar',
    quote: 'Za 8 apartmana je ovo game changer.',
  },
] as const

export const PRICING_PLANS = [
  {
    name: 'Starter',
    price: 89,
    period: '/mj',
    description: '1 apartman',
    highlighted: false,
    features: [
      { text: 'BepoBot chat app', included: true },
      { text: 'Upis i pregled rezervacija', included: true },
      { text: 'Automatski check-in za goste', included: true },
      { text: 'Jutarnji pregled rasporeda', included: true },
      { text: 'eVisitor automatska prijava', included: false },
      { text: 'Last-minute kampanje', included: false },
      { text: 'Koordinacija čišćenja', included: false },
    ],
  },
  {
    name: 'Pro',
    price: 149,
    period: '/mj',
    description: 'do 5 apartmana',
    highlighted: true,
    badge: 'NAJPOPULARNIJE',
    features: [
      { text: 'Sve iz Startera', included: true },
      { text: 'eVisitor automatska prijava/odjava gostiju', included: true },
      { text: 'Last-minute kampanje emailom', included: true },
      { text: 'Koordinacija čišćenja', included: true },
      { text: 'Do 5 apartmana', included: true },
    ],
  },
  {
    name: 'Business',
    price: 299,
    period: '/mj',
    description: 'agencije i hoteli',
    highlighted: false,
    features: [
      { text: 'Sve iz Pro', included: true },
      { text: 'Neograničen broj apartmana', included: true },
      { text: 'Booking.com / Airbnb sync', included: true },
      { text: 'Prilagodba na vaš brend', included: true },
      { text: 'Dedicirani account manager', included: true },
    ],
  },
] as const

export const FAQ_ITEMS = [
  {
    question: 'Trebam li biti tehničan?',
    answer: 'Ne. Postavljanje ide kroz razgovor s botom — kao da pišete prijatelju.',
  },
  {
    question: 'Je li ovo app ili web stranica?',
    answer: 'Oboje! Instalirajte na mobitel kao app ili koristite u browseru.',
  },
  {
    question: 'Može li bot razgovarati s mojim gostima direktno?',
    answer: 'Da! Check-in poruke se šalju automatski.',
  },
  {
    question: 'Što ako imam apartmane na različitim lokacijama?',
    answer: 'Nema problema — svaki apartman ima svoje podatke.',
  },
  {
    question: 'Na kojem jeziku bot komunicira?',
    answer: 'Hrvatski i engleski.',
  },
  {
    question: 'Kako radi eVisitor integracija?',
    answer: 'BepoBot pripremi sve podatke za prijavu automatski. Jedino što vi trebate je upisati TAN broj s vaše liste kad bot zatraži — 10 sekundi umjesto 5 minuta ručnog unosa.',
  },
  {
    question: 'Jesu li moji eVisitor podaci sigurni?',
    answer: 'Da. Vaši podaci su enkriptirani i pohranjeni sigurno. Nikad ih ne dijelimo s trećim stranama.',
  },
  {
    question: 'Mogu li otkazati kad želim?',
    answer: 'Da, bez kazne, bez ugovorne obveze.',
  },
] as const
