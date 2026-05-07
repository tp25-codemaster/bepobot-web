export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <a href="/" className="text-sm text-blue-600 hover:underline mb-8 inline-block">← Natrag na početnu</a>

        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Politika privatnosti</h1>
        <p className="text-sm text-gray-500 mb-8">Zadnja izmjena: travanj 2026.</p>

        <Section title="Tko prikuplja podatke">
          <p>Podatke prikuplja i obrađuje Tonko Puljiz, obrtnik (dalje: "BepoBot", "mi", "nas"). Za pitanja u vezi s privatnošću kontaktirajte nas na: <strong>[KONTAKT EMAIL]</strong>.</p>
        </Section>

        <Section title="Koje podatke prikupljamo">
          <ul>
            <li><strong>Podaci računa:</strong> e-mail adresa, ime</li>
            <li><strong>Gmail OAuth tokeni:</strong> access token i refresh token za čitanje booking e-mailova iz vašeg Gmail pretinca (ne čitamo ostale e-mailove)</li>
            <li><strong>Podaci apartmana:</strong> naziv, adresa, eVisitor kod objekta, WiFi i upute za goste</li>
            <li><strong>Podaci gostiju:</strong> ime, prezime, datum rođenja, broj putovnice/osobne iskaznice — isključivo za eVisitor prijavu, u skladu s Zakonom o ugostiteljskoj djelatnosti</li>
            <li><strong>eVisitor pristupni podaci:</strong> korisničko ime i lozinka za eVisitor sustav, pohranjeni šifrirano (AES-256-GCM)</li>
          </ul>
        </Section>

        <Section title="Zašto prikupljamo podatke">
          <ul>
            <li>Automatizacija prijave gostiju na eVisitor sustav Ministarstva turizma RH</li>
            <li>Parsiranje booking e-mailova za automatsko kreiranje rezervacija</li>
            <li>Slanje obavijesti i koordinacija čišćenja</li>
          </ul>
        </Section>

        <Section title="Koliko dugo čuvamo podatke">
          <p>Podatke čuvamo 2 godine od zadnje aktivnosti na računu. Nakon toga, sve osobne podatke trajno brišemo. Možete zatražiti brisanje u bilo koje vrijeme (vidi poglavlje "Vaša prava").</p>
        </Section>

        <Section title="Vaša prava (GDPR čl. 15–20)">
          <ul>
            <li><strong>Pravo na pristup (čl. 15):</strong> možete zatražiti kopiju svih podataka koje čuvamo o vama</li>
            <li><strong>Pravo na ispravak (čl. 16):</strong> možete ispraviti netočne podatke</li>
            <li><strong>Pravo na brisanje (čl. 17):</strong> možete zatražiti trajno brisanje svih vaših podataka</li>
            <li><strong>Pravo na prenosivost (čl. 20):</strong> možete zatražiti izvoz podataka u strojno čitljivom formatu</li>
            <li><strong>Pravo na prigovor (čl. 21):</strong> možete uložiti prigovor na obradu</li>
          </ul>
          <p className="mt-3">Za sva prava pišite na: <strong>[KONTAKT EMAIL]</strong>. Odgovaramo u roku 30 dana.</p>
        </Section>

        <Section title="Kolačići">
          <p>Koristimo isključivo tehnički nužne kolačiće (sesija, autentikacija). Ne koristimo analitičke niti marketinške kolačiće, niti pratimo korisnike između stranica.</p>
        </Section>

        <Section title="Dijeljenje podataka">
          <p>Ne prodajemo niti ne dijelimo vaše podatke trećim stranama, osim:</p>
          <ul>
            <li>Supabase (infrastruktura baze podataka, EU region)</li>
            <li>Ministarstvo turizma RH — eVisitor sustav (isključivo podaci gostiju potrebni za zakonsku prijavu)</li>
            <li>OpenRouter / Anthropic — isključivo anonimni sadržaj e-mailova za parsiranje, bez PII</li>
          </ul>
        </Section>

        <Section title="Kontakt">
          <p>Za sva pitanja u vezi s privatnošću: <strong>[KONTAKT EMAIL]</strong></p>
          <p>Imate pravo uložiti pritužbu nadležnom tijelu za zaštitu osobnih podataka (AZOP, Hrvatska).</p>
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
