
"use client";

import { useState } from "react";
import styles from "@/app/experiencias/experiencias.module.css";

const categories = [
  "Todos",
  "Gestão",
  "Aplicações Web",
  "Suporte Técnico",
  "Informática",
  "Elétrica",
];

const testimonials = [
  {
    id: 1,
    category: "Gestão",
    title: "Experiência com sistemas de gestão",
    description:
      "Espaço reservado para apresentar a experiência de um cliente com uma solução de gestão da VALLEX.",
    type: "video",
  },
  {
    id: 2,
    category: "Aplicações Web",
    title: "Nossa experiência com aplicações web",
    description:
      "Espaço reservado para um depoimento sobre a utilização de uma aplicação desenvolvida pela VALLEX.",
    type: "video",
  },
  {
    id: 3,
    category: "Suporte Técnico",
    title: "Atendimento e suporte técnico",
    description:
      "Espaço reservado para apresentar uma avaliação sobre o atendimento e suporte técnico.",
    type: "review",
  },
];

export default function ExperiencesContent() {
  const [selectedCategory, setSelectedCategory] =
    useState("Todos");

  const filteredTestimonials =
    selectedCategory === "Todos"
      ? testimonials
      : testimonials.filter(
          (item) => item.category === selectedCategory
        );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.eyebrow}>
            VALLEX | SERVIÇOFÁCIL
          </span>

          <h1>
            Histórias reais.
            <br />
            Experiências que conectam.
          </h1>

          <p>
            Conheça experiências de clientes que utilizam
            nossas soluções para simplificar processos,
            organizar operações e evoluir digitalmente.
          </p>

          <a href="#depoimentos" className={styles.primaryButton}>
            Conhecer experiências
          </a>
        </div>
      </section>

      <section
        id="depoimentos"
        className={styles.testimonials}
      >
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>
              EXPERIÊNCIAS DE CLIENTES
            </span>

            <h2>Quem utiliza, recomenda.</h2>

            <p>
              Depoimentos, avaliações e histórias de
              utilização das soluções VALLEX.
            </p>
          </div>

          <div
            className={styles.filters}
            aria-label="Filtrar experiências por categoria"
          >
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={
                  selectedCategory === category
                    ? styles.activeFilter
                    : styles.filterButton
                }
                aria-pressed={selectedCategory === category}
              >
                {category}
              </button>
            ))}
          </div>

          <div className={styles.cards}>
            {filteredTestimonials.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.mediaPlaceholder}>
                  <span className={styles.playIcon}>
                    {item.type === "video" ? "▶" : "★"}
                  </span>

                  <span className={styles.mediaLabel}>
                    {item.type === "video"
                      ? "Vídeo de depoimento"
                      : "Avaliação de cliente"}
                  </span>

                  <span className={styles.comingSoon}>
                    Conteúdo em preparação
                  </span>
                </div>

                <div className={styles.cardContent}>
                  <span className={styles.category}>
                    {item.category}
                  </span>

                  <h3>{item.title}</h3>

                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>

          {filteredTestimonials.length === 0 && (
            <p className={styles.empty}>
              Ainda não há experiências cadastradas
              nesta categoria.
            </p>
          )}
        </div>
      </section>

      <section className={styles.invitation}>
        <div className={styles.container}>
          <h2>Você também faz parte dessa história.</h2>

          <p>
            Sua experiência ajuda a VALLEX a evoluir
            continuamente e desenvolver soluções cada
            vez mais úteis.
          </p>

          <a href="/contato" className={styles.secondaryButton}>
            Fale com a VALLEX
          </a>
          <a href="/avaliar" className={styles.secondaryButton}>
            Avaliar minha experiência
          </a>
        </div>
      </section>
    </div>
  );
}
