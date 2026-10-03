"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Customer = {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CustomersResponse = {
  ok: boolean;
  message?: string;
  organization?: {
    id: string;
    name: string;
  };
  role?: "owner" | "member";
  customers?: Customer[];
};

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (
      sessionError ||
      !data.session?.access_token
    ) {
      window.location.href = "/sistema/login";
      return null;
    }

    return data.session.access_token;
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch(
        "/api/sistema/clientes",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      const result: CustomersResponse =
        await response.json();

      if (!response.ok || !result.ok) {
        setError(
          result.message ??
            "Não foi possível carregar os clientes."
        );
        return;
      }

      setCustomers(result.customers ?? []);

      setOrganizationName(
        result.organization?.name ?? ""
      );

      setRole(
        result.role === "owner"
          ? "owner"
          : "member"
      );
    } catch {
      setError(
        "Erro de comunicação ao carregar os clientes."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  function clearForm() {
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
  }

  function startEdit(customer: Customer) {
    setError("");
    setMessage("");

    setEditingId(customer.id);
    setName(customer.name);
    setPhone(customer.phone ?? "");
    setEmail(customer.email ?? "");
    setAddress(customer.address ?? "");
    setNotes(customer.notes ?? "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();
    const normalizedEmail = email
      .trim()
      .toLowerCase();
    const normalizedAddress = address.trim();
    const normalizedNotes = notes.trim();

    if (!normalizedName) {
      setError("Informe o nome do cliente.");
      return;
    }

    setSaving(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const method = editingId
        ? "PATCH"
        : "POST";

      const body = {
        ...(editingId
          ? { id: editingId }
          : {}),
        name: normalizedName,
        phone: normalizedPhone,
        email: normalizedEmail,
        address: normalizedAddress,
        notes: normalizedNotes,
      };

      const response = await fetch(
        "/api/sistema/clientes",
        {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(
          result.message ??
            "Não foi possível salvar o cliente."
        );
        return;
      }

      setMessage(
        result.message ??
          "Cliente salvo com sucesso."
      );

      clearForm();

      await loadCustomers();
    } catch {
      setError(
        "Erro de comunicação ao salvar o cliente."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (role !== "owner") {
      return;
    }

    const confirmed = window.confirm(
      "Deseja realmente excluir este cliente?"
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch(
        "/api/sistema/clientes",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ id }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(
          result.message ??
            "Não foi possível excluir o cliente."
        );
        return;
      }

      setMessage(
        result.message ??
          "Cliente excluído com sucesso."
      );

      if (editingId === id) {
        clearForm();
      }

      await loadCustomers();
    } catch {
      setError(
        "Erro de comunicação ao excluir o cliente."
      );
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  const filteredCustomers = customers.filter(
    (customer) => {
      const term = search
        .trim()
        .toLowerCase();

      if (!term) {
        return true;
      }

      return [
        customer.name,
        customer.phone ?? "",
        customer.email ?? "",
        customer.address ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    }
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Carregando clientes...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-[#17002E] px-6 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm tracking-[0.2em] text-purple-300">
              VALLEX
            </p>

            <h1 className="text-xl font-bold">
              ServiçoFácil
            </h1>
          </div>

          <Link
            href="/sistema"
            className="rounded-lg border border-purple-300 px-4 py-2 text-sm hover:bg-purple-900"
          >
            Voltar ao painel
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-slate-500">
          Gestão da organização
        </p>

        <h2 className="mt-2 text-3xl font-bold text-slate-900">
          Clientes
        </h2>

        <p className="mt-2 text-slate-600">
          Cadastre e organize os clientes da
          organização.
        </p>

        {organizationName && (
          <p className="mt-2 text-sm text-slate-600">
            Organização:{" "}
            <strong>{organizationName}</strong>
          </p>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {role === "owner" && (
          <section className="mt-6 rounded-xl border border-purple-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingId
                  ? "Editar cliente"
                  : "Cadastrar cliente"}
              </h3>

              <p className="text-sm text-slate-600">
                {editingId
                  ? "Atualize os dados do cliente."
                  : "Informe os dados básicos do cliente."}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 grid gap-5 md:grid-cols-2"
            >
              <div>
                <label
                  htmlFor="customer-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Nome *
                </label>

                <input
                  id="customer-name"
                  type="text"
                  required
                  maxLength={150}
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Nome completo"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div>
                <label
                  htmlFor="customer-phone"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Telefone
                </label>

                <input
                  id="customer-phone"
                  type="text"
                  maxLength={40}
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="(62) 99999-9999"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div>
                <label
                  htmlFor="customer-email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  E-mail
                </label>

                <input
                  id="customer-email"
                  type="email"
                  maxLength={150}
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="cliente@exemplo.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div>
                <label
                  htmlFor="customer-address"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Endereço
                </label>

                <input
                  id="customer-address"
                  type="text"
                  maxLength={300}
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                  placeholder="Endereço do cliente"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="customer-notes"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Observações
                </label>

                <textarea
                  id="customer-notes"
                  maxLength={2000}
                  rows={4}
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  placeholder="Informações adicionais sobre o cliente..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Salvando..."
                    : editingId
                      ? "Salvar alterações"
                      : "Cadastrar cliente"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={clearForm}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Clientes cadastrados
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                {customers.length}{" "}
                {customers.length === 1
                  ? "cliente cadastrado"
                  : "clientes cadastrados"}
              </p>
            </div>

            <div className="w-full md:max-w-sm">
              <label
                htmlFor="customer-search"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Buscar cliente
              </label>

              <input
                id="customer-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Nome, telefone ou e-mail"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="mt-6 rounded-lg bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-600">
                {customers.length === 0
                  ? "Nenhum cliente cadastrado ainda."
                  : "Nenhum cliente encontrado para essa busca."}
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-medium">
                      Cliente
                    </th>

                    <th className="px-3 py-3 font-medium">
                      Telefone
                    </th>

                    <th className="px-3 py-3 font-medium">
                      E-mail
                    </th>

                    <th className="px-3 py-3 font-medium">
                      Cadastro
                    </th>

                    {role === "owner" && (
                      <th className="px-3 py-3 text-right font-medium">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map(
                    (customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-100"
                      >
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-900">
                            {customer.name}
                          </div>

                          {customer.address && (
                            <div className="mt-1 max-w-xs text-xs text-slate-500">
                              {customer.address}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-4 text-slate-700">
                          {customer.phone ?? "—"}
                        </td>

                        <td className="break-all px-3 py-4 text-slate-700">
                          {customer.email ?? "—"}
                        </td>

                        <td className="px-3 py-4 text-slate-700">
                          {formatDate(
                            customer.created_at
                          )}
                        </td>

                        {role === "owner" && (
                          <td className="px-3 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  startEdit(customer)
                                }
                                className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    customer.id
                                  )
                                }
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}