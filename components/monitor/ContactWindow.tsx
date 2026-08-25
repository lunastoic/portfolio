"use client";

import { useState } from "react";
import PixelButton from "@/components/ui/PixelButton";
import RetroWindow from "./RetroWindow";

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

/** CONTACT.EXE — client-side validated form + social links. */
export default function ContactWindow({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: FormErrors = {};
    if (!name.trim()) next.name = "ERR: NAME REQUIRED";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "ERR: EMAIL INVALID";
    if (!message.trim()) next.message = "ERR: MESSAGE EMPTY";
    setErrors(next);
    if (Object.keys(next).length === 0) setSent(true);
  };

  return (
    <RetroWindow title="CONTACT.EXE" onClose={onClose}>
      {sent ? (
        <div className="app-content contact-success" role="status">
          <pre aria-hidden="true">{`+------------------------+
|                        |
|    MESSAGE QUEUED.     |
|                        |
+------------------------+`}</pre>
          <p>
            TRANSMISSION SAVED TO OUTBOX.
            <br />
            I&apos;LL GET BACK TO YOU SOON. <span className="cursor-blink" aria-hidden="true" />
          </p>
          <PixelButton onClick={() => setSent(false)}>NEW MESSAGE</PixelButton>
        </div>
      ) : (
        <form className="app-content contact-form" onSubmit={handleSubmit} noValidate>
          <label className="contact-form__field">
            <span className="contact-form__label">&gt; NAME:</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="contact-form__input"
              autoComplete="name"
              aria-invalid={!!errors.name}
            />
            {errors.name && <span className="contact-form__error" role="alert">{errors.name}</span>}
          </label>

          <label className="contact-form__field">
            <span className="contact-form__label">&gt; EMAIL:</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="contact-form__input"
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
            {errors.email && <span className="contact-form__error" role="alert">{errors.email}</span>}
          </label>

          <label className="contact-form__field">
            <span className="contact-form__label">&gt; MESSAGE:</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="contact-form__input contact-form__textarea"
              rows={5}
              aria-invalid={!!errors.message}
            />
            {errors.message && <span className="contact-form__error" role="alert">{errors.message}</span>}
          </label>

          <button type="submit" className="pixel-btn pixel-btn--solid">
            SEND &gt;&gt;
          </button>

          <div className="contact-links">
            <p className="app-heading">&gt; FIND ME</p>
            {/* Replace # with real profile URLs */}
            <a href="#" className="contact-links__item" aria-disabled="true" onClick={(e) => e.preventDefault()}>
              [GITHUB]
            </a>
            <a href="#" className="contact-links__item" aria-disabled="true" onClick={(e) => e.preventDefault()}>
              [LINKEDIN]
            </a>
            <a href="mailto:cluna027@gmail.com" className="contact-links__item">
              [EMAIL]
            </a>
          </div>
        </form>
      )}
    </RetroWindow>
  );
}
