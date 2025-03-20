import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthService from '../services/AuthService.js';
import { useTranslations } from '../hooks/useTranslations.js';
import styles from '../styles/auth.module.css';

const LoginPage = ({ lang = 'en' }) => {
  const { t } = useTranslations(lang);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await AuthService.login(email, password);
      navigate(`/${lang}/admin`); // Redirect to admin page after successful login
    } catch (err) {
      setError(t('login.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.login_container}>
      <h1>{t('login.title')}</h1>
      {error && <div className={styles.error_message}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className={styles.form_group}>
          <label htmlFor="email">{t('login.email')}</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className={styles.form_group}>
          <label htmlFor="password">{t('login.password')}</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <button type="submit" disabled={isLoading} className={styles.submit_button}>
          {isLoading ? t('login.form.submitting') : t('login.submit')}
        </button>
      </form>
      <div className={styles['auth-links']}>
        <Link to={`/${lang}/signup`}>{t('login.form.signupLink')}</Link>
      </div>
    </div>
  );
};

export default LoginPage;