import { useState } from 'react'
import AppShell from '../../components/app/AppShell'

export default function EVisitorSettingsPage() {
  const [username, setUsername] = useState('')
  const [connected, setConnected] = useState(false)
  const [autoCheckin, setAutoCheckin] = useState(false)

  // Demo log entries
  const demoLog = [
    { guest: 'Markovic (4 osobe)', apt: 'Apartman 2', status: 'success' as const, date: '12.04.2026 14:22' },
    { guest: 'Schmidt (2 osobe)', apt: 'Apartman 1', status: 'success' as const, date: '10.04.2026 11:05' },
    { guest: 'Rossi (3 osobe)', apt: 'Apartman 2', status: 'error' as const, date: '08.04.2026 16:30' },
  ]

  return (
    <AppShell title="eVisitor">
      <div className="p-4 space-y-4">
        {/* Connection status */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">Povezivanje</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              connected
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {connected ? 'Povezano' : 'Nije povezano'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">eVisitor korisnicko ime</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Vase eVisitor korisnicko ime"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">eVisitor lozinka</label>
              <input
                type="password"
                placeholder="Vasa eVisitor lozinka"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <button
              onClick={() => setConnected(!connected)}
              className="w-full py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              {connected ? 'Odspoji' : 'Povezi se'}
            </button>
          </div>
        </div>

        {/* Auto check-in toggle */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-text text-sm">Automatska prijava gostiju</div>
              <div className="text-xs text-text-muted mt-0.5">
                Bot automatski prijavljuje goste na eVisitor pri novoj rezervaciji
              </div>
            </div>
            <button
              onClick={() => setAutoCheckin(!autoCheckin)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                autoCheckin ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                autoCheckin ? 'translate-x-5.5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* TAN info */}
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">📋</span>
            <div>
              <div className="font-semibold text-amber-800 text-sm">TAN lista</div>
              <div className="text-xs text-amber-700 mt-1">
                Kad bot zatrazi TAN broj, upisite ga u chat. Bot pamti koji je zadnji koristeni TAN.
              </div>
            </div>
          </div>
        </div>

        {/* Activity log */}
        <div className="bg-white rounded-xl border border-border p-4">
          <h3 className="font-semibold text-text mb-3">Zadnje prijave</h3>
          <div className="space-y-2">
            {demoLog.map((entry, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium text-text">{entry.guest}</div>
                  <div className="text-xs text-text-muted">{entry.apt} · {entry.date}</div>
                </div>
                <span className={`text-xs font-medium ${
                  entry.status === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {entry.status === 'success' ? 'Uspjeh' : 'Greska'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
