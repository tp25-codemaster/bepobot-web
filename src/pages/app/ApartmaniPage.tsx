import { useState } from 'react'
import AppShell from '../../components/app/AppShell'

interface Apartment {
  id: string
  name: string
  wifi_ssid: string
  wifi_password: string
  parking: string
}

// Demo data
const DEMO_APARTMENTS: Apartment[] = [
  { id: '1', name: 'Apartman 1 - Centar', wifi_ssid: 'ApartmanNet', wifi_password: 'pass1234', parking: 'Ispred kuce, mjesto 3' },
  { id: '2', name: 'Apartman 2 - More', wifi_ssid: 'SeaView_WiFi', wifi_password: 'more2024', parking: 'Garaza, -1 kat' },
]

export default function ApartmaniPage() {
  const [apartments] = useState<Apartment[]>(DEMO_APARTMENTS)
  const [showForm, setShowForm] = useState(false)

  return (
    <AppShell title="Moji apartmani">
      <div className="p-4 space-y-3">
        {apartments.map(apt => (
          <div key={apt.id} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-text">{apt.name}</h3>
              <button className="text-xs text-primary font-medium">Uredi</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-text-muted">
                <span>📶</span>
                <span>{apt.wifi_ssid} / {apt.wifi_password}</span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <span>🅿️</span>
                <span>{apt.parking}</span>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full py-3 border-2 border-dashed border-border rounded-xl text-text-muted text-sm font-medium hover:border-primary hover:text-primary transition-colors"
        >
          + Dodaj apartman
        </button>

        {showForm && (
          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <input
              type="text"
              placeholder="Naziv apartmana"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <input
              type="text"
              placeholder="WiFi naziv"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <input
              type="text"
              placeholder="WiFi lozinka"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <input
              type="text"
              placeholder="Parking upute"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-lg">
                Spremi
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 bg-gray-100 text-text-muted text-sm font-medium rounded-lg"
              >
                Odustani
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
