<script setup lang="ts">
import { PRIVACY_CONTACT } from '../../data/privacyLink'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'

// The privacy policy (ticket 0082; SignIn card, Privacy policy page). English only, the owner's choice: a legal text
// they can check themselves. It says only what is live; each later feature (sync, email links, Pro) adds its part.
defineProps<{ homepage: string }>()
const { t, locale } = useI18n()
</script>

<template>
  <main class="privacy" lang="en" data-testid="privacy-policy">
    <article class="privacy__text">
      <p v-if="locale !== 'en'" class="privacy__language" :lang="locale" data-testid="privacy-english-only">{{ t.privacy.englishOnly }}</p>
      <h1 class="privacy__title">Privacy policy</h1>
      <p class="privacy__meta">openbeads.com · Last updated 20 November 2026</p>

      <h2>In short</h2>
      <ul>
        <li>openbeads works without an account. Your Projects and settings stay in your browser, on your device.</li>
        <li>An account is optional. It keeps your email address and two settings, so they are the same on all your devices.</li>
        <li>No ads, no analytics, no tracking, no selling of data.</li>
        <li>You can delete your account at any time, from the app.</li>
      </ul>

      <h2>Who is responsible</h2>
      <p>
        openbeads is a small independent project. For anything about your data, write to
        <a :href="`mailto:${PRIVACY_CONTACT}`" data-testid="privacy-contact">{{ PRIVACY_CONTACT }}</a>.
      </p>

      <h2>Without an account</h2>
      <p>
        Your Projects, your Palette, your settings and every preference are kept by your browser on your device, and are
        never sent to openbeads. The app works with no account and with no internet. Once you have work saved, it asks your
        browser to keep this data and not clear it to save space; the browser decides. Deleting your browser's data for openbeads.com deletes it.
      </p>

      <h2>With an account</h2>
      <p>You sign in with Google. openbeads asks Google for your email address only, and keeps:</p>
      <ul>
        <li>your verified email address;</li>
        <li>Google's id for your account, so you are still found if your address changes;</li>
        <li>your plan (Free) and the date the account was made;</li>
        <li>two settings kept in step: language and theme, each with the time it was last changed.</li>
      </ul>
      <p>
        openbeads does not keep your name, your picture or any Google token. Your Projects stay on your device: they are
        not sent with an account.
      </p>
      <p>
        When you sign in, your device gets a random session id in a cookie. openbeads keeps only a hash of it, the account
        it belongs to, and when it started and ends: 90 days after you signed in. No IP address and no device details are
        kept with it. Signing out ends the session on that device. If a settings change can't be sent because you are
        offline, it waits on your device and is sent when it can be. Nothing else is ever sent later. When openbeads' server
        can't be reached, nothing on your device is lost.
      </p>

      <h2>Cookies and browser storage</h2>
      <p>openbeads sets no cookies unless you sign in, and none for advertising or analytics. Signing in uses two:</p>
      <ul>
        <li>a sign-in cookie that lasts 10 minutes, while you are at Google;</li>
        <li>the session cookie, for 90 days or until you sign out.</li>
      </ul>
      <p>Everything else the app remembers is in your browser's storage on your device and is not sent anywhere.</p>

      <h2>Feedback</h2>
      <p>
        If you send feedback from the app, what you write, the email address you add (only if you choose to) and the app's
        version, language, browser, operating system and window size become an issue in a private GitHub repository that
        only the maintainer reads. Write to us to have a report deleted.
      </p>

      <h2>Keeping the service safe</h2>
      <p>
        Signing in and sending feedback pass Cloudflare Turnstile, a check that you are a person. The number of requests
        from one IP address is limited for a short time, to stop abuse. openbeads' databases keep no IP address. Like any
        website, the hosting provider handles your IP address and the request to deliver the page, and Cloudflare's
        request logs hold them for a few days.
      </p>

      <h2>Services that see personal data</h2>
      <ul>
        <li><strong>Cloudflare</strong>: hosts the site and the account database, and runs Turnstile and the security checks.</li>
        <li><strong>Google</strong>: signs you in.</li>
        <li><strong>GitHub</strong>: holds feedback reports, and the weekly encrypted backups, which it cannot read.</li>
      </ul>
      <p>These services may process data outside your country, under their own safeguards.</p>

      <h2>Backups</h2>
      <p>
        The account database can be restored to any point in the last 7 days, and a copy encrypted with a key only the
        maintainer holds is made each week and kept for 28 days. So a deleted account is gone from every backup within four
        weeks.
      </p>

      <h2>Deleting your account</h2>
      <p>
        In the app, open the Menu and choose Delete account. Your account, its settings and its sessions are deleted at
        once, and every device is signed out. Your Projects are not touched: they were never on openbeads' side. You can
        also write to us.
      </p>

      <h2>Why and your rights</h2>
      <p>
        The account is kept to give you the service you asked for, and only while you have it. The security checks and
        feedback rely on openbeads' legitimate interest in a working, safe service. You can ask to see, correct, download or
        delete your data, or object to how it is used, by writing to
        <a :href="`mailto:${PRIVACY_CONTACT}`">{{ PRIVACY_CONTACT }}</a>. You can also complain to your data protection
        authority.
      </p>

      <h2>Children</h2>
      <p>If you are under 16, ask a parent or guardian before you make an account. The app itself needs none.</p>

      <h2>Changes</h2>
      <p>
        When openbeads keeps something new (for example, synced Projects), this page says so before it happens, with a new
        date at the top.
      </p>

      <p class="privacy__back">
        <AppButton size="sm" :href="homepage" data-testid="privacy-homepage">{{ t.homepage.notFoundHomepage }}</AppButton>
      </p>
    </article>
  </main>
</template>

<style scoped>
.privacy {
  min-height: 100dvh;
  box-sizing: border-box;
  padding: var(--space-32) var(--space-16);
  background: var(--canvas);
  color: var(--ink);
  font: var(--type-body);
}

.privacy__text {
  max-width: var(--privacy-measure);
  margin: 0 auto;
}

.privacy__language {
  margin: 0 0 var(--space-16);
  color: var(--muted);
  font: var(--type-small);
}

.privacy__title {
  margin: 0;
  font: var(--type-serif-heading);
}

.privacy__meta {
  margin: var(--space-8) 0 var(--space-24);
  color: var(--muted);
  font: var(--type-meta);
}

.privacy h2 {
  margin: var(--space-24) 0 var(--space-8);
  font: var(--type-title);
}

.privacy p,
.privacy ul {
  margin: 0 0 var(--space-12);
}

.privacy ul {
  padding-left: var(--space-20);
}

.privacy li + li {
  margin-top: var(--space-4);
}

.privacy a {
  color: inherit;
}

.privacy__back {
  margin-top: var(--space-32);
}
</style>
