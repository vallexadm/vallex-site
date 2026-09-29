
"use client";

import { useState, type FormEvent } from "react";
import styles from "@/app/avaliar/avaliar.module.css";

export default function ReviewForm() {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating === 0) {
      setError("Selecione uma avaliação de 1 a 5 estrelas.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      company: String(formData.get("company") ?? "").trim(),
      service: String(formData.get("service") ?? "").trim(),
      rating,
      testimonial: String(formData.get("testimonial") ?? "").trim(),
      videoUrl: String(formData.get("video") ?? "").trim(),
      consent: formData.get("consent") === "on",
    };

    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/avaliacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message || "Não foi possível enviar sua avaliação."
        );
      }

      setSubmitted(true);
      form.reset();
      setRating(0);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao enviar avaliação."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className={styles.successSection}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>

          <h1>Obrigado por compartilhar sua experiência!</h1>

          <p>
            Recebemos seus dados e validamos sua avaliação.
            A publicação dependerá de revisão e aprovação
            pela equipe VALLEX.
          </p>

          <a href="/experiencias" className={styles.primaryButton}>
            Voltar às experiências
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>
            VALLEX | SERVIÇOFÁCIL
          </span>

          <h1>Como foi sua experiência?</h1>

          <p>
            Sua opinião é importante para aprimorarmos
            nossos serviços e desenvolvermos soluções
            cada vez melhores.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="name">
              Nome completo ou responsável *
            </label>

            <input
              id="name"
              name="name"
              type="text"
              placeholder="Digite seu nome"
              required
              maxLength={120}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="company">
              Empresa ou organização
            </label>

            <input
              id="company"
              name="company"
              type="text"
              placeholder="Nome da empresa (opcional)"
              maxLength={150}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="service">
              Qual serviço utilizou? *
            </label>

            <select
              id="service"
              name="service"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Selecione uma categoria
              </option>

              <option value="Informática">Informática</option>
              <option value="Aplicações Web">Aplicações Web</option>
              <option value="Sistemas de Gestão">Sistemas de Gestão</option>
              <option value="Suporte Técnico">Suporte Técnico</option>
              <option value="Serviços Elétricos">Serviços Elétricos</option>
              <option value="Consultoria">Consultoria</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>
              Sua avaliação *
            </span>

            <div
              className={styles.stars}
              role="group"
              aria-label="Avaliação de uma a cinco estrelas"
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={
                    star <= rating
                      ? styles.selectedStar
                      : styles.star
                  }
                  onClick={() => {
                    setRating(star);
                    setError("");
                  }}
                  aria-label={`${star} ${
                    star === 1 ? "estrela" : "estrelas"
                  }`}
                  aria-pressed={rating === star}
                >
                  ★
                </button>
              ))}
            </div>

            <small>
              {rating === 0
                ? "Selecione uma nota de 1 a 5."
                : `Você selecionou ${rating} de 5 estrelas.`}
            </small>
          </div>

          <div className={styles.field}>
            <label htmlFor="testimonial">
              Conte como foi sua experiência *
            </label>

            <textarea
              id="testimonial"
              name="testimonial"
              rows={6}
              placeholder="Compartilhe sua experiência com a VALLEX..."
              required
              minLength={10}
              maxLength={1500}
            />

            <small>Máximo de 1.500 caracteres.</small>
          </div>

          <div className={styles.field}>
            <label htmlFor="video">
              Link de vídeo (opcional)
            </label>

            <input
              id="video"
              name="video"
              type="url"
              placeholder="https://..."
            />

            <small>
              Compartilhe um link público de vídeo.
            </small>
          </div>

          <div className={styles.consent}>
            <label>
              <input
                type="checkbox"
                name="consent"
                required
              />

              <span>
                Autorizo expressamente a VALLEX a utilizar
                meu depoimento e minha avaliação em seus
                canais institucionais, conforme a finalidade
                informada. *
              </span>
            </label>
          </div>

          <p className={styles.privacy}>
            Seus dados deverão ser tratados conforme a
            Política de Privacidade da VALLEX. A publicação
            dependerá de revisão e aprovação.
          </p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting}
          >
            {submitting
              ? "Enviando avaliação..."
              : "Enviar avaliação"}
          </button>

          <p className={styles.required}>
            * Campos obrigatórios
          </p>
        </form>
      </div>
    </section>
  );
}
