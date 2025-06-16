// src/utils/fetchWithSession.js
export async function fetchWithSession(url, options = {}) {
  const finalOptions = {
    ...options, // Spreads all of options, including headers if present
    credentials: 'include', // Ensures credentials is set to 'include'
  };
  return fetch(url, finalOptions);
}
