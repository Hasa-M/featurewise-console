import { LoginForm } from "@/features/auth";
import { Logo } from "@/shared/ui/logo";

import styles from "./LoginPage.module.css";

export function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby={"login-title"}>
        <Logo className={styles.logo} />
        <div className={styles.intro}>
          <h1 id={"login-title"}>Sign in</h1>
          <p>Your projects, features and review history.</p>
        </div>
        <div className={styles.form}>
          <LoginForm />
        </div>
        <p className={styles.footer}>Local-first MVP · single-user.</p>
      </section>
    </main>
  );
}
