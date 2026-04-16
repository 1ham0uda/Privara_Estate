import { useState } from 'react';

export function useAuthForm(initialEmail = '', initialPassword = '') {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = email.trim().length > 3 && password.length >= 6;

  return {
    email,
    setEmail,
    password,
    setPassword,
    submitting,
    setSubmitting,
    error,
    setError,
    isValid,
  };
}
