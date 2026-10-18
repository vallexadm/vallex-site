
export const siteConfig = {
  name: "VALLEX",
  brand: "VALLEX |SERVIÇOFÁCIL",
  tagline: "Tecnologia e soluções ao seu alcance.",

  legal: {
    companyName: "VALQUIMAR SANTOS",
    cnpj: "64.543.250/0001-50",
    businessAddress:
      "Rua Rio de Janeiro, Sala 02, Vila Jardim São Judas Tadeu, Goiânia/GO, CEP 74685-410",
  },

  description:
    "Soluções em informática, elétrica e tecnologia para pessoas e empresas.",

  services: [
    "Informática",
    "Elétrica",
    "Redes e conectividade",
    "Soluções digitais",
  ],

  contact: {
    email: "vallexbusiness@gmail.com",
    phone: "(62) 98540-8497",
    whatsapp: "+55 (62) 98540-8497",
  },

  social: {
    facebook: "https://www.facebook.com/val.alexandre.2025",
    instagram: "https://www.instagram.com/vallexbustech/",
  },

  navigation: [
  { label: "Início", href: "/" },
  { label: "Sobre", href: "/sobre" },
  {
    label: "Serviços",
    href: "/servicos",
    children: [
      { label: "Visão geral dos serviços", href: "/servicos" },
      { label: "Plataforma ServiçoFácil", href: "/solucoes#para-prestadores" },
      { label: "Planilhas automatizadas", href: "/servicos#planilhas-automatizadas" },
      { label: "Soluções digitais sob medida", href: "/servicos#solucoes-digitais" },
      { label: "Gestão de tráfego pago", href: "/trafego-pago" },
      { label: "Apresentar uma necessidade", href: "/contato#formulario-orcamento" },
    ],
  },
  { label: "Soluções", href: "/solucoes" },
  { label: "Experiências", href: "/experiencias" },
  { label: "Contato", href: "/contato" },
  ],
};
