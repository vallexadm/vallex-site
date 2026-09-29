"use client";

import { useEffect, useState } from "react";
import styles from "@/app/experiencias/experiencias.module.css";

const categories = [
  "Todos",
  "Gestão",
  "Aplicações Web",
  "Suporte Técnico",
  "Informática",
  "Elétrica",
  "Consultoria",
  "Outro",
];

type Evaluation = {
  id: string;
  nome: string;
  empresa: string | null;
  servico: string;
  nota: number;
  depoimento: string;
  video_url: string | null;
  status: string;
  criado_em: string;
};

function getCategory(service: string) {
  switch (service) {
    case "Sistemas de Gestão":
      return "Gestão";
    case "Serviços Elétricos":
      return "Elétrica";
    default:
      return service;
  }
}

export default function ExperiencesContent() {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvaluations() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/avaliacoes", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(
            result.message || "Não foi possível carregar as avaliações."
          );
        }

        setEvaluations(result.evaluations ?? []);
      } catch (err) {
        console.error("Erro ao carregar avaliações:", err);
        setError("Não foi possível carregar as experiências neste momento.");
      } finally {
        setLoading(false);
      }
    }

    loadEvaluations();
  }, []);

  const filteredEvaluations =
    selectedCategory === "Todos"
      ? evaluations
      : evaluations.filter(
          (item) => getCategory(item.servico) === selectedCategory
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

      <section id="depoimentos" className={styles.testimonials}>
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

          {loading && (
            <p className={styles.empty}>
              Carregando experiências...
            </p>
          )}

          {!loading && error && (
            <p className={styles.empty} role="alert">
              {error}
            </p>
          )}

          {!loading && !error && filteredEvaluations.length > 0 && (
            <div className={styles.cards}>
              {filteredEvaluations.map((item) => (
                <article key={item.id} className={styles.card}>
                  <div className={styles.mediaPlaceholder}>
                    <span className={styles.playIcon}>
                      {item.video_url ? "▶" : "★"}
                    </span>

                    <span className={styles.mediaLabel}>
                      {item.video_url
                        ? "Vídeo de depoimento"
                        : "Avaliação de cliente"}
                    </span>

                    {item.video_url && (
                      <a
                        href={item.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.comingSoon}
                      >
                        Assistir depoimento
                      </a>
                    )}
                  </div>

                  <div className={styles.cardContent}>
                    <span className={styles.category}>
                      {getCategory(item.servico)}
                    </span>

                    <h3>{item.nome}</h3>

                    {item.empresa && <p>{item.empresa}</p>}

                    <p aria-label={`Nota ${item.nota} de 5`}>
                      {"★".repeat(item.nota)}
                      {"☆".repeat(5 - item.nota)}
                    </p>

                    <p>{item.depoimento}</p>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && !error && filteredEvaluations.length === 0 && (
            <p className={styles.empty}>
              {evaluations.length === 0
                ? "As experiências dos clientes serão exibidas aqui após revisão e aprovação pela equipe VALLEX."
                : "Ainda não há experiências aprovadas nesta categoria."}
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
          <div className={styles.invitationActions}>
              <a href="/contato" className={styles.secondaryButton}>
                  Fale com a VALLEX
              </a>
                  <a href="/avaliar" className={styles.secondaryButton}>
                  Avaliar minha experiência
              </a>
          </div>
        </div>
      </section>
    </div>
  );
}