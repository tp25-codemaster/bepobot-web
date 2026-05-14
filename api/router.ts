import type { VercelRequest, VercelResponse } from '@vercel/node'

import botChat from './_handlers/bot-chat.js'
import botCheckin from './_handlers/bot-checkin.js'
import botGmailPoll from './_handlers/bot-gmail-poll.js'
import botProcessEmail from './_handlers/bot-process-email.js'
import botReservations from './_handlers/bot-reservations.js'
import botTelegramResolve from './_handlers/bot-telegram-resolve.js'
import cronIcalSync from './_handlers/cron-ical-sync.js'
import evisitorCheckin from './_handlers/evisitor-checkin.js'
import evisitorConnect from './_handlers/evisitor-connect.js'
import evisitorDisconnect from './_handlers/evisitor-disconnect.js'
import evisitorFindContacts from './_handlers/evisitor-find-contacts.js'
import evisitorImport from './_handlers/evisitor-import.js'
import gmailCallback from './_handlers/gmail-callback.js'
import gmailConnect from './_handlers/gmail-connect.js'
import gmailDisconnect from './_handlers/gmail-disconnect.js'
import gmailRefresh from './_handlers/gmail-refresh.js'
import gmailWatch from './_handlers/gmail-watch.js'
import gmailWebhook from './_handlers/gmail-webhook.js'
import icalExport from './_handlers/ical-export.js'
import ping from './_handlers/ping.js'
import refreshGmailToken from './_handlers/refresh-gmail-token.js'
import registerUser from './_handlers/register-user.js'
import reservationCheckin from './_handlers/reservation-checkin.js'
import reservationPublic from './_handlers/reservation-public.js'
import reservationSubmit from './_handlers/reservation-submit.js'
import sendEmail from './_handlers/send-email.js'
import syncIcal from './_handlers/sync-ical.js'
import jobsEnqueue from './_handlers/jobs/enqueue.js'
import jobsEvisitorImportWorker from './_handlers/jobs/evisitor-import-worker.js'
import jobsProcessBookingEmail from './_handlers/jobs/process-booking-email.js'
import jobsRefreshGmailTokens from './_handlers/jobs/refresh-gmail-tokens.js'
import jobsStatus from './_handlers/jobs/status.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: any, res: any) => unknown

const routes: Record<string, Handler> = {
  'bot-chat': botChat,
  'bot-checkin': botCheckin,
  'bot-gmail-poll': botGmailPoll,
  'bot-process-email': botProcessEmail,
  'bot-reservations': botReservations,
  'bot-telegram-resolve': botTelegramResolve,
  'cron-ical-sync': cronIcalSync,
  'evisitor-checkin': evisitorCheckin,
  'evisitor-connect': evisitorConnect,
  'evisitor-disconnect': evisitorDisconnect,
  'evisitor-find-contacts': evisitorFindContacts,
  'evisitor-import': evisitorImport,
  'gmail-callback': gmailCallback,
  'gmail-connect': gmailConnect,
  'gmail-disconnect': gmailDisconnect,
  'gmail-refresh': gmailRefresh,
  'gmail-watch': gmailWatch,
  'gmail-webhook': gmailWebhook,
  'ical-export': icalExport,
  'ping': ping,
  'refresh-gmail-token': refreshGmailToken,
  'register-user': registerUser,
  'reservation-checkin': reservationCheckin,
  'reservation-public': reservationPublic,
  'reservation-submit': reservationSubmit,
  'send-email': sendEmail,
  'sync-ical': syncIcal,
  'jobs/enqueue': jobsEnqueue,
  'jobs/evisitor-import-worker': jobsEvisitorImportWorker,
  'jobs/process-booking-email': jobsProcessBookingEmail,
  'jobs/refresh-gmail-tokens': jobsRefreshGmailTokens,
  'jobs/status': jobsStatus,
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url ?? ''
  const path = url.replace(/^\/api\//, '').split('?')[0]

  const route = routes[path]
  if (!route) {
    return res.status(404).json({ error: 'Not found', path })
  }
  return route(req, res)
}
