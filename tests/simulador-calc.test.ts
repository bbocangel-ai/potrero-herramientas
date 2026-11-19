// Pruebas del cálculo del simulador. Correr con: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcular, limites, escenarioEjemplo, type Escenario } from '../src/lib/simulador-calc.ts'

const cerca = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperaba ${b}, salió ${a}`)

const base = (): Escenario => ({
  ...escenarioEjemplo(),
  pesoCompra: 200,
  desbasteCompra: 3,
  precioCompra: 20,
  fleteCompra: 40,
  comisionCompra: 1,
  otrosCompra: 20,
  pesoVenta: 420,
  desbasteVenta: 3,
  precioVenta: 17,
  comisionVenta: 1,
  fleteVenta: 0,
  rendGancho: 52,
  tipoVenta: 'vivo',
  gdp: 0.6,
  mortandad: 0,
  modoCosto: 'simple',
  costoKg: 7,
  modoVenta: 'peso',
  fechaCompra: '2026-11-18',
  fechaVenta: '2027-11-18',
})

// Variantes para probar que las identidades valen en todos los casos
const variantes = (): Escenario[] => [
  base(),
  { ...base(), precioCompra: 25, fleteVenta: 50 },
  { ...base(), modoCosto: 'detallado' },
  { ...base(), mortandad: 2, fleteVenta: 30 },
  { ...base(), modoVenta: 'fecha', fechaVenta: '2027-09-01', mortandad: 1.5 },
  { ...base(), tipoVenta: 'gancho', precioVenta: 33, comisionVenta: 2, fleteVenta: 40 },
  { ...base(), tipoVenta: 'gancho', precioVenta: 30, mortandad: 1, modoCosto: 'detallado' },
]

test('cálculo a mano del ejemplo', () => {
  const r = calcular(base())
  cerca(r.pesoPagadoCompra, 194)
  cerca(r.valorCompra, 3880)
  cerca(r.gastosCompra, 40 + 38.8 + 20)
  cerca(r.kgProducir, 226)
  cerca(r.dias, 226 / 0.6)
  cerca(r.costoProduccion, 1582)
  cerca(r.plataNecesaria, 3880 + 98.8 + 1582)
  cerca(r.pesoPagadoVenta, 407.4)
  cerca(r.kgDesbasteVenta, 12.6)
  cerca(r.ventaBruta, 6925.8)
  cerca(r.ingresoNeto, 6925.8 * 0.99)
  cerca(r.resultado, 6925.8 * 0.99 - (3880 + 98.8 + 1582))
  assert.equal(r.ok, true)
})

test('el desbaste descuenta kilos: precio neto por kg pagado no incluye desbaste', () => {
  const r = calcular({ ...base(), desbasteVenta: 10 })
  cerca(r.pesoPagadoVenta, 378)
  cerca(r.precioNetoVentaKg, 17 * 0.99) // solo la comisión baja el precio
})

test('el puente suma el resultado', () => {
  for (const e of variantes()) {
    const r = calcular(e)
    const p = r.puente
    cerca(p.agio + p.margenKgProducidos + p.desbasteVenta + p.mortandad, r.resultado, 1e-6)
  }
})

test('ágio: precio total de compra − precio neto de venta, por kg pagado', () => {
  const r = calcular(base())
  const pc = (3880 + 98.8) / 194
  const pv = 17 * 0.99
  cerca(r.precioTotalCompraKg, pc)
  cerca(r.agioKg, pc - pv)
  cerca(r.agioTotal, (pc - pv) * 194)
  // los kg producidos que hacen falta para cubrirlo
  cerca(r.kgParaCubrirAgio!, r.agioTotal / (pv - 7))
})

test('indicadores por kg y kg gancho', () => {
  const r = calcular(base())
  cerca(r.margenPorKgProducido, 17 * 0.99 - 7)
  cerca(r.resultadoPorKgProducido, r.resultado / 226)
  cerca(r.relacionCompraVenta, (17 * 0.99) / r.precioTotalCompraKg)
  cerca(r.pesoGancho, 420 * 0.52)
  cerca(r.precioNetoVentaGancho, r.ingresoNeto / (420 * 0.52))
  cerca(r.costoKgGanchoProducido, 7 / 0.52)
})

test('mortandad: se pierde la venta de los muertos y medio ciclo de su costo', () => {
  const sin = calcular(base())
  const con = calcular({ ...base(), mortandad: 2 })
  cerca(con.resultado, sin.ingresoNeto * 0.98 - sin.costoCompraTotal - sin.costoProduccion * 0.99)
  assert.ok(con.resultado < sin.resultado)
})

test('costo por kg fijo: cambiar la GDP no cambia el costo total, solo los días', () => {
  const lento = calcular({ ...base(), gdp: 0.4 })
  const rapido = calcular({ ...base(), gdp: 0.8 })
  cerca(lento.costoProduccion, rapido.costoProduccion)
  cerca(lento.resultado, rapido.resultado)
  assert.ok(rapido.dias < lento.dias)
  assert.ok(rapido.resultadoMes > lento.resultadoMes)
})

test('modo detallado: el costo depende del tiempo', () => {
  const e = { ...base(), modoCosto: 'detallado' as const }
  const lento = calcular({ ...e, gdp: 0.4 })
  const rapido = calcular({ ...e, gdp: 0.8 })
  assert.ok(lento.costoProduccion > rapido.costoProduccion)
  cerca(rapido.costoProduccion, 125 * (226 / 0.8 / 30.4))
})

test('en cada límite el resultado queda en el objetivo', () => {
  for (const objetivo of [0, 500]) {
    for (const e of variantes()) {
      const l = limites(e, objetivo)
      const r = calcular(e)
      cerca(calcular({ ...e, precioCompra: l.precioMaxCompra! }).resultado, objetivo, 1e-6)
      cerca(calcular({ ...e, precioVenta: l.precioMinVenta! }).resultado, objetivo, 1e-6)
      // precio total máximo: se reemplaza todo el costo de compra
      const fProd = 1 - e.mortandad / 200
      cerca(r.ingresoNeto * (1 - e.mortandad / 100) - l.precioMaxTotalCompraKg! * r.pesoPagadoCompra - r.costoProduccion * fProd, objetivo, 1e-6)
      if (e.modoVenta === 'peso') {
        cerca(calcular({ ...e, modoCosto: 'simple', costoKg: l.costoMaxKg! }).resultado, objetivo, 1e-6)
        if (l.pesoMinVenta !== null) cerca(calcular({ ...e, pesoVenta: l.pesoMinVenta }).resultado, objetivo, 1e-6)
      }
    }
  }
})

test('si cada kg agregado cuesta más de lo que vale, no hay peso mínimo', () => {
  const l = limites({ ...base(), costoKg: 30 })
  assert.equal(l.cadaKgPierde, true)
  assert.equal(l.pesoMinVenta, null)
})

test('fechas: la salida cae en entrada + días', () => {
  const r = calcular(base())
  assert.equal(r.fechaCompra, '2026-11-18')
  // 226 kg ÷ 0,6 = 376,7 días → 377
  assert.equal(r.fechaVenta, '2027-11-30')
})

test('salir en una fecha: la GDP define el peso', () => {
  const e: Escenario = { ...base(), modoVenta: 'fecha', fechaCompra: '2026-01-01', fechaVenta: '2026-12-27' }
  const r = calcular(e)
  assert.equal(r.dias, 360)
  cerca(r.pesoVenta, 194 + 0.6 * 360)
  assert.equal(r.ok, true)
  cerca(calcular({ ...base(), pesoVenta: r.pesoVenta }).resultado, r.resultado, 1e-6)
  assert.equal(calcular({ ...e, fechaVenta: '2025-12-01' }).ok, false)
})

test('valida datos imposibles', () => {
  assert.equal(calcular({ ...base(), pesoVenta: 150 }).ok, false)
  assert.equal(calcular({ ...base(), gdp: 0 }).ok, false)
})

test('venta al gancho: se cobra kg vivos × rendimiento, sin desbaste', () => {
  const r = calcular({ ...base(), tipoVenta: 'gancho', precioVenta: 33, rendGancho: 52 })
  cerca(r.pesoPagadoVenta, 420 * 0.52)
  cerca(r.kgDesbasteVenta, 0)
  cerca(r.ventaBruta, 420 * 0.52 * 33)
  // el precio para comparar con la compra queda por kg vivo
  cerca(r.precioNetoVentaKg, (420 * 0.52 * 33 * 0.99) / 420)
  assert.equal(calcular({ ...base(), tipoVenta: 'gancho', rendGancho: 0 }).ok, false)
})

test('ágio en %', () => {
  const r = calcular(base())
  cerca(r.agioPct, 20 / 17 - 1)
  cerca(r.agioPctTotal, r.precioTotalCompraKg / r.precioNetoVentaKg - 1)
  const g = calcular({ ...base(), tipoVenta: 'gancho', precioVenta: 34, rendGancho: 50 })
  cerca(g.agioPct, 20 / 17 - 1) // 34 por kg gancho al 50 % = 17 por kg vivo
})

test('rentabilidad mensual y totales del lote', () => {
  const r = calcular({ ...base(), cabezas: 50, mortandad: 2 })
  cerca(r.rentabilidadMensual, r.rendimientoCiclo / r.meses)
  cerca(r.compraLote, r.costoCompraTotal * 50)
  cerca(r.ventaLote, r.ingresoNeto * 0.98 * 50)
  cerca(r.ventaLote - r.compraLote - r.produccionLote, r.resultadoLote)
  cerca(r.animalesVendidos, 49)
})
