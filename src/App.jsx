import { useState, useEffect, useRef } from "react";

/* ============================================================
   LIGA CARPINCHO — App de torneos de póker entre amigos
   Mobile-first · Tema: carpincho 🧡
   ============================================================ */

const STORAGE_KEY = "liga-carpincho-v1";

const CONFIG_DEFAULT = {
  buyIn: 20000,
  addOn: 30000,
  maxEntradas: 3,
  premios: [50, 30, 10], // 1º, 2º, 3º (%)
  casa: 10, // % para la caja
  puntos: [20, 15, 12, 10, 8, 6, 5, 4, 3, 2], // puntos por posición 1..10
};

const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Math.round(n)) + " Gs";
const uid = () => Math.random().toString(36).slice(2, 10);
const hoy = () =>
  new Date().toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });

/* ---------- Carpincho SVG ---------- */
function Capi({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* mandarina */}
      <circle cx="32" cy="12" r="7" fill="#E8863A" />
      <ellipse cx="32" cy="6.5" rx="2.6" ry="1.4" fill="#4C7A43" transform="rotate(-20 32 6.5)" />
      {/* orejas */}
      <circle cx="17" cy="20" r="5" fill="#8B5E3C" />
      <circle cx="47" cy="20" r="5" fill="#8B5E3C" />
      {/* cabeza */}
      <rect x="11" y="17" width="42" height="38" rx="17" fill="#A9744F" />
      {/* hocico */}
      <ellipse cx="32" cy="45" rx="15" ry="10.5" fill="#C89F6F" />
      <circle cx="27" cy="44" r="1.7" fill="#5B4030" />
      <circle cx="37" cy="44" r="1.7" fill="#5B4030" />
      <path d="M32 47 v3" stroke="#5B4030" strokeWidth="1.6" strokeLinecap="round" />
      {/* ojos */}
      <circle cx="22" cy="32" r="2.4" fill="#2B241C" />
      <circle cx="42" cy="32" r="2.4" fill="#2B241C" />
      {/* cachetes */}
      <circle cx="17.5" cy="37" r="2.6" fill="#E8863A" opacity="0.35" />
      <circle cx="46.5" cy="37" r="2.6" fill="#E8863A" opacity="0.35" />
    </svg>
  );
}

/* ---------- Persistencia (localStorage del navegador) ---------- */
function cargar() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const d = JSON.parse(r);
      return { config: { ...CONFIG_DEFAULT, ...d.config }, jugadores: d.jugadores || [], torneos: d.torneos || [] };
    }
  } catch (e) {
    /* sin datos guardados todavía */
  }
  return { config: CONFIG_DEFAULT, jugadores: [], torneos: [] };
}

export default function LigaCarpincho() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("torneo");
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    setData(cargar());
  }, []);

  const guardar = (nuevo) => {
    setData(nuevo);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevo));
    } catch (e) {
      console.error("No se pudo guardar", e);
    }
  };

  const avisar = (msg) => {
    setAviso(msg);
    setTimeout(() => setAviso(null), 2600);
  };

  if (!data)
    return (
      <div className="lc-load">
        <Capi size={64} />
        <p>Cargando la liga…</p>
        <style>{css}</style>
      </div>
    );

  const torneo = data.torneos.find((t) => !t.cerrado) || null;

  return (
    <div className="lc-root">
      <style>{css}</style>

      <header className="lc-header">
        <Capi size={46} />
        <div>
          <h1>Liga Carpincho</h1>
          <span className="lc-sub">Póker entre amigos · {new Date().getFullYear()}</span>
        </div>
      </header>

      {aviso && <div className="lc-toast">{aviso}</div>}

      <main className="lc-main">
        {tab === "torneo" && (
          <TabTorneo data={data} guardar={guardar} torneo={torneo} avisar={avisar} />
        )}
        {tab === "mesa" && <TabMesa data={data} guardar={guardar} torneo={torneo} avisar={avisar} />}
        {tab === "ranking" && <TabRanking data={data} />}
        {tab === "ajustes" && <TabAjustes data={data} guardar={guardar} avisar={avisar} />}
      </main>

      <nav className="lc-nav">
        {[
          ["torneo", "♠", "Torneo"],
          ["mesa", "◎", "Mesa"],
          ["ranking", "★", "Ranking"],
          ["ajustes", "⚙", "Ajustes"],
        ].map(([k, ic, label]) => (
          <button
            key={k}
            className={tab === k ? "activo" : ""}
            onClick={() => setTab(k)}
          >
            <span className="ic">{ic}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ============================================================
   TAB: TORNEO
   ============================================================ */
function TabTorneo({ data, guardar, torneo, avisar }) {
  const [nombreNuevo, setNombreNuevo] = useState("");
  const cfg = data.config;

  const crearTorneo = () => {
    const t = {
      id: uid(),
      fecha: hoy(),
      entradas: {}, // jugadorId -> {buyins, addon}
      posiciones: {}, // jugadorId -> pos
      historialElim: [],
      asientos: {}, // nro -> jugadorId
      cantAsientos: 0,
      cerrado: false,
    };
    guardar({ ...data, torneos: [...data.torneos, t] });
  };

  if (!torneo) {
    const cerrados = [...data.torneos].filter((t) => t.cerrado).reverse();
    return (
      <div>
        <div className="lc-card lc-vacio">
          <Capi size={56} />
          <p>No hay torneo en juego.</p>
          <button className="lc-btn primario" onClick={crearTorneo}>
            Empezar torneo de hoy
          </button>
        </div>
        {cerrados.length > 0 && (
          <>
            <h2 className="lc-h2">Torneos anteriores</h2>
            {cerrados.map((t) => (
              <ResumenTorneo key={t.id} t={t} data={data} />
            ))}
          </>
        )}
      </div>
    );
  }

  /* ----- torneo activo ----- */
  const jugadoresT = Object.keys(torneo.entradas);
  const total = jugadoresT.length;
  const asignadas = Object.keys(torneo.posiciones).length;

  const actualizarTorneo = (cambios) => {
    guardar({
      ...data,
      torneos: data.torneos.map((t) => (t.id === torneo.id ? { ...t, ...cambios } : t)),
    });
  };

  const agregarJugador = () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    let jugadores = data.jugadores;
    let j = jugadores.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (!j) {
      j = { id: uid(), nombre };
      jugadores = [...jugadores, j];
    }
    if (torneo.entradas[j.id]) {
      avisar(`${j.nombre} ya está anotado`);
      return;
    }
    guardar({
      ...data,
      jugadores,
      torneos: data.torneos.map((t) =>
        t.id === torneo.id
          ? { ...t, entradas: { ...t.entradas, [j.id]: { buyins: 1, addon: false } } }
          : t
      ),
    });
    setNombreNuevo("");
  };

  const quitarJugador = (jid) => {
    const entradas = { ...torneo.entradas };
    delete entradas[jid];
    const asientos = { ...torneo.asientos };
    for (const s of Object.keys(asientos)) if (asientos[s] === jid) delete asientos[s];
    actualizarTorneo({ entradas, asientos });
  };

  const cambiarBuyins = (jid, delta) => {
    const e = torneo.entradas[jid];
    const nuevo = Math.max(1, e.buyins + delta);
    if (delta > 0 && nuevo > cfg.maxEntradas)
      avisar(`Ojo: supera el acuerdo de ${cfg.maxEntradas} entradas (excepción)`);
    actualizarTorneo({
      entradas: { ...torneo.entradas, [jid]: { ...e, buyins: nuevo } },
    });
  };

  const toggleAddon = (jid) => {
    const e = torneo.entradas[jid];
    actualizarTorneo({
      entradas: { ...torneo.entradas, [jid]: { ...e, addon: !e.addon } },
    });
  };

  const eliminarJugador = (jid) => {
    const pos = total - asignadas;
    const posiciones = { ...torneo.posiciones, [jid]: pos };
    const historial = [...torneo.historialElim, jid];
    // si queda uno solo sin posición → campeón
    const restantes = jugadoresT.filter((id) => !posiciones[id]);
    if (restantes.length === 1) {
      posiciones[restantes[0]] = 1;
      historial.push(restantes[0]);
    }
    actualizarTorneo({ posiciones, historialElim: historial });
  };

  const esUltimoElim = (jid) =>
    torneo.historialElim.length > 0 &&
    torneo.historialElim[torneo.historialElim.length - 1] === jid;

  const deshacerElim = () => {
    if (torneo.historialElim.length === 0) return;
    const historial = [...torneo.historialElim];
    const ultimo = historial.pop();
    const posiciones = { ...torneo.posiciones };
    delete posiciones[ultimo];
    actualizarTorneo({ posiciones, historialElim: historial });
  };

  const cerrarTorneo = () => {
    if (asignadas < total) {
      avisar("Faltan posiciones por definir");
      return;
    }
    actualizarTorneo({ cerrado: true });
    avisar("Torneo cerrado. ¡Puntos sumados al ranking!");
  };

  /* pozo */
  const pozo = jugadoresT.reduce((acc, jid) => {
    const e = torneo.entradas[jid];
    return acc + e.buyins * cfg.buyIn + (e.addon ? cfg.addOn : 0);
  }, 0);

  const nombreDe = (jid) => data.jugadores.find((j) => j.id === jid)?.nombre || "?";
  const ordenados = [...jugadoresT].sort((a, b) => {
    const pa = torneo.posiciones[a] || 999;
    const pb = torneo.posiciones[b] || 999;
    return pa - pb || nombreDe(a).localeCompare(nombreDe(b));
  });

  return (
    <div>
      <div className="lc-fila-titulo">
        <h2 className="lc-h2">Torneo del {torneo.fecha}</h2>
        <span className="lc-pill">{total} jugadores</span>
      </div>

      {/* agregar jugador */}
      <div className="lc-card">
        <div className="lc-agregar">
          <input
            list="roster"
            placeholder="Nombre del jugador…"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregarJugador()}
          />
          <datalist id="roster">
            {data.jugadores
              .filter((j) => !torneo.entradas[j.id])
              .map((j) => (
                <option key={j.id} value={j.nombre} />
              ))}
          </datalist>
          <button className="lc-btn primario" onClick={agregarJugador}>
            Anotar
          </button>
        </div>
      </div>

      {/* lista de jugadores */}
      {ordenados.map((jid) => {
        const e = torneo.entradas[jid];
        const pos = torneo.posiciones[jid];
        const excede = e.buyins > cfg.maxEntradas;
        const eliminado = !!pos;
        return (
          <div key={jid} className={"lc-card lc-jug" + (eliminado ? " out" : "")}>
            <div className="lc-jug-top">
              <div className="lc-jug-nombre">
                {pos === 1 && <span className="medalla oro">1º</span>}
                {pos === 2 && <span className="medalla plata">2º</span>}
                {pos === 3 && <span className="medalla bronce">3º</span>}
                {pos > 3 && <span className="medalla gris">{pos}º</span>}
                {nombreDe(jid)}
                {excede && <span className="lc-excepcion">excepción</span>}
              </div>
              {esUltimoElim(jid) && !torneo.cerrado && (
                <button className="lc-deshacer" onClick={deshacerElim}>
                  ↩ deshacer
                </button>
              )}
              {!eliminado && asignadas === 0 && (
                <button className="lc-x" onClick={() => quitarJugador(jid)} title="Quitar">
                  ✕
                </button>
              )}
            </div>
            <div className="lc-jug-controles">
              <div className="lc-contador">
                <button onClick={() => cambiarBuyins(jid, -1)} disabled={e.buyins <= 1}>
                  −
                </button>
                <span>
                  {e.buyins} <small>entrada{e.buyins > 1 ? "s" : ""}</small>
                </span>
                <button onClick={() => cambiarBuyins(jid, 1)}>+</button>
              </div>
              <button
                className={"lc-chip" + (e.addon ? " on" : "")}
                onClick={() => toggleAddon(jid)}
              >
                Add-on
              </button>
              <span className="lc-monto">
                {fmtGs(e.buyins * cfg.buyIn + (e.addon ? cfg.addOn : 0))}
              </span>
            </div>
            {!eliminado && total >= 2 && (
              <button className="lc-btn eliminar" onClick={() => eliminarJugador(jid)}>
                Marcar eliminado ({total - asignadas}º puesto)
              </button>
            )}
          </div>
        );
      })}

      {/* pozo y premios */}
      <h2 className="lc-h2">Pozo y premios</h2>
      <div className="lc-card lc-pozo">
        <div className="lc-pozo-total">
          <span>Pozo total</span>
          <strong>{fmtGs(pozo)}</strong>
        </div>
        <div className="lc-premios">
          {cfg.premios.map((p, i) => (
            <div key={i}>
              <span>
                {i + 1}º · {p}%
              </span>
              <strong>{fmtGs((pozo * p) / 100)}</strong>
            </div>
          ))}
          <div>
            <span>Casa · {cfg.casa}%</span>
            <strong>{fmtGs((pozo * cfg.casa) / 100)}</strong>
          </div>
        </div>
      </div>

      {asignadas === total && total > 0 && (
        <button className="lc-btn primario grande" onClick={cerrarTorneo}>
          Cerrar torneo y sumar puntos
        </button>
      )}
    </div>
  );
}

function ResumenTorneo({ t, data }) {
  const nombreDe = (jid) => data.jugadores.find((j) => j.id === jid)?.nombre || "?";
  const cfg = data.config;
  const pozo = Object.keys(t.entradas).reduce((acc, jid) => {
    const e = t.entradas[jid];
    return acc + e.buyins * cfg.buyIn + (e.addon ? cfg.addOn : 0);
  }, 0);
  const ganador = Object.keys(t.posiciones).find((jid) => t.posiciones[jid] === 1);
  return (
    <div className="lc-card lc-resumen">
      <div>
        <strong>{t.fecha}</strong>
        <span>
          {Object.keys(t.entradas).length} jugadores · pozo {fmtGs(pozo)}
        </span>
      </div>
      {ganador && (
        <span className="lc-ganador">
          <span className="medalla oro">1º</span> {nombreDe(ganador)}
        </span>
      )}
    </div>
  );
}

/* ============================================================
   TAB: MESA (sorteo de posiciones, con animacion y audio)
   ============================================================ */
function TabMesa({ data, guardar, torneo, avisar }) {
  const [asignando, setAsignando] = useState(null); // nro de asiento libre elegido
  const [anim, setAnim] = useState(null); // {asientos, orden, revelados, nAsientos}
  const [cantTxt, setCantTxt] = useState(""); // texto libre del campo Asientos
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const a = new Audio(import.meta.env.BASE_URL + "sorteo.mp3");
    a.preload = "auto";
    audioRef.current = a;
    return () => {
      a.pause();
      clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (torneo)
      setCantTxt(
        String(torneo.cantAsientos || Object.keys(torneo.entradas).length || "")
      );
  }, [torneo && torneo.id]);

  if (!torneo)
    return (
      <div className="lc-card lc-vacio">
        <Capi size={56} />
        <p>Primero empeza un torneo en la pestana ♠ Torneo.</p>
      </div>
    );

  const jugadoresT = Object.keys(torneo.entradas);
  const nombreDe = (jid) => data.jugadores.find((j) => j.id === jid)?.nombre || "?";

  const actualizarTorneo = (cambios) => {
    guardar({
      ...data,
      torneos: data.torneos.map((t) => (t.id === torneo.id ? { ...t, ...cambios } : t)),
    });
  };

  const cant = torneo.cantAsientos || jugadoresT.length;

  const clampAsientos = (v) => {
    const min = Math.max(jugadoresT.length, 2);
    if (isNaN(v)) return Math.max(cant || 0, min);
    return Math.min(12, Math.max(min, v));
  };
  const cantElegida = clampAsientos(parseInt(cantTxt, 10));

  const finalizarSorteo = (asientos, nAsientos, cortarAudio) => {
    clearTimeout(timerRef.current);
    if (cortarAudio && audioRef.current) audioRef.current.pause();
    setAnim(null);
    actualizarTorneo({ asientos, cantAsientos: nAsientos });
    avisar("¡Posiciones sorteadas!");
  };

  const sortear = (n) => {
    if (anim) return;
    if (jugadoresT.length === 0) {
      avisar("Anota jugadores primero");
      return;
    }
    const nAsientos = Math.max(n, jugadoresT.length);
    setCantTxt(String(nAsientos));
    // baraja de asientos 1..N (como separar las cartas y embarajar)
    const baraja = Array.from({ length: nAsientos }, (_, i) => i + 1);
    for (let i = baraja.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [baraja[i], baraja[j]] = [baraja[j], baraja[i]];
    }
    const asientos = {};
    jugadoresT.forEach((jid, i) => {
      asientos[baraja[i]] = jid;
    });

    // audio + ritmo de la revelacion segun su duracion
    const a = audioRef.current;
    let dur = 20.3;
    try {
      a.currentTime = 0;
      const pr = a.play();
      if (pr && pr.catch) pr.catch(() => {});
      if (isFinite(a.duration) && a.duration > 1) dur = a.duration;
    } catch (e) {
      /* sin audio, la animacion sigue igual */
    }

    const orden = Object.keys(asientos)
      .map(Number)
      .sort((x, y) => x - y);
    const intro = 2200; // fase de "barajando"
    const paso = Math.min(1800, Math.max(500, (dur * 1000 - intro - 800) / orden.length));

    setAnim({ asientos, orden, revelados: 0, nAsientos });

    let i = 0;
    const tick = () => {
      i += 1;
      setAnim((prev) => (prev ? { ...prev, revelados: i } : prev));
      if (i < orden.length) timerRef.current = setTimeout(tick, paso);
      else timerRef.current = setTimeout(() => finalizarSorteo(asientos, nAsientos, false), 1000);
    };
    timerRef.current = setTimeout(tick, intro);
  };

  const sinAsiento = jugadoresT.filter(
    (jid) => !Object.values(torneo.asientos).includes(jid)
  );

  const elegirAsiento = (nro) => {
    if (torneo.asientos[nro]) return;
    if (sinAsiento.length === 0) {
      avisar("Todos ya tienen asiento");
      return;
    }
    setAsignando(nro);
  };

  const asignarJugador = (jid) => {
    actualizarTorneo({ asientos: { ...torneo.asientos, [asignando]: jid } });
    setAsignando(null);
  };

  const liberarAsiento = (nro) => {
    const asientos = { ...torneo.asientos };
    delete asientos[nro];
    actualizarTorneo({ asientos });
  };

  /* durante la animacion se muestra el sorteo nuevo; si no, lo guardado */
  const asientosView = anim ? anim.asientos : torneo.asientos;
  const cantView = anim ? anim.nAsientos : cant;
  const revelado = (nro) => !anim || anim.orden.indexOf(nro) < anim.revelados;

  /* posiciones alrededor de la mesa ovalada */
  const seats = Array.from({ length: cantView }, (_, i) => i + 1);
  const puntosMesa = seats.map((nro, i) => {
    const ang = (i / cantView) * 2 * Math.PI - Math.PI / 2;
    return { nro, x: 50 + 41 * Math.sin(ang), y: 50 - 41 * Math.cos(ang) };
  });

  return (
    <div>
      <h2 className="lc-h2">Sorteo de la mesa</h2>
      <div className="lc-card">
        <div className="lc-sorteo-controles">
          <label>
            Asientos
            <input
              type="number"
              inputMode="numeric"
              min={jugadoresT.length || 2}
              max={12}
              value={cantTxt}
              disabled={!!anim}
              onChange={(e) => setCantTxt(e.target.value)}
              onBlur={() => {
                const v = clampAsientos(parseInt(cantTxt, 10));
                setCantTxt(String(v));
                actualizarTorneo({ cantAsientos: v });
              }}
            />
          </label>
          <button className="lc-btn primario" disabled={!!anim} onClick={() => sortear(cantElegida)}>
            {anim ? "Sorteando…" : "🂠 Sortear posiciones"}
          </button>
        </div>
        <p className="lc-nota">
          Se "embarajan" {cantElegida} cartas y cada jugador recibe su asiento al azar. Los asientos
          libres quedan en espera: cuando llegue alguien, toca un asiento libre y elegilo.
        </p>
      </div>

      {/* mesa ovalada */}
      <div className="lc-mesa-wrap">
        <div className="lc-mesa">
          <div className="lc-mesa-centro">
            {anim ? (
              <div className="lc-baraja">
                <span className="lc-cartita c1" />
                <span className="lc-cartita c2" />
                <span className="lc-cartita c3" />
                <span className="txt">Barajando…</span>
              </div>
            ) : (
              <>
                <Capi size={40} />
                <span>{jugadoresT.length} en juego</span>
              </>
            )}
          </div>
          {puntosMesa.map(({ nro, x, y }) => {
            const jid = asientosView[nro];
            const eliminado = jid && torneo.posiciones[jid];
            const oculto = anim && jid && !revelado(nro);
            const recien = anim && jid && revelado(nro);
            return (
              <button
                key={nro}
                disabled={!!anim}
                className={
                  "lc-asiento" +
                  (jid ? " ocupado" : " libre") +
                  (eliminado ? " out" : "") +
                  (oculto ? " oculto" : "") +
                  (recien ? " recien" : "")
                }
                style={{ left: x + "%", top: y + "%" }}
                onClick={() => (jid ? liberarAsiento(nro) : elegirAsiento(nro))}
              >
                {oculto ? (
                  <span className="lc-dorso" />
                ) : (
                  <>
                    <span className="nro">{nro}</span>
                    <span className="nom">{jid ? nombreDe(jid) : "Libre"}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {anim && (
        <button
          className="lc-btn fantasma"
          onClick={() => finalizarSorteo(anim.asientos, anim.nAsientos, true)}
        >
          Saltar animacion ⏭
        </button>
      )}

      {!anim && sinAsiento.length > 0 && (
        <p className="lc-nota centro">
          Sin asiento: {sinAsiento.map(nombreDe).join(", ")}
        </p>
      )}

      {asignando && (
        <div className="lc-modal" onClick={() => setAsignando(null)}>
          <div className="lc-modal-caja" onClick={(e) => e.stopPropagation()}>
            <h3>Asiento {asignando} · ¿quien se sienta?</h3>
            {sinAsiento.map((jid) => (
              <button key={jid} className="lc-btn opcion" onClick={() => asignarJugador(jid)}>
                {nombreDe(jid)}
              </button>
            ))}
            <button className="lc-btn fantasma" onClick={() => setAsignando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: RANKING
   ============================================================ */
function TabRanking({ data }) {
  const cfg = data.config;
  const cerrados = data.torneos.filter((t) => t.cerrado);

  const stats = {};
  for (const t of cerrados) {
    for (const jid of Object.keys(t.posiciones)) {
      const pos = t.posiciones[jid];
      if (!stats[jid])
        stats[jid] = { puntos: 0, torneos: 0, p1: 0, p2: 0, p3: 0 };
      stats[jid].torneos += 1;
      stats[jid].puntos += cfg.puntos[pos - 1] || 0;
      if (pos === 1) stats[jid].p1 += 1;
      if (pos === 2) stats[jid].p2 += 1;
      if (pos === 3) stats[jid].p3 += 1;
    }
  }

  const filas = Object.keys(stats)
    .map((jid) => ({
      jid,
      nombre: data.jugadores.find((j) => j.id === jid)?.nombre || "?",
      ...stats[jid],
    }))
    .sort((a, b) => b.puntos - a.puntos || b.p1 - a.p1 || a.nombre.localeCompare(b.nombre));

  if (filas.length === 0)
    return (
      <div className="lc-card lc-vacio">
        <Capi size={56} />
        <p>
          El ranking aparece cuando se cierra el primer torneo. El carpincho de oro espera a su
          dueño…
        </p>
      </div>
    );

  return (
    <div>
      <h2 className="lc-h2">Ranking de la liga</h2>
      <p className="lc-nota">
        Puntos por posición: {cfg.puntos.map((p, i) => `${i + 1}º=${p}`).join(" · ")}
      </p>
      <div className="lc-card lc-tabla">
        <div className="lc-tr head">
          <span>#</span>
          <span className="izq">Jugador</span>
          <span>🥇</span>
          <span>🥈</span>
          <span>🥉</span>
          <span>Pts</span>
        </div>
        {filas.map((f, i) => (
          <div key={f.jid} className={"lc-tr" + (i === 0 ? " lider" : "")}>
            <span>{i + 1}</span>
            <span className="izq">
              {i === 0 && "🧡 "}
              {f.nombre}
            </span>
            <span>{f.p1 || "·"}</span>
            <span>{f.p2 || "·"}</span>
            <span>{f.p3 || "·"}</span>
            <span className="pts">{f.puntos}</span>
          </div>
        ))}
      </div>
      <p className="lc-nota centro">
        {cerrados.length} torneo{cerrados.length !== 1 ? "s" : ""} jugado
        {cerrados.length !== 1 ? "s" : ""} · el 1º del año se lleva el trofeo carpincho
      </p>
    </div>
  );
}

/* ============================================================
   TAB: AJUSTES
   ============================================================ */
function TabAjustes({ data, guardar, avisar }) {
  const cfg = data.config;

  const setCfg = (cambios) => guardar({ ...data, config: { ...cfg, ...cambios } });

  const setPunto = (i, v) => {
    const puntos = [...cfg.puntos];
    puntos[i] = parseInt(v) || 0;
    setCfg({ puntos });
  };

  const setPremio = (i, v) => {
    const premios = [...cfg.premios];
    premios[i] = parseInt(v) || 0;
    setCfg({ premios });
  };

  const sumaPct = cfg.premios.reduce((a, b) => a + b, 0) + cfg.casa;

  return (
    <div>
      <h2 className="lc-h2">Montos</h2>
      <div className="lc-card lc-form">
        <label>
          Buy-in / entrada (Gs)
          <input
            type="number"
            step="1000"
            value={cfg.buyIn}
            onChange={(e) => setCfg({ buyIn: parseInt(e.target.value) || 0 })}
          />
        </label>
        <label>
          Add-on (Gs)
          <input
            type="number"
            step="1000"
            value={cfg.addOn}
            onChange={(e) => setCfg({ addOn: parseInt(e.target.value) || 0 })}
          />
        </label>
        <label>
          Máx. entradas acordadas
          <input
            type="number"
            min="1"
            value={cfg.maxEntradas}
            onChange={(e) => setCfg({ maxEntradas: parseInt(e.target.value) || 1 })}
          />
        </label>
        <p className="lc-nota">
          Superar el máximo está permitido: se marca como "excepción", igual que en la mesa.
        </p>
      </div>

      <h2 className="lc-h2">Reparto del pozo</h2>
      <div className="lc-card lc-form">
        {cfg.premios.map((p, i) => (
          <label key={i}>
            {i + 1}º puesto (%)
            <input type="number" value={p} onChange={(e) => setPremio(i, e.target.value)} />
          </label>
        ))}
        <label>
          Casa / caja común (%)
          <input
            type="number"
            value={cfg.casa}
            onChange={(e) => setCfg({ casa: parseInt(e.target.value) || 0 })}
          />
        </label>
        {sumaPct !== 100 && (
          <p className="lc-alerta">La suma da {sumaPct}% — revisá que llegue a 100%.</p>
        )}
      </div>

      <h2 className="lc-h2">Puntos por posición</h2>
      <div className="lc-card lc-puntos-grid">
        {cfg.puntos.map((p, i) => (
          <label key={i}>
            {i + 1}º
            <input type="number" value={p} onChange={(e) => setPunto(i, e.target.value)} />
          </label>
        ))}
      </div>

      <button
        className="lc-btn fantasma"
        onClick={() => {
          setCfg(CONFIG_DEFAULT);
          avisar("Ajustes restaurados");
        }}
      >
        Restaurar valores por defecto
      </button>
    </div>
  );
}

/* ============================================================
   ESTILOS
   ============================================================ */
const css = `
:root{
  --felt:#2F5D48; --felt-osc:#254B3A; --papel:#FAF5EC; --carta:#FFFFFF;
  --tinta:#2B241C; --marron:#8B5E3C; --tan:#C89F6F; --naranja:#E8863A;
  --linea:#E7DCC8; --suave:#7A6E5C;
}
*{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
.lc-root{min-height:100vh; background:var(--papel); color:var(--tinta);
  font-family:'Avenir Next','Segoe UI',system-ui,-apple-system,sans-serif;
  padding-bottom:84px; max-width:520px; margin:0 auto;}
.lc-load{min-height:100vh; display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:12px; background:#FAF5EC; color:#7A6E5C; font-family:system-ui;}

.lc-header{background:var(--felt); color:#fff; padding:16px 18px 14px;
  display:flex; align-items:center; gap:12px; border-radius:0 0 22px 22px;
  box-shadow:inset 0 -6px 0 var(--felt-osc);}
.lc-header h1{margin:0; font-size:22px; letter-spacing:.4px; font-weight:800;}
.lc-sub{font-size:12px; opacity:.85;}

.lc-main{padding:14px 14px 8px;}
.lc-h2{font-size:15px; text-transform:uppercase; letter-spacing:1.2px;
  color:var(--marron); margin:18px 4px 8px; font-weight:800;}
.lc-fila-titulo{display:flex; align-items:baseline; justify-content:space-between;}
.lc-pill{background:var(--tan); color:#fff; border-radius:999px; padding:3px 10px;
  font-size:12px; font-weight:700;}

.lc-card{background:var(--carta); border:1px solid var(--linea); border-radius:16px;
  padding:14px; margin-bottom:10px; box-shadow:0 1px 2px rgba(43,36,28,.05);}
.lc-vacio{display:flex; flex-direction:column; align-items:center; gap:10px;
  text-align:center; padding:28px 18px; color:var(--suave);}

.lc-btn{border:none; border-radius:12px; padding:11px 16px; font-size:15px;
  font-weight:700; cursor:pointer; font-family:inherit;}
.lc-btn.primario{background:var(--naranja); color:#fff; box-shadow:0 2px 0 #C96D25;}
.lc-btn.primario:active{transform:translateY(1px); box-shadow:none;}
.lc-btn.grande{width:100%; padding:15px; font-size:16px; margin-top:6px;}
.lc-btn.fantasma{background:transparent; color:var(--suave); width:100%;
  border:1px dashed var(--linea); margin-bottom:10px;}
.lc-btn.eliminar{width:100%; margin-top:10px; background:#F3EBDD; color:var(--marron);
  border:1px solid var(--linea); font-size:14px;}
.lc-btn.opcion{width:100%; background:var(--papel); border:1px solid var(--linea);
  margin-bottom:8px; color:var(--tinta);}

.lc-agregar{display:flex; gap:8px;}
.lc-agregar input{flex:1; min-width:0; border:1px solid var(--linea); border-radius:12px;
  padding:11px 12px; font-size:16px; font-family:inherit; background:var(--papel);}
.lc-agregar .lc-btn{flex-shrink:0; padding:11px 14px;}
.lc-deshacer{border:none; background:none; color:var(--suave); font-size:12.5px;
  font-weight:700; cursor:pointer; font-family:inherit; padding:4px 6px;
  text-decoration:underline dotted; text-underline-offset:3px;}

.lc-jug.out{opacity:.62; background:#F6F1E7;}
.lc-jug-top{display:flex; justify-content:space-between; align-items:center;}
.lc-jug-nombre{font-weight:800; font-size:16px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.lc-x{border:none; background:none; color:var(--suave); font-size:15px; cursor:pointer; padding:4px 8px;}
.medalla{border-radius:8px; padding:2px 7px; font-size:12px; font-weight:800; color:#fff;}
.medalla.oro{background:#D9A012;} .medalla.plata{background:#9AA0A6;}
.medalla.bronce{background:#B0763B;} .medalla.gris{background:#C9BFAE;}
.lc-excepcion{background:#FBE3CF; color:#B25E1B; font-size:11px; font-weight:800;
  border-radius:999px; padding:2px 8px; text-transform:uppercase; letter-spacing:.5px;}

.lc-jug-controles{display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap;}
.lc-contador{display:flex; align-items:center; gap:2px; background:var(--papel);
  border:1px solid var(--linea); border-radius:12px; overflow:hidden;}
.lc-contador button{width:40px; height:40px; border:none; background:none;
  font-size:20px; color:var(--marron); cursor:pointer; font-weight:800;}
.lc-contador button:disabled{opacity:.3;}
.lc-contador span{min-width:82px; text-align:center; font-weight:800;}
.lc-contador small{font-weight:600; color:var(--suave);}
.lc-chip{border:1.5px solid var(--linea); background:var(--carta); border-radius:999px;
  padding:8px 14px; font-weight:800; font-size:13px; color:var(--suave); cursor:pointer; font-family:inherit;}
.lc-chip.on{background:var(--felt); border-color:var(--felt); color:#fff;}
.lc-monto{margin-left:auto; font-weight:800; color:var(--marron); font-size:14px;}

.lc-pozo-total{display:flex; justify-content:space-between; align-items:baseline;
  border-bottom:1px dashed var(--linea); padding-bottom:10px; margin-bottom:10px;}
.lc-pozo-total strong{font-size:22px; color:var(--felt);}
.lc-premios div{display:flex; justify-content:space-between; padding:5px 0; font-size:14px;}
.lc-premios span{color:var(--suave);}
.lc-premios strong{font-variant-numeric:tabular-nums;}

.lc-resumen{display:flex; justify-content:space-between; align-items:center; gap:8px;}
.lc-resumen div{display:flex; flex-direction:column;}
.lc-resumen span{font-size:12.5px; color:var(--suave);}
.lc-ganador{font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;}

.lc-sorteo-controles{display:flex; gap:10px; align-items:flex-end;}
.lc-sorteo-controles label{display:flex; flex-direction:column; gap:4px; font-size:12px;
  font-weight:700; color:var(--suave);}
.lc-sorteo-controles input{width:70px; border:1px solid var(--linea); border-radius:10px;
  padding:10px; font-size:16px; text-align:center; font-family:inherit;}
.lc-sorteo-controles .lc-btn{flex:1;}
.lc-nota{font-size:12.5px; color:var(--suave); margin:8px 4px; line-height:1.45;}
.lc-nota.centro{text-align:center;}
.lc-alerta{font-size:13px; color:#B3261E; font-weight:700; margin:6px 0 0;}

.lc-mesa-wrap{padding:10px 6px;}
.lc-mesa{position:relative; width:100%; aspect-ratio:1/1.15; max-width:400px; margin:0 auto;}
.lc-mesa::before{content:''; position:absolute; inset:13%;
  background:radial-gradient(ellipse at 50% 40%, #3A6E56, var(--felt) 70%);
  border-radius:50%; border:7px solid var(--marron);
  box-shadow:inset 0 0 24px rgba(0,0,0,.28), 0 3px 8px rgba(43,36,28,.2);}
.lc-mesa-centro{position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  display:flex; flex-direction:column; align-items:center; gap:2px; color:#fff;
  font-size:11px; font-weight:700; opacity:.92; pointer-events:none;}
.lc-asiento{position:absolute; transform:translate(-50%,-50%); border:none;
  background:var(--carta); border-radius:12px; padding:5px 7px; min-width:56px;
  box-shadow:0 2px 5px rgba(43,36,28,.25); cursor:pointer; font-family:inherit;
  display:flex; flex-direction:column; align-items:center; gap:1px;}
.lc-asiento .nro{font-size:10px; font-weight:800; color:var(--tan);}
.lc-asiento .nom{font-size:12px; font-weight:800; color:var(--tinta); max-width:74px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.lc-asiento.libre{background:#F3EBDD; border:1.5px dashed var(--tan);}
.lc-asiento.libre .nom{color:var(--suave); font-weight:600;}
.lc-asiento.out{opacity:.5;}

.lc-modal{position:fixed; inset:0; background:rgba(43,36,28,.45); display:flex;
  align-items:flex-end; justify-content:center; z-index:40;}
.lc-modal-caja{background:var(--papel); width:100%; max-width:520px;
  border-radius:22px 22px 0 0; padding:18px 16px 26px;}
.lc-modal-caja h3{margin:0 0 12px; font-size:16px;}

.lc-tabla{padding:6px 10px;}
.lc-tr{display:grid; grid-template-columns:28px 1fr 34px 34px 34px 46px;
  align-items:center; padding:9px 4px; border-bottom:1px solid var(--linea);
  font-size:14px; text-align:center;}
.lc-tr:last-child{border-bottom:none;}
.lc-tr .izq{text-align:left; font-weight:700;}
.lc-tr.head{font-size:11px; text-transform:uppercase; letter-spacing:.6px;
  color:var(--suave); font-weight:800; border-bottom:2px solid var(--linea);}
.lc-tr.lider{background:#FDF3E4; border-radius:10px;}
.lc-tr .pts{font-weight:800; color:var(--felt); font-size:15px;}

.lc-form{display:flex; flex-direction:column; gap:12px;}
.lc-form label{display:flex; flex-direction:column; gap:5px; font-size:13px;
  font-weight:700; color:var(--suave);}
.lc-form input{border:1px solid var(--linea); border-radius:10px; padding:11px;
  font-size:16px; font-family:inherit; background:var(--papel);}
.lc-puntos-grid{display:grid; grid-template-columns:repeat(5,1fr); gap:8px;}
.lc-puntos-grid label{display:flex; flex-direction:column; gap:3px; font-size:12px;
  font-weight:800; color:var(--suave); text-align:center;}
.lc-puntos-grid input{border:1px solid var(--linea); border-radius:10px; padding:8px 4px;
  font-size:15px; text-align:center; font-family:inherit; background:var(--papel); width:100%;}

.lc-nav{position:fixed; bottom:0; left:0; right:0; max-width:520px; margin:0 auto;
  background:var(--carta); border-top:1px solid var(--linea); display:flex; z-index:30;
  padding-bottom:env(safe-area-inset-bottom);}
.lc-nav button{flex:1; border:none; background:none; padding:9px 0 8px; font-size:11.5px;
  font-weight:800; color:var(--suave); cursor:pointer; display:flex; flex-direction:column;
  align-items:center; gap:2px; font-family:inherit;}
.lc-nav button .ic{font-size:19px;}
.lc-nav button.activo{color:var(--naranja);}

.lc-toast{position:fixed; top:14px; left:50%; transform:translateX(-50%);
  background:var(--tinta); color:#fff; border-radius:999px; padding:10px 18px;
  font-size:14px; font-weight:700; z-index:50; box-shadow:0 4px 12px rgba(0,0,0,.25);
  max-width:90%; text-align:center;}
@media (prefers-reduced-motion:no-preference){
  .lc-toast{animation:lcpop .25s ease;}
  @keyframes lcpop{from{opacity:0; transform:translateX(-50%) translateY(-8px);}to{opacity:1;}}
}

/* --- animacion del sorteo --- */
.lc-asiento.oculto{background:transparent; box-shadow:none; padding:0; border:none;}
.lc-dorso{display:block; width:34px; height:48px; border-radius:6px;
  background:repeating-linear-gradient(45deg,#B23B2E,#B23B2E 4px,#8E2B21 4px,#8E2B21 8px);
  border:2.5px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,.32);
  animation:lcwiggle 1.1s ease-in-out infinite;}
@keyframes lcwiggle{0%,100%{transform:rotate(-4deg);}50%{transform:rotate(4deg);}}
.lc-asiento.recien{animation:lcflip .55s ease;}
@keyframes lcflip{
  from{transform:translate(-50%,-50%) rotateY(90deg) scale(.65); opacity:0;}
  to{transform:translate(-50%,-50%) rotateY(0deg) scale(1); opacity:1;}}
.lc-baraja{position:relative; width:72px; height:64px; pointer-events:none;}
.lc-cartita{position:absolute; left:20px; top:0; width:32px; height:46px; border-radius:5px;
  background:repeating-linear-gradient(45deg,#B23B2E,#B23B2E 4px,#8E2B21 4px,#8E2B21 8px);
  border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,.35);}
.lc-cartita.c1{animation:lcshuf .9s ease-in-out infinite;}
.lc-cartita.c2{animation:lcshuf .9s ease-in-out infinite .3s;}
.lc-cartita.c3{animation:lcshuf .9s ease-in-out infinite .6s;}
@keyframes lcshuf{
  0%,100%{transform:translateX(0) rotate(0);}
  33%{transform:translateX(-20px) rotate(-14deg);}
  66%{transform:translateX(20px) rotate(14deg);}}
.lc-baraja .txt{position:absolute; top:52px; left:50%; transform:translateX(-50%);
  color:#fff; font-size:11px; font-weight:800; white-space:nowrap;}
@media (prefers-reduced-motion:reduce){
  .lc-dorso,.lc-cartita,.lc-asiento.recien{animation:none;}}
`;
