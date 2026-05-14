#!/bin/bash
curl -s -X POST http://localhost:3000/api/bot-process-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer e63c2b564a33493f3a3fe2fb5b02eb53b1a6f8c74584e1f339c90f2f6848a585" \
  -d "{\"user_id\":\"5ec8ff19-02da-4c34-b34c-a59be8a97f2c\",\"gmail_message_id\":\"test-003\",\"email_from\":\"noreply@booking.com\",\"email_subject\":\"Reservation confirmation – Johnny Smith – Panorama\",\"email_body\":\"Dear Host, You have a new reservation. Guest name: Johnny Smith. Property: Panorama. Check-in: 15 May 2026. Check-out: 18 May 2026. Guests: 2 adults. Total: EUR 270.00. Booking reference: BK-TEST-001.\",\"email_received_at\":\"2026-05-07T22:54:00Z\"}"
