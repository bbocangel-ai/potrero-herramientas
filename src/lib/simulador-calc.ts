// Cálculo del simulador de negocios ganaderos (recría / engorde).
// Funciones puras: sin DOM, para poder probarlas aparte.
// Todo en bolivianos (Bs) y por animal comprado, salvo los totales del lote.
//
// Criterio de pesos: el desbaste descuenta KILOS, nunca precio. Todos los
// precios "por kg" son por kg pagado (el que queda después del desbaste).

export type ModoCosto = 'simple' | 'detallado'
export type ModoVenta = 'peso' | 'fecha'
export type TipoVenta = 'vivo' | 'gancho'

export interface CostosDetallados {
  alimentacion: number // Bs por animal por mes
  sanidad: number
  personal: number
  pasto: number // pasto propio, arriendo o pastaje
  otros: number
}

export interface Escenario {
  id: string
  nombre: string
  cabezas: number

  // Compra
  fechaCompra: string // AAAA-MM-DD: fecha de entrada de los animales
  pesoCompra: number // kg vivos en la balanza de compra
  desbasteCompra: number // % de kilos descontados al pesar en la compra
  precioCompra: number // Bs por kg pagado
  fleteCompra: number // Bs por animal
  comisionCompra: number // % sobre el valor de compra
  otrosCompra: number // Bs por animal (guías, sanidad de ingreso, etc.)

  // Venta
  modoVenta: ModoVenta // 'peso': salir al llegar a un peso; 'fecha': salir en una fecha
  pesoVenta: number // kg vivos en tu campo al salir (modo peso)
  fechaVenta: string // AAAA-MM-DD: fecha de salida (modo fecha)
  tipoVenta: TipoVenta // se cobra por kg vivo o por kg gancho
  desbasteVenta: number // % de kilos descontados al pesar en la venta (solo kg vivo)
  precioVenta: number // Bs por kg pagado (vivo o gancho, según tipoVenta)
  comisionVenta: number // % sobre el valor de venta
  fleteVenta: number // Bs por animal (si lo pagás vos)
  rendGancho: number // % de rendimiento al gancho (kg gancho ÷ kg vivos al salir de tu campo)

  // Producción
  gdp: number // kg por día
  mortandad: number // % de animales que se mueren en el ciclo
  modoCosto: ModoCosto
  costoKg: number // Bs por kg producido (modo simple)
  incluye: string[] // qué gastos incluye el costo por kg (modo simple)
  detallado: CostosDetallados // modo detallado
}

export const DIAS_POR_MES = 30.4

export const CONCEPTOS_COSTO: { id: keyof CostosDetallados; label: string }[] = [
  { id: 'alimentacion', label: 'Alimentación y suplemento' },
  { id: 'sanidad', label: 'Sanidad' },
  { id: 'personal', label: 'Personal' },
  { id: 'pasto', label: 'Pasto, arriendo o pastaje' },
  { id: 'otros', label: 'Otros gastos del campo' },
]

// ── Fechas (AAAA-MM-DD, sin horas ni zona horaria) ──
const DIA_MS = 86_400_000
export function fechaADia(f: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || '')
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3])
  return Number.isFinite(t) ? Math.round(t / DIA_MS) : null
}
export function diaAFecha(d: number): string {
  return new Date(Math.round(d) * DIA_MS).toISOString().slice(0, 10)
}
export function sumarDias(f: string, dias: number): string | null {
  const d = fechaADia(f)
  return d === null ? null : diaAFecha(d + dias)
}
export function hoy(): string {
  // fecha local (no UTC): de noche en Bolivia UTC ya es el día siguiente
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function escenarioEjemplo(): Escenario {
  const inicio = hoy()
  return {
    id: 'actual',
    nombre: 'Mi negocio',
    cabezas: 100,
    fechaCompra: inicio,
    pesoCompra: 200,
    desbasteCompra: 3,
    precioCompra: 20,
    fleteCompra: 40,
    comisionCompra: 1,
    otrosCompra: 20,
    modoVenta: 'fecha',
    pesoVenta: 420,
    fechaVenta: sumarDias(inicio, 365) ?? inicio,
    tipoVenta: 'vivo',
    desbasteVenta: 3,
    precioVenta: 17,
    comisionVenta: 1,
    fleteVenta: 0,
    rendGancho: 52,
    gdp: 0.6,
    mortandad: 0,
    modoCosto: 'simple',
    costoKg: 7,
    incluye: ['alimentacion', 'sanidad', 'personal', 'pasto'],
    detallado: { alimentacion: 60, sanidad: 10, personal: 25, pasto: 30, otros: 0 },
  }
}

export interface Resultado {
  ok: boolean
  errores: string[]

  // Pesos
  pesoPagadoCompra: number // kg que pagás (= kg con que arranca en tu campo)
  pesoInicio: number
  pesoVenta: number // kg vivos al salir (cargado o calculado según el modo)
  kgProducir: number // kg vivos producidos en tu campo
  pesoPagadoVenta: number // kg que te pagan al vender (vivos o gancho)
  kgDesbasteVenta: number // kg vivos que no te pagan por el desbaste (0 si vendés al gancho)
  pesoGancho: number // kg gancho estimados del animal al salir

  // Tiempo
  dias: number
  meses: number
  fechaCompra: string | null
  fechaVenta: string | null

  // Plata por animal
  valorCompra: number
  comisionCompraBs: number
  gastosCompra: number // flete + comisión + otros de la compra
  costoCompraTotal: number // valor de compra + gastos de compra
  precioTotalCompraKg: number // costo total de compra ÷ kg pagados
  costoProduccion: number // por animal que termina el ciclo
  costoKgProducido: number
  costoMensual: number // Bs por animal por mes (detallado o equivalente)

  ventaBruta: number
  comisionVentaBs: number
  ingresoNeto: number // por animal vendido, después de comisión y flete de venta
  precioNetoVentaKg: number // lo que cobrás por kg, neto: por kg pagado (vivo) o por kg vivo equivalente (gancho)

  // Con mortandad: por animal comprado
  plataNecesaria: number // compra + gastos de compra + producción
  resultado: number // ingreso − plata necesaria
  rendimientoCiclo: number // resultado / plata necesaria (fracción)
  resultadoMes: number // Bs por animal por mes de ciclo
  rentabilidadMensual: number // rendimientoCiclo ÷ meses (promedio simple)

  // Indicadores por kg
  agioKg: number // precio total de compra − precio neto de venta, por kg pagado
  agioTotal: number // agioKg × kg comprados: lo que se pierde (o gana) en los kg comprados
  agioPct: number // precio de compra ÷ precio de venta − 1 (precios de lista, en kg vivo)
  agioPctTotal: number // precio total de compra ÷ precio neto de venta − 1
  kgParaCubrirAgio: number | null // kg producidos necesarios para cubrir el ágio
  margenPorKgProducido: number // precio neto de venta − costo por kg producido
  resultadoPorKgProducido: number // resultado ÷ kg producidos
  relacionCompraVenta: number // kg comprados que paga 1 kg vendido
  precioNetoVentaGancho: number // Bs por kg gancho del animal vendido
  costoKgGanchoProducido: number // costo por kg producido ÷ rendimiento
  resultadoPorKgGancho: number // resultado ÷ kg gancho del animal vendido

  // De dónde sale el resultado (suman `resultado`)
  puente: {
    agio: number
    margenKgProducidos: number
    desbasteVenta: number
    mortandad: number
  }

  // Lote
  plataLote: number
  resultadoLote: number
  compraLote: number // costo total de compra de todos los animales
  produccionLote: number
  ventaLote: number // lo que cobrás por los animales que llegan a la venta
  animalesVendidos: number
}

const pct = (n: number) => (Number.isFinite(n) ? n : 0) / 100

export function calcular(e: Escenario): Resultado {
  const errores: string[] = []
  const dc = pct(e.desbasteCompra)
  const dv = pct(e.desbasteVenta)
  const cc = pct(e.comisionCompra)
  const cv = pct(e.comisionVenta)
  const m = Math.min(Math.max(pct(e.mortandad), 0), 1)
  const rend = pct(e.rendGancho)
  const vivos = 1 - m // fracción de animales que llegan a la venta
  const fProd = 1 - m / 2 // los que mueren gastan, en promedio, medio ciclo

  const pesoPagadoCompra = e.pesoCompra * (1 - dc)
  // Supuesto: el animal arranca en tu campo con los kg pagados (el desbaste se parece a la merma del viaje).
  const pesoInicio = pesoPagadoCompra

  if (!(e.pesoCompra > 0)) errores.push('Ingresá el peso de compra.')
  if (!(e.precioCompra > 0)) errores.push('Ingresá el precio de compra.')
  if (!(e.precioVenta > 0)) errores.push('Ingresá el precio de venta.')
  if (!(e.gdp > 0)) errores.push('La ganancia diaria (GDP) tiene que ser mayor que cero.')
  if (dc >= 1 || dv >= 1) errores.push('El desbaste tiene que ser menor a 100 %.')
  if (m >= 1) errores.push('La mortandad tiene que ser menor a 100 %.')

  const diaCompra = fechaADia(e.fechaCompra)

  // Según el modo, la GDP define los días (peso de salida) o el peso (fecha de salida).
  let dias: number
  let pesoVenta: number
  if (e.modoVenta === 'fecha') {
    const diaVenta = fechaADia(e.fechaVenta)
    if (diaCompra === null || diaVenta === null) {
      errores.push('Cargá la fecha de entrada y la de salida.')
      dias = 0
    } else if (diaVenta <= diaCompra) {
      errores.push('La fecha de salida tiene que ser posterior a la de entrada.')
      dias = 0
    } else dias = diaVenta - diaCompra
    pesoVenta = pesoInicio + Math.max(0, e.gdp) * dias
  } else {
    pesoVenta = e.pesoVenta
    const kg = pesoVenta - pesoInicio
    if (e.pesoCompra > 0 && !(kg > 0))
      errores.push('El peso de salida tiene que ser mayor que el peso con que el animal entra a tu campo.')
    dias = e.gdp > 0 && kg > 0 ? kg / e.gdp : 0
  }
  const kgProducir = pesoVenta - pesoInicio
  const meses = dias / DIAS_POR_MES

  const fechaCompra = diaCompra === null ? null : diaAFecha(diaCompra)
  const fechaVenta = diaCompra === null ? null : diaAFecha(diaCompra + Math.round(dias))

  // Compra
  const valorCompra = pesoPagadoCompra * e.precioCompra
  const comisionCompraBs = valorCompra * cc
  const gastosCompra = e.fleteCompra + comisionCompraBs + e.otrosCompra
  const costoCompraTotal = valorCompra + gastosCompra
  const precioTotalCompraKg = pesoPagadoCompra > 0 ? costoCompraTotal / pesoPagadoCompra : 0

  // Producción
  let costoProduccion: number
  let costoMensual: number
  if (e.modoCosto === 'detallado') {
    const d = e.detallado
    costoMensual = d.alimentacion + d.sanidad + d.personal + d.pasto + d.otros
    costoProduccion = costoMensual * meses
  } else {
    costoProduccion = Math.max(0, kgProducir) * e.costoKg
    costoMensual = meses > 0 ? costoProduccion / meses : 0
  }
  const costoKgProducido = kgProducir > 0 ? costoProduccion / kgProducir : 0

  // Venta: el desbaste descuenta kilos
  // Venta: al vivo el desbaste descuenta kilos; al gancho se cobra kg gancho = kg vivos × rendimiento
  const gancho = e.tipoVenta === 'gancho'
  if (gancho && !(rend > 0 && rend <= 1)) errores.push('Cargá el rendimiento al gancho.')
  const kgPagadosPorKgVivo = gancho ? rend : 1 - dv
  const pesoPagadoVenta = pesoVenta * kgPagadosPorKgVivo
  const kgDesbasteVenta = gancho ? 0 : pesoVenta - pesoPagadoVenta
  const ventaBruta = pesoPagadoVenta * e.precioVenta
  const comisionVentaBs = ventaBruta * cv
  const ingresoNeto = ventaBruta - comisionVentaBs - e.fleteVenta
  // Para comparar con la compra (que es por kg vivo pagado): al gancho, se lleva a kg vivo
  const kgRefVenta = gancho ? pesoVenta : pesoPagadoVenta
  const precioNetoVentaKg = kgRefVenta > 0 ? ingresoNeto / kgRefVenta : 0

  // Resultado por animal comprado (con mortandad)
  const plataNecesaria = costoCompraTotal + costoProduccion * fProd
  const ingresoEsperado = ingresoNeto * vivos
  const resultado = ingresoEsperado - plataNecesaria
  const rendimientoCiclo = plataNecesaria > 0 ? resultado / plataNecesaria : 0
  const resultadoMes = meses > 0 ? resultado / meses : 0
  const rentabilidadMensual = meses > 0 ? rendimientoCiclo / meses : 0

  // Indicadores por kg
  const agioKg = precioTotalCompraKg - precioNetoVentaKg
  const agioTotal = agioKg * pesoPagadoCompra
  const precioVentaListaVivo = gancho ? e.precioVenta * rend : e.precioVenta
  const agioPct = precioVentaListaVivo > 0 ? e.precioCompra / precioVentaListaVivo - 1 : 0
  const agioPctTotal = precioNetoVentaKg > 0 ? precioTotalCompraKg / precioNetoVentaKg - 1 : 0
  const margenPorKgProducido = precioNetoVentaKg - costoKgProducido
  const kgParaCubrirAgio = agioTotal > 0 && margenPorKgProducido > 0 ? agioTotal / margenPorKgProducido : null
  const resultadoPorKgProducido = kgProducir > 0 ? resultado / kgProducir : 0
  const relacionCompraVenta = precioTotalCompraKg > 0 ? precioNetoVentaKg / precioTotalCompraKg : 0
  const pesoGancho = pesoVenta * rend
  const precioNetoVentaGancho = pesoGancho > 0 ? ingresoNeto / pesoGancho : 0
  const costoKgGanchoProducido = rend > 0 ? costoKgProducido / rend : 0
  const resultadoPorKgGancho = pesoGancho > 0 ? resultado / pesoGancho : 0

  // Puente, con el precio neto por kg pagado (Pn):
  // ingreso − compra − producción = Wc·(Pn − Pc) + (W − Wc)·(Pn − c) − kgDesbaste·Pn
  const resultadoSinMortandad = ingresoNeto - costoCompraTotal - costoProduccion
  const puente = {
    agio: -agioTotal,
    margenKgProducidos: kgProducir * margenPorKgProducido,
    desbasteVenta: -kgDesbasteVenta * precioNetoVentaKg,
    mortandad: resultado - resultadoSinMortandad,
  }

  const cab = Math.max(0, e.cabezas || 0)

  return {
    ok: errores.length === 0,
    errores,
    pesoPagadoCompra,
    pesoInicio,
    pesoVenta,
    kgProducir,
    pesoPagadoVenta,
    kgDesbasteVenta,
    pesoGancho,
    dias,
    meses,
    fechaCompra,
    fechaVenta,
    valorCompra,
    comisionCompraBs,
    gastosCompra,
    costoCompraTotal,
    precioTotalCompraKg,
    costoProduccion,
    costoKgProducido,
    costoMensual,
    ventaBruta,
    comisionVentaBs,
    ingresoNeto,
    precioNetoVentaKg,
    plataNecesaria,
    resultado,
    rendimientoCiclo,
    resultadoMes,
    rentabilidadMensual,
    agioKg,
    agioTotal,
    agioPct,
    agioPctTotal,
    kgParaCubrirAgio,
    margenPorKgProducido,
    resultadoPorKgProducido,
    relacionCompraVenta,
    precioNetoVentaGancho,
    costoKgGanchoProducido,
    resultadoPorKgGancho,
    puente,
    plataLote: plataNecesaria * cab,
    resultadoLote: resultado * cab,
    compraLote: costoCompraTotal * cab,
    produccionLote: costoProduccion * fProd * cab,
    ventaLote: ingresoEsperado * cab,
    animalesVendidos: cab * vivos,
  }
}

export interface Limites {
  objetivo: number // resultado mínimo buscado por animal
  precioMaxTotalCompraKg: number | null // Bs por kg pagado, todo incluido
  precioMaxCompra: number | null // Bs por kg pagado (precio de lista)
  precioMinVenta: number | null // Bs por kg pagado
  costoMaxKg: number | null // Bs por kg producido
  pesoMinVenta: number | null // kg vivos; null si cada kg agregado pierde plata
  diasMinimos: number | null // días hasta llegar a ese peso
  cadaKgPierde: boolean
}

// Hasta dónde puede moverse cada variable (las demás quietas) antes de que el
// resultado por animal baje del objetivo. Tiene en cuenta la mortandad.
export function limites(e: Escenario, objetivo = 0): Limites {
  const r = calcular(e)
  const cc = pct(e.comisionCompra)
  const cv = pct(e.comisionVenta)
  const kgPagadosPorKgVivo = e.tipoVenta === 'gancho' ? pct(e.rendGancho) : 1 - pct(e.desbasteVenta)
  const m = Math.min(Math.max(pct(e.mortandad), 0), 1)
  const vivos = 1 - m
  const fProd = 1 - m / 2

  // R = vivos·ingresoNeto − costoCompraTotal − fProd·costoProduccion
  const disponibleCompra = vivos * r.ingresoNeto - fProd * r.costoProduccion - objetivo

  const precioMaxTotalCompraKg = r.pesoPagadoCompra > 0 ? disponibleCompra / r.pesoPagadoCompra : null

  const precioMaxCompra =
    r.pesoPagadoCompra > 0
      ? (disponibleCompra - e.fleteCompra - e.otrosCompra) / (r.pesoPagadoCompra * (1 + cc))
      : null

  const precioMinVenta =
    r.pesoPagadoVenta > 0 && cv < 1 && vivos > 0
      ? ((r.plataNecesaria + objetivo) / vivos + e.fleteVenta) / (r.pesoPagadoVenta * (1 - cv))
      : null

  const costoMaxKg =
    r.kgProducir > 0 && fProd > 0
      ? (vivos * r.ingresoNeto - r.costoCompraTotal - objetivo) / (fProd * r.kgProducir)
      : null

  // Resultado según peso de salida W (costo por kg producido c constante):
  // R(W) = vivos·(W·k·pv·(1−cv) − fleteV) − costoCompraTotal − fProd·(W − Wi)·c, k = kg pagados por kg vivo
  const pendiente = vivos * kgPagadosPorKgVivo * e.precioVenta * (1 - cv) - fProd * r.costoKgProducido
  let pesoMinVenta: number | null = null
  if (pendiente > 0) {
    const fijo = vivos * e.fleteVenta + r.costoCompraTotal - fProd * r.pesoInicio * r.costoKgProducido
    pesoMinVenta = (fijo + objetivo) / pendiente
  }
  const diasMinimos =
    pesoMinVenta !== null && e.gdp > 0 ? Math.max(0, (pesoMinVenta - r.pesoInicio) / e.gdp) : null

  return {
    objetivo,
    precioMaxTotalCompraKg,
    precioMaxCompra,
    precioMinVenta,
    costoMaxKg,
    pesoMinVenta,
    diasMinimos,
    cadaKgPierde: pendiente <= 0,
  }
}

// Época del año, como referencia general para las tierras bajas de Bolivia.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function epoca(f: string | null): string {
  if (!f) return ''
  const mes = +f.slice(5, 7)
  return mes >= 5 && mes <= 10 ? 'época seca' : 'época de lluvias'
}
export function fechaCorta(f: string | null): string {
  if (!f) return '—'
  return `${+f.slice(8, 10)} ${MESES[+f.slice(5, 7) - 1]} ${f.slice(0, 4)}`
}
