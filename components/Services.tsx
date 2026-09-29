
const services = [
  {
    title: "Informática",
    description:
      "Manutenção, instalação, configuração e suporte técnico.",
    icon: "01",
  },
  {
    title: "Elétrica",
    description:
      "Serviços elétricos e soluções técnicas conforme a necessidade.",
    icon: "02",
  },
  {
    title: "Redes e conectividade",
    description:
      "Configuração de redes, Wi-Fi e equipamentos.",
    icon: "03",
  },
  {
    title: "Soluções digitais",
    description:
      "Desenvolvimento de aplicações web e ferramentas digitais.",
    icon: "04",
  },
];

export default function Services() {
  return (
    <section className="services section">
      <div className="container">

        <div className="section-heading">
          <span className="eyebrow">Nossas especialidades</span>
          <h2>Soluções para diferentes necessidades</h2>
          <p>
            Tecnologia e serviços técnicos com foco em praticidade,
            organização e eficiência.
          </p>
        </div>

        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.icon}>
              <span className="service-number">{service.icon}</span>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
