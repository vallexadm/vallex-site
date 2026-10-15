"use client";

import { useMemo, useState } from "react";

type MetricKey = "providers" | "requests" | "subscriptions" | "trafficLeads" | "campaigns";
export type MetricData = {
  series: Record<MetricKey, string[]>;
  visible: Record<MetricKey, boolean>;
  warnings: string[];
  updatedAt: string;
};
type Period = "day" | "week" | "month" | "year";

const timeZone = "America/Sao_Paulo";
const spec: { key: MetricKey; label: string; color: string }[] = [
  { key: "providers", label: "Novos prestadores", color: "#c084fc" },
  { key: "requests", label: "Pedidos de orçamento", color: "#60a5fa" },
  { key: "subscriptions", label: "Assinaturas iniciadas", color: "#fbbf24" },
  { key: "trafficLeads", label: "Leads de tráfego", color: "#34d399" },
  { key: "campaigns", label: "Campanhas criadas", color: "#fb7185" },
];

function localDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function shiftDate(value: string, period: Period) {
  const date = dateFromKey(value);
  if (period === "day") date.setUTCDate(date.getUTCDate() - 1);
  if (period === "week") date.setUTCDate(date.getUTCDate() - 7);
  if (period === "month") {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 1);
  }
  if (period === "year") {
    date.setUTCMonth(0, 1);
    date.setUTCFullYear(date.getUTCFullYear() - 1);
  }
  return date.toISOString().slice(0, 10);
}

function getBuckets(anchorDate: string, period: Period) {
  const anchor = dateFromKey(anchorDate);
  if (period === "day") {
    return Array.from({ length: 24 }, (_, hour) => ({ key: `${anchorDate}T${String(hour).padStart(2, "0")}`, label: `${String(hour).padStart(2, "0")}h` }));
  }

  if (period === "week") {
    const monday = new Date(anchor);
    const daysSinceMonday = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { key, label: new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "short", day: "2-digit" }).format(date) };
    });
  }

  if (period === "month") {
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth();
    return Array.from({ length: 31 }, (_, index) => {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
      return { key, label: String(index + 1) };
    });
  }

  const year = anchor.getUTCFullYear();
  return Array.from({ length: 12 }, (_, month) => ({
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("pt-BR", { timeZone, month: "short" }).format(new Date(Date.UTC(year, month, 15))),
  }));
}

function pointKey(value: string, period: Period) {
  const date = new Date(value);
  if (period === "day") {
    const hour = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date);
    return `${localDateKey(date)}T${hour}`;
  }
  const dayKey = localDateKey(date);
  return period === "year" ? dayKey.slice(0, 7) : dayKey;
}

function countInBuckets(values: string[], buckets: { key: string }[], period: Period) {
  const counts = new Map(buckets.map(({ key }) => [key, 0]));
  values.forEach((value) => {
    const key = pointKey(value, period);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return buckets.map(({ key }) => counts.get(key) ?? 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "medium" }).format(dateFromKey(value));
}

export default function MetricsDashboard({
  data,
  refreshing,
  onRefresh,
}: {
  data: MetricData | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [anchorDate, setAnchorDate] = useState(() => localDateKey(new Date()));
  const [compare, setCompare] = useState(true);

  const currentBuckets = useMemo(() => getBuckets(anchorDate, period), [anchorDate, period]);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Object.values(data?.series ?? {}).flat().map((value) => new Date(value).getFullYear()).filter(Number.isFinite);
    const earliestYear = Math.min(currentYear - 7, ...(years.length ? years : [currentYear]));
    return Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => currentYear - index);
  }, [data]);
  const priorAnchor = useMemo(() => shiftDate(anchorDate, period), [anchorDate, period]);
  const priorBuckets = useMemo(() => getBuckets(priorAnchor, period), [priorAnchor, period]);
  const series = useMemo(() => {
    if (!data) return [];
    return spec.filter(({ key }) => data.visible[key]).map((item) => ({
      ...item,
      values: countInBuckets(data.series[item.key] ?? [], currentBuckets, period),
      previous: countInBuckets(data.series[item.key] ?? [], priorBuckets, period),
    }));
  }, [currentBuckets, data, period, priorBuckets]);

  const maxValue = Math.max(1, ...series.flatMap(({ values, previous }) => compare ? [...values, ...previous] : values));
  const width = 920;
  const height = 330;
  const left = 42;
  const right = 18;
  const top = 20;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (index: number) => left + (currentBuckets.length <= 1 ? 0 : (index / (currentBuckets.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight;
  const polyline = (values: number[]) => values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const labelEvery = period === "day" ? 3 : period === "month" ? 5 : 1;
  const visibleBuckets = currentBuckets.filter((_, index) => index % labelEvery === 0 || index === currentBuckets.length - 1);
  const dateLabel = period === "year"
    ? String(dateFromKey(anchorDate).getUTCFullYear())
    : period === "month"
      ? new Intl.DateTimeFormat("pt-BR", { timeZone, month: "long", year: "numeric" }).format(dateFromKey(anchorDate))
      : period === "week"
        ? `Semana de ${formatDate(currentBuckets[0]?.key ?? anchorDate)}`
        : formatDate(anchorDate);

  function moveAnchor(direction: -1 | 1) {
    const next = dateFromKey(anchorDate);
    if (period === "day") next.setUTCDate(next.getUTCDate() + direction);
    if (period === "week") next.setUTCDate(next.getUTCDate() + direction * 7);
    if (period === "month") {
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + direction);
    }
    if (period === "year") next.setUTCFullYear(next.getUTCFullYear() + direction);
    setAnchorDate(next.toISOString().slice(0, 10));
  }

  return (
    <section className="vallex-admin-section vallex-admin-chart-section" aria-labelledby="vallex-metrics-heading">
      <div className="vallex-admin-section-heading vallex-admin-chart-heading">
        <div>
          <span className="vallex-admin-eyebrow">Indicadores da VALLEX</span>
          <h2 id="vallex-metrics-heading">Movimentação da plataforma</h2>
          <p>Cadastros, pedidos e operações registrados no sistema. Os dados atualizam automaticamente a cada minuto.</p>
        </div>
        <button type="button" className="vallex-admin-secondary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Atualizando…" : "Atualizar gráfico"}
        </button>
      </div>

      <div className="vallex-admin-chart-controls">
        <label>Período
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
            <option value="year">Ano</option>
          </select>
        </label>
        {period === "year" ? (
          <label>Ano
            <select value={anchorDate.slice(0, 4)} onChange={(event) => setAnchorDate(`${event.target.value}-01-01`)}>
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        ) : (
          <label>Data de referência
            <input type="date" value={anchorDate} onChange={(event) => event.target.value && setAnchorDate(event.target.value)} />
          </label>
        )}
        <label className="vallex-admin-compare"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} /> Comparar com período anterior</label>
        <div className="vallex-admin-period-stepper" aria-label="Navegar períodos">
          <button type="button" onClick={() => moveAnchor(-1)} aria-label="Período anterior">‹</button>
          <strong>{dateLabel}</strong>
          <button type="button" onClick={() => moveAnchor(1)} aria-label="Próximo período">›</button>
        </div>
      </div>

      {!data ? <p className="vallex-admin-empty">Carregando indicadores…</p> : series.length === 0 ? (
        <p className="vallex-admin-empty">Seu perfil não tem permissão de consulta para os indicadores disponíveis.</p>
      ) : (
        <>
          <div className="vallex-admin-chart-scroll">
            <svg className="vallex-admin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Gráfico da movimentação da plataforma para ${dateLabel}`}>
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                const value = Math.round(maxValue * fraction);
                const gridY = y(value);
                return <g key={fraction}><line x1={left} x2={width - right} y1={gridY} y2={gridY} className="vallex-admin-chart-grid" /><text x={left - 9} y={gridY + 4} textAnchor="end" className="vallex-admin-chart-axis">{value}</text></g>;
              })}
              {series.map((item) => <g key={item.key}>
                {compare && <polyline points={polyline(item.previous)} fill="none" stroke={item.color} strokeWidth="2" strokeDasharray="5 6" opacity=".48" />}
                <polyline points={polyline(item.values)} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                {item.values.map((value, index) => <circle key={`${item.key}-${index}`} cx={x(index)} cy={y(value)} r="3.5" fill={item.color}><title>{item.label} · {currentBuckets[index]?.label}: {value}</title></circle>)}
                {compare && item.previous.map((value, index) => <circle key={`${item.key}-previous-${index}`} cx={x(index)} cy={y(value)} r="2.5" fill="#111827" stroke={item.color} strokeWidth="1.5" opacity=".8"><title>Período anterior · {item.label} · {priorBuckets[index]?.label}: {value}</title></circle>)}
              </g>)}
              {visibleBuckets.map((bucket) => {
                const index = currentBuckets.findIndex((item) => item.key === bucket.key);
                return <text key={bucket.key} x={x(index)} y={height - 14} textAnchor="middle" className="vallex-admin-chart-axis">{bucket.label}</text>;
              })}
            </svg>
          </div>
          <div className="vallex-admin-chart-legend">
            {series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}
            {compare && <span><i className="vallex-admin-chart-previous-key" />Período anterior (linha tracejada)</span>}
          </div>
        </>
      )}

      {data && data.warnings.length > 0 && <p className="vallex-admin-chart-warning">Algumas séries ainda não puderam ser carregadas: {data.warnings.join(", ")}.</p>}
      <p className="vallex-admin-chart-footnote">A comparação usa a mesma janela do período anterior. O gráfico reúne registros armazenados pela plataforma; visitas públicas e uma série histórica de receitas e despesas ainda não são contabilizadas. {data && <>Última atualização: {new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(data.updatedAt))}.</>}</p>
    </section>
  );
}
