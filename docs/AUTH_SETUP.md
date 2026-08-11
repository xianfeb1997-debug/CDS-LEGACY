# Authentication Setup

## Google OAuth

Local redirect URI:

```text
http://localhost:3000/api/auth/google/callback
```

Production redirect URI:

```text
https://yourdomain.com/api/auth/google/callback
```

Environment variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Email OTP

Use SMTP for manual email/password signup verification.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your_app_password_without_spaces
SMTP_FROM="Classroom Design Suite <your-email@gmail.com>"
AUTH_OTP_SECRET=change_this_long_random_secret
```

For Gmail, use an App Password instead of your normal Google password.
