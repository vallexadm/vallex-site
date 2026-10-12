"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PublicProfile = {
  id: string;
  organization_id: string;
  slug: string;
  display_name: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  is_published: boolean;
  publication_authorized_at: string | null;
  publication_revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

type Organization = {
  id: string;
  name: string;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  organization?: Organization;
  profile?: PublicProfile | null;
};

type VitrineService = {
  id: string;
  organization_id: string;
  catalog_item_id: string | null;
  name: string;
  description: string | null;
  price: number | string | null;
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type ServicesApiResponse = {
  ok: boolean;
  message?: string;
  services?: VitrineService[];
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function VitrinePage() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [organization, setOrganization] =
    useState<Organization | null>(null);

  const [profile, setProfile] = useState<PublicProfile | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [services, setServices] = useState<VitrineService[]>([]);
  const [carregandoServicos, setCarregandoServicos] = useState(true);
  const [salvandoServico, setSalvandoServico] = useState(false);
  const [editandoServicoId, setEditandoServicoId] = useState<string | null>(
  null
);

  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDisplayOrder, setServiceDisplayOrder] = useState("1");
  const [servicePublished, setServicePublished] = useState(true);

  useEffect(() => {
  carregarVitrine();
  carregarServicos();
}, []);
async function carregarServicos() {
  setCarregandoServicos(true);

  try {
    const token = await obterToken();

    if (!token) {
      return;
    }

    const response = await fetch("/api/sistema/vitrine/servicos", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const resultado: ServicesApiResponse = await response.json();

    if (!response.ok) {
      throw new Error(
        resultado.message ||
          "Não foi possível carregar os serviços da Vitrine."
      );
    }

    setServices(resultado.services ?? []);
  } catch (error) {
    setErro(
      error instanceof Error
        ? error.message
        : "Não foi possível carregar os serviços."
    );
  } finally {
    setCarregandoServicos(false);
  }
}

function limparFormularioServico() {
  setEditandoServicoId(null);
  setServiceName("");
  setServiceDescription("");
  setServicePrice("");
  setServiceDisplayOrder(
    String(
      services.length > 0
        ? Math.max(...services.map((service) => service.display_order)) + 1
        : 1
    )
  );
  setServicePublished(true);
}

function prepararEdicaoServico(service: VitrineService) {
  setEditandoServicoId(service.id);
  setServiceName(service.name);
  setServiceDescription(service.description || "");
  setServicePrice(
    service.price === null || service.price === undefined
      ? ""
      : String(service.price)
  );
  setServiceDisplayOrder(String(service.display_order));
  setServicePublished(service.is_published);

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });
}

async function salvarServico(event: FormEvent) {
  event.preventDefault();

  setErro("");
  setSucesso("");
  setSalvandoServico(true);

  try {
    const token = await obterToken();

    if (!token) {
      return;
    }

    const price =
      servicePrice.trim() === ""
        ? null
        : Number(servicePrice.replace(",", "."));

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      throw new Error("Informe um preço válido.");
    }

    const displayOrder = Number(serviceDisplayOrder);

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      throw new Error(
        "A ordem de exibição deve ser um número inteiro maior ou igual a zero."
      );
    }

    const payload = {
      name: serviceName.trim(),
      description: serviceDescription.trim(),
      price,
      is_published: servicePublished,
      display_order: displayOrder,
    };

    const response = await fetch("/api/sistema/vitrine/servicos", {
      method: editandoServicoId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        editandoServicoId
          ? {
              id: editandoServicoId,
              ...payload,
            }
          : payload
      ),
    });

    const resultado: ServicesApiResponse & {
      service?: VitrineService;
    } = await response.json();

    if (!response.ok) {
      throw new Error(
        resultado.message || "Não foi possível salvar o serviço."
      );
    }

    setSucesso(
      editandoServicoId
        ? "Serviço atualizado com sucesso."
        : "Serviço criado com sucesso."
    );

    limparFormularioServico();
    await carregarServicos();
  } catch (error) {
    setErro(
      error instanceof Error
        ? error.message
        : "Não foi possível salvar o serviço."
    );
  } finally {
    setSalvandoServico(false);
  }
}

async function alterarPublicacaoServico(
  service: VitrineService
) {
  setErro("");
  setSucesso("");

  try {
    const token = await obterToken();

    if (!token) {
      return;
    }

    const response = await fetch("/api/sistema/vitrine/servicos", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: service.id,
        is_published: !service.is_published,
      }),
    });

    const resultado = await response.json();

    if (!response.ok) {
      throw new Error(
        resultado.message ||
          "Não foi possível alterar a publicação do serviço."
      );
    }

    setSucesso(
      service.is_published
        ? "Serviço retirado da Vitrine."
        : "Serviço publicado na Vitrine."
    );

    await carregarServicos();
  } catch (error) {
    setErro(
      error instanceof Error
        ? error.message
        : "Não foi possível alterar a publicação."
    );
  }
}

async function excluirServico(service: VitrineService) {
  const confirmacao = window.confirm(
    `Deseja realmente excluir o serviço "${service.name}"?`
  );

  if (!confirmacao) {
    return;
  }

  setErro("");
  setSucesso("");

  try {
    const token = await obterToken();

    if (!token) {
      return;
    }

    const response = await fetch("/api/sistema/vitrine/servicos", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: service.id,
      }),
    });

    const resultado = await response.json();

    if (!response.ok) {
      throw new Error(
        resultado.message || "Não foi possível excluir o serviço."
      );
    }

    if (editandoServicoId === service.id) {
      limparFormularioServico();
    }

    setSucesso("Serviço excluído com sucesso.");
    await carregarServicos();
  } catch (error) {
    setErro(
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o serviço."
    );
  }
}
  async function obterToken() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      router.replace("/sistema/login");
      return null;
    }

    return data.session.access_token;
  }

  async function carregarVitrine() {
    setCarregando(true);
    setErro("");

    try {
      const token = await obterToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/sistema/vitrine", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const resultado: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado.message ||
            "Não foi possível carregar a configuração da Vitrine."
        );
      }

      setOrganization(resultado.organization ?? null);
      setProfile(resultado.profile ?? null);

      if (resultado.profile) {
        preencherFormulario(resultado.profile);
      } else if (resultado.organization) {
        setDisplayName(resultado.organization.name);
        setSlug(slugify(resultado.organization.name));
      }
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a Vitrine."
      );
    } finally {
      setCarregando(false);
    }
  }

  function preencherFormulario(dados: PublicProfile) {
    setDisplayName(dados.display_name || "");
    setSlug(dados.slug || "");
    setDescription(dados.description || "");
    setPhone(dados.phone || "");
    setWhatsapp(dados.whatsapp || "");
    setEmail(dados.email || "");
    setAddress(dados.address || "");
    setLogoUrl(dados.logo_url || "");
  }

  function limparMensagens() {
    setErro("");
    setSucesso("");
  }

  function dadosFormulario() {
    return {
      display_name: displayName.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      address: address.trim(),
      logo_url: logoUrl.trim(),
    };
  }

  async function salvarVitrine(event?: FormEvent) {
    event?.preventDefault();

    limparMensagens();
    setSalvando(true);

    try {
      const token = await obterToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/sistema/vitrine", {
        method: profile ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dadosFormulario()),
      });

      const resultado: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado.message ||
            "Não foi possível salvar a configuração da Vitrine."
        );
      }

      if (resultado.profile) {
        setProfile(resultado.profile);
        preencherFormulario(resultado.profile);
      }

      setSucesso(
        profile
          ? "Configuração da Vitrine atualizada com sucesso."
          : "Configuração da Vitrine criada com sucesso."
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a Vitrine."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function enviarLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;

    limparMensagens();
    if (!profile) {
      setErro("Salve a configuração da Vitrine antes de enviar a logo.");
      return;
    }

    setEnviandoLogo(true);
    try {
      const token = await obterToken();
      if (!token) return;

      const form = new FormData();
      form.set("finalidade", "logo");
      form.set("arquivo", arquivo);
      const response = await fetch("/api/sistema/arquivos", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.message || "Não foi possível enviar a logo.");

      setLogoUrl(resultado.logo_url);
      setProfile((atual) => atual ? { ...atual, logo_url: resultado.logo_url } : atual);
      setSucesso("Logo enviada e aplicada à Vitrine.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar a logo.");
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function alterarPublicacao(
    action: "publish" | "revoke"
  ) {
    limparMensagens();

    const confirmacao =
      action === "publish"
        ? window.confirm(
            "Deseja realmente publicar a Vitrine? Ela ficará disponível publicamente."
          )
        : window.confirm(
            "Deseja retirar a Vitrine do ar? Os dados e o histórico serão preservados."
          );

    if (!confirmacao) {
      return;
    }

    setPublicando(true);

    try {
      const token = await obterToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/sistema/vitrine", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...dadosFormulario(),
          action,
        }),
      });

      const resultado: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado.message ||
            "Não foi possível alterar o estado da Vitrine."
        );
      }

      if (resultado.profile) {
        setProfile(resultado.profile);
        preencherFormulario(resultado.profile);
      }

      setSucesso(
        action === "publish"
          ? "Vitrine publicada com sucesso."
          : "Publicação da Vitrine revogada com sucesso."
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a publicação."
      );
    } finally {
      setPublicando(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            Carregando configuração da Vitrine...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-purple-600">
              ServiçoFácil
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Vitrine pública
            </h1>

            <p className="mt-2 text-gray-600">
              Configure como sua empresa será apresentada
              publicamente.
            </p>
          </div>

          <Link
            href="/sistema"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
          >
            Voltar ao painel
          </Link>
        </div>

        {process.env.NODE_ENV !== "production" && (
          <div className="mb-6">
            <Link
              href="/servicos?previsualizar=1"
              className="inline-flex rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
            >
              Pré-visualizar no catálogo local
            </Link>
          </div>
        )}

        {erro && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">
              Não foi possível concluir a operação.
            </p>

            <p className="mt-1 text-sm">{erro}</p>
          </div>
        )}

        {sucesso && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
            <p className="font-semibold">{sucesso}</p>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status da Vitrine
              </p>

              <div className="mt-2 flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                    profile?.is_published
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {profile?.is_published
                    ? "Publicada"
                    : "Não publicada"}
                </span>

                {organization && (
                  <span className="text-sm text-gray-500">
                    {organization.name}
                  </span>
                )}
              </div>
            </div>

            {profile?.is_published && (
              <div className="text-sm text-green-700">
                Sua Vitrine está disponível publicamente.
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={salvarVitrine}
          className="space-y-6"
        >
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">
                Identificação pública
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Essas informações serão utilizadas na apresentação
                pública do prestador.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="display_name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Nome exibido
                </label>

                <input
                  id="display_name"
                  value={displayName}
                  onChange={(event) =>
                    setDisplayName(event.target.value)
                  }
                  maxLength={160}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  placeholder="VALLEX | SERVIÇOFÁCIL"
                />
              </div>

              <div>
                <label
                  htmlFor="slug"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Endereço público
                </label>

                <div className="flex items-center">
                  <span className="rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                    /prestador/
                  </span>

                  <input
                    id="slug"
                    value={slug}
                    onChange={(event) =>
                      setSlug(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                      )
                    }
                    maxLength={80}
                    required
                    className="min-w-0 flex-1 rounded-r-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    placeholder="vallex-servicofacil"
                  />
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  Use apenas letras minúsculas, números e hífens.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Descrição
              </label>

              <textarea
                id="description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                maxLength={2000}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                placeholder="Descreva brevemente os serviços oferecidos."
              />

              <p className="mt-1 text-right text-xs text-gray-500">
                {description.length}/2000
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">
                Contato público
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Preencha apenas os canais que deseja disponibilizar
                aos clientes.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Telefone
                </label>

                <input
                  id="phone"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  maxLength={40}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  placeholder="(62) 00000-0000"
                />
              </div>

              <div>
                <label
                  htmlFor="whatsapp"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  WhatsApp
                </label>

                <input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(event) =>
                    setWhatsapp(event.target.value)
                  }
                  maxLength={40}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  placeholder="(62) 00000-0000"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  E-mail
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  maxLength={320}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  placeholder="contato@empresa.com"
                />
              </div>

              <div>
                <label
                  htmlFor="address"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Endereço
                </label>

                <input
                  id="address"
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                  maxLength={500}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  placeholder="Cidade, bairro ou endereço"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">
                Identidade visual
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Envie uma imagem da logo. Ela será ajustada para aparecer bem na Vitrine, inclusive em celulares.
              </p>
            </div>

            <label
              htmlFor="logo_file"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Arquivo da logo
            </label>

            <input
              id="logo_file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={enviarLogo}
              disabled={enviandoLogo}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:font-semibold file:text-purple-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 disabled:opacity-60"
            />
            <p className="mt-2 text-xs text-gray-500">
              JPG, PNG ou WebP; até 2 MB. {enviandoLogo ? "Enviando…" : ""}
            </p>
            {logoUrl && (
              <div className="mt-4 flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                  {/* O container mantém o enquadramento em telas pequenas. */}
                  <img src={logoUrl} alt={`Logo de ${displayName || "prestador"}`} className="h-full w-full object-contain" />
                </div>
                <span className="text-sm text-gray-600">Prévia da logo na Vitrine</span>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={salvando || publicando}
                className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando
                  ? "Salvando..."
                  : "Salvar alterações"}
              </button>

              {profile && !profile.is_published && (
                <button
                  type="button"
                  disabled={salvando || publicando}
                  onClick={() => alterarPublicacao("publish")}
                  className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publicando
                    ? "Processando..."
                    : "Publicar Vitrine"}
                </button>
              )}

              {profile?.is_published && (
                <button
                  type="button"
                  disabled={salvando || publicando}
                  onClick={() => alterarPublicacao("revoke")}
                  className="rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publicando
                    ? "Processando..."
                    : "Revogar publicação"}
                </button>
              )}
            </div>

            <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">
                Sobre a publicação
              </p>

              <p className="mt-1">
                Salvar as informações não publica automaticamente a
                Vitrine. A publicação é uma ação separada e pode ser
                revogada posteriormente sem apagar os dados.
              </p>
            </div>
          </section>
        </form>
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 className="text-xl font-semibold">
        Serviços da Vitrine
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        Cadastre os serviços que serão apresentados publicamente.
      </p>
    </div>

    {editandoServicoId && (
      <button
        type="button"
        onClick={limparFormularioServico}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        Cancelar edição
      </button>
    )}
  </div>

  <form
    onSubmit={salvarServico}
    className="rounded-lg border border-gray-200 bg-gray-50 p-5"
  >
    <div className="mb-5">
      <h3 className="text-lg font-semibold text-gray-900">
        {editandoServicoId ? "Editar serviço" : "Novo serviço"}
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        O serviço pode ser exclusivo da Vitrine, sem necessidade de
        cadastro prévio no catálogo interno.
      </p>
    </div>

    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label
          htmlFor="service_name"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Nome do serviço
        </label>

        <input
          id="service_name"
          value={serviceName}
          onChange={(event) => setServiceName(event.target.value)}
          maxLength={160}
          required
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          placeholder="Ex.: Desenvolvimento de Aplicações Web"
        />
      </div>

      <div>
        <label
          htmlFor="service_price"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Preço
        </label>

        <input
          id="service_price"
          type="number"
          min="0"
          step="0.01"
          value={servicePrice}
          onChange={(event) => setServicePrice(event.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          placeholder="Ex.: 120,00"
        />

        <p className="mt-1 text-xs text-gray-500">
          Deixe em branco quando o preço depender de avaliação/orçamento.
        </p>
      </div>
    </div>

    <div className="mt-5">
      <label
        htmlFor="service_description"
        className="mb-2 block text-sm font-medium text-gray-700"
      >
        Descrição
      </label>

      <textarea
        id="service_description"
        value={serviceDescription}
        onChange={(event) =>
          setServiceDescription(event.target.value)
        }
        maxLength={2000}
        rows={4}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
        placeholder="Descreva o serviço apresentado ao cliente."
      />

      <p className="mt-1 text-right text-xs text-gray-500">
        {serviceDescription.length}/2000
      </p>
    </div>

    <div className="mt-5 grid gap-5 md:grid-cols-2">
      <div>
        <label
          htmlFor="service_display_order"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Ordem de exibição
        </label>

        <input
          id="service_display_order"
          type="number"
          min="0"
          step="1"
          value={serviceDisplayOrder}
          onChange={(event) =>
            setServiceDisplayOrder(event.target.value)
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
        />
      </div>

      <div className="flex items-end">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={servicePublished}
            onChange={(event) =>
              setServicePublished(event.target.checked)
            }
            className="h-4 w-4 rounded border-gray-300 text-purple-600"
          />

          <span>
            <span className="block text-sm font-medium text-gray-700">
              Publicar na Vitrine
            </span>

            <span className="block text-xs text-gray-500">
              O serviço ficará visível na página pública.
            </span>
          </span>
        </label>
      </div>
    </div>

    <div className="mt-5 flex flex-wrap gap-3">
      <button
        type="submit"
        disabled={salvandoServico}
        className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {salvandoServico
          ? "Salvando..."
          : editandoServicoId
            ? "Salvar serviço"
            : "Adicionar serviço"}
      </button>

      {editandoServicoId && (
        <button
          type="button"
          onClick={limparFormularioServico}
          disabled={salvandoServico}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
      )}
    </div>
  </form>

  <div className="mt-6">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-lg font-semibold text-gray-900">
        Serviços cadastrados
      </h3>

      <span className="text-sm text-gray-500">
        {services.length}{" "}
        {services.length === 1 ? "serviço" : "serviços"}
      </span>
    </div>

    {carregandoServicos ? (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
        Carregando serviços...
      </div>
    ) : services.length === 0 ? (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="font-medium text-gray-700">
          Nenhum serviço cadastrado.
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Use o formulário acima para adicionar o primeiro serviço
          da Vitrine.
        </p>
      </div>
    ) : (
      <div className="space-y-4">
        {services.map((service) => (
          <div
            key={service.id}
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-gray-900">
                    {service.name}
                  </h4>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      service.is_published
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {service.is_published
                      ? "Publicado"
                      : "Não publicado"}
                  </span>
                </div>

                {service.description && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                    {service.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <span className="font-medium text-gray-800">
                    {service.price === null ||
                    service.price === undefined
                      ? "Preço sob consulta"
                      : Number(service.price).toLocaleString(
                          "pt-BR",
                          {
                            style: "currency",
                            currency: "BRL",
                          }
                        )}
                  </span>

                  <span className="text-gray-500">
                    Ordem: {service.display_order}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    prepararEdicaoServico(service)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    alterarPublicacaoServico(service)
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    service.is_published
                      ? "border border-orange-300 bg-white text-orange-700 hover:bg-orange-50"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {service.is_published
                    ? "Despublicar"
                    : "Publicar"}
                </button>

                <button
                  type="button"
                  onClick={() => excluirServico(service)}
                  className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</section>
      </div>
    </main>
  );
}