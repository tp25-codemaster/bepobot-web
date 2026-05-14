#!/bin/bash
curl -s -X POST http://localhost:3000/api/bot-process-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer e63c2b564a33493f3a3fe2fb5b02eb53b1a6f8c74584e1f339c90f2f6848a585" \
  -d "{\"user_id\":\"5ec8ff19-02da-4c34-b34c-a59be8a97f2c\",\"gmail_message_id\":\"test-inquiry-luka-001\",\"email_from\":\"TP <tonkopuljiz01@gmail.com>\",\"email_subject\":\"Upit za apartman\",\"email_body\":\"Pozdrav,\\n\\nzanima me je li vaš apartman slobodan od 10. do 14. kolovoza 2026. za 2 odrasle osobe i jedno dijete.\\n\\nKolika je cijena po noći? Ima li privatni parking? Je li moguć early check-in oko 11h?\\n\\nHvala unaprijed,\\nLuka\",\"email_received_at\":\"2026-05-07T21:55:00Z\"}" | python3 -m json.tool 2>/dev/null || true
