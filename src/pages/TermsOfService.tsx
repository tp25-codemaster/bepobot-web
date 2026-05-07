export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <a href="/" className="text-sm text-blue-600 hover:underline mb-8 inline-block">← Natrag na početnu</a>

        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Uvjeti korištenja</h1>
        <p className="text-sm text-gray-500 mb-8">Zadnja izmjena: travanj 2026.</p>

        <Section title="Opis usluge">
          <p>BepoBot je SaaS platforma koja automatizira svakodnevne operacije kratkoročnog iznajmljivanja apartmana: parsiranje booking e-mailova, prijavu gostiju na eVisitor sustav i koordinaciju čišćenja. Usluga se pruža putem web aplikacije na bepobot.hr.</p>
        </Section>

        <Section title="Prihvatanje uvjeta">
          <p>Korištenjem BepoBot usluge prihvaćate ove Uvjete korištenja. Ako se ne slažete s uvjetima, nemojte koristiti uslugu.</p>
        </Section>

        <Section title="Prihvatljiva upotreba">
          <p>Obvezujete se da nećete:</p>
          <ul>
            <li>Koristiti uslugu za nezakonite svrhe ili na način koji krši propise RH i EU</li>
            <li>Pokušati neovlašteno pristupiti sustavima ili podacima drugih korisnika</li>
            <li>Ometati rad usluge ili infrastrukture</li>
            <li>Preprodavati pristup usluzi bez pisane suglasnosti</li>
          </ul>
          <p className="mt-2">Usluga se smije koristiti isključivo za upravljanje apartmanima za koje imate zakonsko pravo obavljanja djelatnosti kratkoročnog iznajmljivanja.</p>
        </Section>

        <Section title="Plaćanje i pretplata">
          <ul>
            <li>Pretplata se naplaćuje unaprijed, mjesečno ili godišnje, ovisno o odabranom planu</li>
            <li>Cijene su iskazane s PDV-om gdje je primjenjivo</li>
            <li>Otkazivanje pretplate moguće je u bilo koje vrijeme — pristup ostaje aktivan do kraja plaćenog perioda</li>
            <li>Povrat sredstava nije moguć za već naplaćene periode, osim u slučajevima propisanim zakonom</li>
            <li>Zadržavamo pravo izmjene cijena uz prethodno obavještenje od 30 dana</li>
          </ul>
        </Section>

        <Section title="Ograničenje odgovornosti">
          <p>BepoBot se pruža "kao što jest". Ne jamčimo:</p>
          <ul>
            <li>Neprekidan ili bezgrešan rad usluge (ciljamo na 99.5% uptime, ali ne garantiramo)</li>
            <li>Da će automatska eVisitor prijava uspjeti u svim slučajevima (ovisno o dostupnosti eVisitor sustava MTO)</li>
            <li>Točnost parsiranja e-mailova u 100% slučajeva</li>
          </ul>
          <p className="mt-2">Ukupna odgovornost BepoBot-a prema korisniku ograničena je na iznos plaćene pretplate u posljednjih 3 mjeseca. Nismo odgovorni za indirektne, posljedične ili kaznene štete.</p>
          <p className="mt-2"><strong>Važno:</strong> Korisnik je odgovoran za zakonitu prijavu gostiju na eVisitor. BepoBot je alat koji pomaže u tom procesu, ali ne preuzima zakonsku odgovornost za ispunjavanje obveza iz Zakona o ugostiteljskoj djelatnosti.</p>
        </Section>

        <Section title="Intelektualno vlasništvo">
          <p>Sav kod, dizajn i sadržaj BepoBot platforme vlasništvo je Tonka Puljiza / BepoBot. Korisnici dobivaju ograničenu, neprenosivu licencu za korištenje usluge u svrhu za koju je namijenjena. Nije dopušteno kopiranje, modifikacija ili distribucija platforme bez pisane suglasnosti.</p>
        </Section>

        <Section title="Raskid ugovora">
          <p>Možete raskinuti ugovor otkazivanjem pretplate u bilo koje vrijeme. Mi možemo suspendirati ili ukinuti račun u slučaju kršenja ovih Uvjeta, neplaćanja ili sumnje na zloupotrebu, uz prethodno obavještenje gdje je moguće.</p>
        </Section>

        <Section title="Mjerodavno pravo">
          <p>Na ove Uvjete primjenjuje se pravo Republike Hrvatske. Za rješavanje sporova nadležni su sudovi u Republici Hrvatskoj. Potrošači imaju pravo na alternativno rješavanje sporova putem nadležnih tijela EU.</p>
        </Section>

        <Section title="Kontakt">
          <p>Za pitanja u vezi s uvjetima korištenja: <strong>[KONTAKT EMAIL]</strong></p>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">{title}</h2>
      <div className="text-gray-600 text-sm leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:space-y-1">{children}</div>
    </section>
  )
}
