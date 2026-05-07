import { sendWelcomeEmail } from '../src/lib/email.js';

interface VercelRequest {
  method?: string;
  body: {
    email?: string;
    name?: string;
  };
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { email, name } = req.body;

  if (!email || !name) {
    res.status(400).json({ error: 'Missing email or name in request body' });
    return;
  }

  try {
    // In a real application, you would typically:
    // 1. Validate the email and name.
    // 2. Hash the password (if applicable).
    // 3. Store the user in a database.
    // 4. Handle unique constraints (e.g., email already exists).
    // For this task, we will simulate a successful registration.

    console.log(`Registering user: ${name} (${email})`);

    // Simulate user creation in a database
    const userId = `user_${Date.now()}`; // Placeholder for a new user ID

    await sendWelcomeEmail(email, name);

    res.status(200).json({ message: 'User registered successfully and welcome email sent.', userId });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
}
