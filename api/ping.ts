export default function handler(_req: unknown, res: { status: (c: number) => { json: (d: unknown) => void } }) {
  res.status(200).json({ ok: true })
}
