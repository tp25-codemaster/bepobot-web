import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(to: string, name: string) {
  try {
    await resend.emails.send({
      from: 'BepoBot <onboarding@bepobot.com>',
      to: to,
      subject: 'Dobrodošli u BepoBot!',
      html: `
        <p>Pozdrav ${name},</p>
        <p>Dobrodošli u BepoBot! Kako biste započeli, evo nekoliko koraka:</p>
        <ol>
          <li>Povežite svoj Gmail račun.</li>
          <li>Dodajte svoj apartman koristeći eVisitor kod.</li>
          <li>Unesite svoje eVisitor kredencijale.</li>
        </ol>
        <p>Ako imate bilo kakvih pitanja, slobodno nas kontaktirajte.</p>
        <p>Srdačan pozdrav,</p>
        <p>BepoBot tim</p>
      `,
    });
    console.log(`Welcome email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send welcome email to ${to}:`, error);
  }
}

export async function sendGuestCheckinConfirmation(to: string, guestName: string, apartmentName: string, checkinToken: string) {
  try {
    const checkinLink = `${process.env.FRONTEND_URL}/checkin/${checkinToken}`;
    await resend.emails.send({
      from: 'BepoBot <noreply@bepobot.com>',
      to: to,
      subject: 'Gost je ispunio checkin formu',
      html: `
        <p>Poštovani domaćine,</p>
        <p>Gost <strong>${guestName}</strong> je ispunio check-in formu za apartman <strong>${apartmentName}</strong>.</p>
        <p>Više detalja možete pronaći ovdje: <a href="${checkinLink}">${checkinLink}</a></p>
        <p>Srdačan pozdrav,</p>
        <p>BepoBot tim</p>
      `,
    });
    console.log(`Guest check-in confirmation email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send guest check-in confirmation email to ${to}:`, error);
  }
}

export async function sendEvisitorConfirmation(to: string, guestName: string, apartmentName: string) {
  try {
    await resend.emails.send({
      from: 'BepoBot <noreply@bepobot.com>',
      to: to,
      subject: 'Gost prijavljen na eVisitor',
      html: `
        <p>Poštovani domaćine,</p>
        <p>Gost <strong>${guestName}</strong> je uspješno prijavljen na eVisitor za apartman <strong>${apartmentName}</strong>.</p>
        <p>Srdačan pozdrav,</p>
        <p>BepoBot tim</p>
      `,
    });
    console.log(`eVisitor confirmation email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send eVisitor confirmation email to ${to}:`, error);
  }
}
