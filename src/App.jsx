import { useState, useEffect, useRef } from "react";
import { conectarFirebase } from "./firebase";

/* ============================================================
   LIGA CARPINCHO — App de torneos de póker entre amigos
   Mobile-first · Tema: carpincho 🧡
   ============================================================ */

const STORAGE_KEY = "liga-carpincho-v2"; // raiz con temporadas
const STORAGE_KEY_V1 = "liga-carpincho-v1"; // datos viejos a migrar
const FUENTE_KEY = "liga-carpincho-fuente"; // preferencia de este dispositivo: local | firebase

const CONFIG_DEFAULT = {
  buyIn: 20000,
  addOn: 30000,
  maxEntradas: 3,
  premios: [50, 30, 10], // 1º, 2º, 3º (%)
  casa: 10, // % para la caja
  puntos: [20, 15, 12, 10, 8, 6, 5, 4, 3, 2], // puntos por posición 1..10
  ads: true, // mostrar "publicidad" antes de empezar un torneo
};

const ADS_VIDEOS = ["xh_7D0Nrq24", "w6qAtapjGFA", "P0P8EWoff4w"];

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

/* ---------- Persistencia (localStorage del navegador) ----------
   Estructura raiz: { fuente, temporadaActualId, temporadas: [{id, nombre, data}] }
   donde data = { config, jugadores, torneos } (una "libreta" por temporada) */
function datosVacios() {
  return { config: CONFIG_DEFAULT, jugadores: [], torneos: [] };
}

function normalizarData(d) {
  return {
    config: { ...CONFIG_DEFAULT, ...(d.config || {}) },
    jugadores: d.jugadores || [],
    torneos: d.torneos || [],
  };
}

function normalizarRaiz(d) {
  if (!(d && d.temporadas && d.temporadas.length)) return null;
  return {
    temporadaActualId: d.temporadaActualId || d.temporadas[0].id,
    temporadas: d.temporadas.map((t) => ({ ...t, data: normalizarData(t.data || {}) })),
  };
}

function cargarRaiz() {
  // v2: raiz con temporadas
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const n = normalizarRaiz(JSON.parse(r));
      if (n) return n;
    }
  } catch (e) {
    /* sigue abajo */
  }
  // migracion desde v1 (una sola temporada con todo lo existente)
  let dataInicial = datosVacios();
  try {
    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    if (v1) dataInicial = normalizarData(JSON.parse(v1));
  } catch (e) {
    /* sin datos v1 */
  }
  const temp = { id: uid(), nombre: String(new Date().getFullYear()), data: dataInicial };
  return { temporadaActualId: temp.id, temporadas: [temp] };
}

function persistir(raiz) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raiz));
  } catch (e) {
    console.error("No se pudo guardar", e);
  }
}

export default function LigaCarpincho() {
  const [raiz, setRaiz] = useState(null);
  const [tab, setTab] = useState("torneo");
  const [aviso, setAviso] = useState(null);
  const [fuente, setFuente] = useState(() => {
    try {
      return localStorage.getItem(FUENTE_KEY) || "firebase";
    } catch (e) {
      return "firebase";
    }
  });
  const nubeRef = useRef(null); // {ref, setDoc} cuando hay conexion

  useEffect(() => {
    let cancelado = false;
    let unsub = null;

    if (fuente === "local") {
      nubeRef.current = null;
      setRaiz(cargarRaiz());
      return;
    }

    setRaiz(null); // pantalla de carga mientras conecta
    conectarFirebase()
      .then(({ db, doc, onSnapshot, setDoc }) => {
        if (cancelado) return;
        const ref = doc(db, "liga", "datos");
        nubeRef.current = { ref, setDoc };
        unsub = onSnapshot(
          ref,
          (snap) => {
            if (cancelado) return;
            if (snap.exists()) {
              const n = normalizarRaiz(snap.data());
              if (n) setRaiz(n);
            } else {
              // nube vacia: usar lo de este celu y subirlo solo si tiene algo cargado
              const local = cargarRaiz();
              const tieneAlgo = local.temporadas.some(
                (t) => t.data.jugadores.length > 0 || t.data.torneos.length > 0
              );
              setRaiz(local);
              if (tieneAlgo) {
                setDoc(ref, local).catch((e) => console.error(e));
                setAviso("Datos de este celu enviados a la nube ☁️");
                setTimeout(() => setAviso(null), 3000);
              }
            }
          },
          (err) => {
            console.error(err);
            if (cancelado) return;
            setAviso("Sin conexión a la nube: usando datos locales por ahora.");
            setTimeout(() => setAviso(null), 4000);
            setFuente("local"); // solo esta sesion; al recargar intenta la nube de nuevo
          }
        );
      })
      .catch((e) => {
        console.error(e);
        if (!cancelado) setFuente("local"); // solo esta sesion
      });

    return () => {
      cancelado = true;
      if (unsub) unsub();
    };
  }, [fuente]);

  const guardarRaiz = (nuevaRaiz) => {
    setRaiz(nuevaRaiz);
    if (fuente === "firebase" && nubeRef.current) {
      nubeRef.current.setDoc(nubeRef.current.ref, nuevaRaiz).catch((e) => {
        console.error("No se pudo guardar en la nube", e);
      });
    } else {
      persistir(nuevaRaiz);
    }
  };

  const cambiarFuente = (f) => {
    try {
      localStorage.setItem(FUENTE_KEY, f);
    } catch (e) {}
    setFuente(f);
  };

  const temporada = raiz
    ? raiz.temporadas.find((t) => t.id === raiz.temporadaActualId) || raiz.temporadas[0]
    : null;
  const data = temporada ? temporada.data : null;

  const guardar = (nuevo) => {
    guardarRaiz({
      ...raiz,
      temporadas: raiz.temporadas.map((t) =>
        t.id === temporada.id ? { ...t, data: nuevo } : t
      ),
    });
  };

  /* Al cargar, abrir la pestana correcta segun el momento del juego:
     sin torneo -> Torneo (para empezar)
     torneo sin mesa sorteada -> Mesa
     mesa sorteada y timer ya usado -> Blinds
     mesa sorteada, timer intacto -> Torneo (para anotar entradas) */
  const tabInicialLista = useRef(false);
  useEffect(() => {
    if (!data || tabInicialLista.current) return;
    tabInicialLista.current = true;
    const t = data.torneos.find((x) => !x.cerrado);
    if (!t) return; // sin torneo: queda en Torneo (default)
    const sorteado = Object.keys(t.asientos || {}).length > 0;
    if (!sorteado) {
      setTab("mesa");
      return;
    }
    const tm = t.timer;
    const timerUsado =
      tm &&
      (tm.corriendo ||
        tm.nivel > 0 ||
        (tm.restanteMs != null && tm.restanteMs !== tm.durMin * 60000));
    if (timerUsado) setTab("timer");
  }, [data]);

  const avisar = (msg) => {
    setAviso(msg);
    setTimeout(() => setAviso(null), 2600);
  };

  if (!data)
    return (
      <div className="lc-load">
        <Capi size={64} />
        <p>{fuente === "firebase" ? "Conectando con la nube ☁️…" : "Cargando la liga…"}</p>
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
          <span className="lc-sub">
            Póker entre amigos · Temporada {temporada.nombre}
            {fuente === "firebase" ? " · ☁️" : " · 📱 local"}
          </span>
        </div>
      </header>

      {aviso && <div className="lc-toast">{aviso}</div>}

      <main className="lc-main">
        {tab === "torneo" && (
          <TabTorneo data={data} guardar={guardar} torneo={torneo} avisar={avisar} />
        )}
        {tab === "mesa" && <TabMesa data={data} guardar={guardar} torneo={torneo} avisar={avisar} />}
        {tab === "timer" && (
          <TabTimer data={data} guardar={guardar} torneo={torneo} avisar={avisar} />
        )}
        {tab === "ranking" && <TabRanking data={data} />}
        {tab === "ajustes" && (
          <TabAjustes
            data={data}
            guardar={guardar}
            avisar={avisar}
            raiz={raiz}
            guardarRaiz={guardarRaiz}
            fuente={fuente}
            cambiarFuente={cambiarFuente}
          />
        )}
      </main>

      <nav className="lc-nav">
        {[
          ["torneo", "♠", "Torneo"],
          ["mesa", "◎", "Mesa"],
          ["timer", "⏱", "Blinds"],
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
  const [ad, setAd] = useState(null); // {id, seg}
  const cfg = data.config;

  useEffect(() => {
    if (!ad || ad.seg <= 0) return;
    const t = setTimeout(
      () => setAd((a) => (a ? { ...a, seg: a.seg - 1 } : a)),
      1000
    );
    return () => clearTimeout(t);
  }, [ad]);

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

  const alEmpezar = () => {
    if (cfg.ads !== false) {
      setAd({ id: ADS_VIDEOS[Math.floor(Math.random() * ADS_VIDEOS.length)], seg: 5 });
    } else {
      crearTorneo();
    }
  };

  const cerrarAd = () => {
    setAd(null);
    crearTorneo();
  };

  if (!torneo) {
    const cerrados = [...data.torneos].filter((t) => t.cerrado).reverse();
    return (
      <div>
        <div className="lc-card lc-vacio">
          <Capi size={56} />
          <p>No hay torneo en juego.</p>
          <button className="lc-btn primario" onClick={alEmpezar}>
            Empezar torneo de hoy
          </button>
        </div>

        {ad && (
          <div className="lc-ad">
            <span className="etiqueta">Publicidad</span>
            <iframe
              className="marco"
              src={
                "https://www.youtube.com/embed/" +
                ad.id +
                "?autoplay=1&playsinline=1&rel=0"
              }
              title="Publicidad"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
            <button className="lc-ad-cerrar" disabled={ad.seg > 0} onClick={cerrarAd}>
              {ad.seg > 0 ? "Cerrar en " + ad.seg + "…" : "✕ Cerrar"}
            </button>
          </div>
        )}
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

  const cancelarTorneo = () => {
    guardar({ ...data, torneos: data.torneos.filter((t) => t.id !== torneo.id) });
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
    actualizarTorneo({
      cerrado: true,
      config: {
        buyIn: cfg.buyIn,
        addOn: cfg.addOn,
        maxEntradas: cfg.maxEntradas,
        premios: [...cfg.premios],
        casa: cfg.casa,
        puntos: [...cfg.puntos],
      },
    });
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

      {total === 0 && (
        <button className="lc-btn fantasma" onClick={cancelarTorneo}>
          ✕ Cancelar torneo y volver a la lista
        </button>
      )}

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
  const [abierto, setAbierto] = useState(false);
  // usa los valores congelados al cerrar el torneo; si es viejo, los actuales
  const cfg = t.config ? { ...data.config, ...t.config } : data.config;
  const nombreDe = (jid) => data.jugadores.find((j) => j.id === jid)?.nombre || "?";

  const jugadores = Object.keys(t.entradas);
  const pozo = jugadores.reduce((acc, jid) => {
    const e = t.entradas[jid];
    return acc + e.buyins * cfg.buyIn + (e.addon ? cfg.addOn : 0);
  }, 0);
  const ganador = jugadores.find((jid) => t.posiciones[jid] === 1);
  const ordenados = [...jugadores].sort(
    (a, b) => (t.posiciones[a] || 999) - (t.posiciones[b] || 999)
  );
  const premioDe = (pos) =>
    pos >= 1 && pos <= cfg.premios.length ? (pozo * cfg.premios[pos - 1]) / 100 : 0;
  const iconoPos = (pos) =>
    pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos + "º";

  return (
    <div className="lc-card lc-resumen-wrap">
      <button className="lc-resumen" onClick={() => setAbierto(!abierto)}>
        <div>
          <strong>{t.fecha}</strong>
          <span>
            {jugadores.length} jugadores · pozo {fmtGs(pozo)}
          </span>
        </div>
        <span className="lc-ganador">
          {ganador && (
            <>
              <span className="medalla oro">1º</span> {nombreDe(ganador)}
            </>
          )}
          <span className={"lc-flecha" + (abierto ? " abierta" : "")}>▾</span>
        </span>
      </button>

      {abierto && (
        <div className="lc-resumen-det">
          {ordenados.map((jid) => {
            const pos = t.posiciones[jid];
            const e = t.entradas[jid];
            const premio = pos ? premioDe(pos) : 0;
            return (
              <div key={jid} className="fila">
                <span className="pos">{pos ? iconoPos(pos) : "·"}</span>
                <span className="nom">
                  {nombreDe(jid)}
                  <small>
                    {e.buyins} entrada{e.buyins > 1 ? "s" : ""}
                    {e.addon ? " + add-on" : ""}
                  </small>
                </span>
                <span className="pts">{pos ? (cfg.puntos[pos - 1] || 0) + " pts" : ""}</span>
                <span className="premio">{premio > 0 ? fmtGs(premio) : ""}</span>
              </div>
            );
          })}
          <div className="fila casa">
            <span className="pos">🏠</span>
            <span className="nom">
              Casa <small>caja común · {cfg.casa}%</small>
            </span>
            <span className="pts"></span>
            <span className="premio">{fmtGs((pozo * cfg.casa) / 100)}</span>
          </div>
        </div>
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
   TAB: TIMER DE BLINDS
   ============================================================ */
/* Estructura: sube de 100 en 100 (small) hasta 1000/2000, donde se
   habilita el add-on; despues sigue con saltos mas grandes. Sin antes. */
function nivelesBlinds() {
  const n = [];
  for (let sb = 100; sb <= 1000; sb += 100) n.push({ sb, bb: sb * 2 });
  [1500, 2000, 3000, 4000, 5000, 7000, 10000].forEach((sb) =>
    n.push({ sb, bb: sb * 2 })
  );
  return n;
}
const NIVELES = nivelesBlinds();
const ADDON_SB = 1000; // en 1000/2000 se habilita el add-on
const fmtN = (n) => new Intl.NumberFormat("es-PY").format(n);

/* Sonidos generados con WebAudio (sin archivos). El toque de play
   desbloquea el audio; despues los beeps suenan solos. */
let audioCtx = null;
function desbloquearAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0.0001; // silencioso: solo registra el permiso
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.05);
  } catch (e) {}
}
function beep(freq, ms, vol) {
  try {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    o.type = "sine";
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms / 1000);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + ms / 1000);
  } catch (e) {}
}
function gongSubida(esAddon) {
  beep(esAddon ? 523 : 440, 500, 0.3);
  setTimeout(() => beep(esAddon ? 659 : 554, 500, 0.3), 180);
  setTimeout(() => beep(esAddon ? 784 : 659, 900, 0.3), 380);
}

function TabTimer({ data, guardar, torneo, avisar }) {
  const [, setTic] = useState(0); // re-render periodico para el countdown
  const wakeRef = useRef(null);
  const nivelPrevio = useRef(null);
  const ultimoBeep = useRef(null);

  const timer = (torneo && torneo.timer) || {
    nivel: 0,
    durMin: 15,
    corriendo: false,
    finTs: null,
    restanteMs: 15 * 60000,
  };

  const setTimer = (t) => {
    guardar({
      ...data,
      torneos: data.torneos.map((x) => (x.id === torneo.id ? { ...x, timer: t } : x)),
    });
  };

  /* tick local: solo re-renderiza; el estado vive en finTs (timestamp),
     asi el tiempo es exacto aunque el celu se distraiga un rato */
  useEffect(() => {
    const int = setInterval(() => setTic((x) => x + 1), 250);
    return () => clearInterval(int);
  }, []);

  /* wake lock: pantalla encendida mientras corre */
  const pedirWake = async () => {
    try {
      if (navigator.wakeLock) wakeRef.current = await navigator.wakeLock.request("screen");
    } catch (e) {}
  };
  const soltarWake = () => {
    try {
      if (wakeRef.current) wakeRef.current.release();
    } catch (e) {}
    wakeRef.current = null;
  };
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && timer.corriendo) pedirWake();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      soltarWake();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.corriendo]);

  /* avance de nivel: deterministico (usa el finTs anterior), asi todos
     los celus calculan lo mismo y las escrituras no chocan */
  useEffect(() => {
    if (!torneo || !timer.corriendo || !timer.finTs) return;
    const ahora = Date.now();
    if (timer.finTs <= ahora) {
      let nivel = timer.nivel;
      let finTs = timer.finTs;
      while (finTs <= ahora && nivel < NIVELES.length - 1) {
        nivel += 1;
        finTs += timer.durMin * 60000;
      }
      if (nivel !== timer.nivel) setTimer({ ...timer, nivel, finTs });
    }
  });

  /* gong al subir de nivel */
  useEffect(() => {
    if (!torneo) return;
    if (nivelPrevio.current !== null && timer.nivel !== nivelPrevio.current) {
      const esAddon = NIVELES[timer.nivel].sb === ADDON_SB;
      gongSubida(esAddon);
      if (esAddon) avisar("🎁 ¡Add-on habilitado!");
    }
    nivelPrevio.current = timer.nivel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneo && timer.nivel]);

  /* beeps en los ultimos 10 segundos */
  useEffect(() => {
    if (!torneo || !timer.corriendo || !timer.finTs) return;
    const seg = Math.ceil((timer.finTs - Date.now()) / 1000);
    if (seg <= 10 && seg > 0 && ultimoBeep.current !== seg) {
      ultimoBeep.current = seg;
      beep(880, 120, 0.18);
    }
  });

  if (!torneo)
    return (
      <div className="lc-card lc-vacio">
        <Capi size={56} />
        <p>Primero empeza un torneo en la pestana ♠ Torneo.</p>
      </div>
    );

  const niv = NIVELES[timer.nivel];
  const prox = NIVELES[timer.nivel + 1] || null;
  const esAddon = niv.sb === ADDON_SB;
  const proxAddon = prox && prox.sb === ADDON_SB;
  const restante =
    timer.corriendo && timer.finTs
      ? Math.max(0, timer.finTs - Date.now())
      : timer.restanteMs;
  const mm = Math.floor(restante / 60000);
  const ss = Math.floor((restante % 60000) / 1000);

  const play = () => {
    desbloquearAudio();
    pedirWake();
    const base = timer.restanteMs != null ? timer.restanteMs : timer.durMin * 60000;
    setTimer({ ...timer, corriendo: true, finTs: Date.now() + base });
  };

  const pausa = () => {
    soltarWake();
    const rest = Math.max(0, (timer.finTs || Date.now()) - Date.now());
    setTimer({ ...timer, corriendo: false, restanteMs: rest, finTs: null });
  };

  const saltar = (delta) => {
    const nuevo = Math.min(NIVELES.length - 1, Math.max(0, timer.nivel + delta));
    if (nuevo === timer.nivel) return;
    const dur = timer.durMin * 60000;
    if (timer.corriendo) setTimer({ ...timer, nivel: nuevo, finTs: Date.now() + dur });
    else setTimer({ ...timer, nivel: nuevo, restanteMs: dur });
  };

  const setDur = (min) => {
    if (timer.corriendo) return;
    const m = Math.min(60, Math.max(1, min));
    setTimer({ ...timer, durMin: m, restanteMs: m * 60000 });
  };

  return (
    <div>
      <h2 className="lc-h2">Timer de blinds</h2>

      <div className={"lc-card lc-timer" + (esAddon ? " addon" : "")}>
        <div className="nivel-tag">
          Nivel {timer.nivel + 1}
          {esAddon ? " · 🎁 Add-on habilitado" : ""}
        </div>
        <div className="blinds">
          {fmtN(niv.sb)} / {fmtN(niv.bb)}
        </div>
        <div
          className={
            "cuenta" + (timer.corriendo && restante <= 60000 ? " alerta" : "")
          }
        >
          {mm}:{String(ss).padStart(2, "0")}
        </div>
        <div className="prox">
          {prox
            ? "Próximo: " + fmtN(prox.sb) + " / " + fmtN(prox.bb) + (proxAddon ? " · 🎁 add-on" : "")
            : "Último nivel"}
        </div>
        <div className="controles">
          <button className="paso" onClick={() => saltar(-1)} title="Nivel anterior">
            ⏮
          </button>
          <button className="play" onClick={timer.corriendo ? pausa : play}>
            {timer.corriendo ? "⏸" : "▶"}
          </button>
          <button className="paso" onClick={() => saltar(1)} title="Próximo nivel">
            ⏭
          </button>
        </div>
      </div>

      <div className="lc-card">
        <div className="lc-dur">
          <button onClick={() => setDur(timer.durMin - 1)} disabled={timer.corriendo}>
            −
          </button>
          <span>
            {timer.durMin} <small>min por nivel</small>
          </span>
          <button onClick={() => setDur(timer.durMin + 1)} disabled={timer.corriendo}>
            +
          </button>
        </div>
        <div className="lc-dur-presets">
          {[10, 12, 15, 20].map((m) => (
            <button
              key={m}
              className={"lc-chip" + (timer.durMin === m ? " on" : "")}
              disabled={timer.corriendo}
              onClick={() => setDur(m)}
            >
              {m} min
            </button>
          ))}
        </div>
        <p className="lc-nota">
          Pausá para cambiar la duración: vale para el nivel actual (arranca de nuevo) y los
          siguientes. Las blinds suben de a 100 hasta 1000/2000, donde se habilita el add-on.
        </p>
      </div>

      <p className="lc-nota centro">
        Mientras corre, la pantalla de este celu queda encendida y suena el aviso en los
        últimos 10 segundos + el gong al subir. Los demás celulares con la app abierta ven el
        timer sincronizado.
      </p>
    </div>
  );
}

/* ============================================================
   TAB: RANKING
   ============================================================ */
function TabRanking({ data }) {
  const cfg = data.config;
  const cerrados = data.torneos.filter((t) => t.cerrado);
  const nPos = cfg.puntos.length;

  const stats = {};
  for (const t of cerrados) {
    const puntosT = (t.config && t.config.puntos) || cfg.puntos;
    for (const jid of Object.keys(t.posiciones)) {
      const pos = t.posiciones[jid];
      if (!stats[jid])
        stats[jid] = { puntos: 0, torneos: 0, pos: Array(nPos).fill(0) };
      stats[jid].torneos += 1;
      stats[jid].puntos += puntosT[pos - 1] || 0;
      if (pos >= 1 && pos <= nPos) stats[jid].pos[pos - 1] += 1;
    }
  }

  const filas = Object.keys(stats)
    .map((jid) => ({
      jid,
      nombre: data.jugadores.find((j) => j.id === jid)?.nombre || "?",
      ...stats[jid],
    }))
    .sort(
      (a, b) =>
        b.puntos - a.puntos || b.pos[0] - a.pos[0] || a.nombre.localeCompare(b.nombre)
    );

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

  const cabecera = (i) =>
    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;

  return (
    <div>
      <h2 className="lc-h2">Ranking de la liga</h2>
      <p className="lc-nota">
        Puntos por posición: {cfg.puntos.map((p, i) => `${i + 1}º=${p}`).join(" · ")}
      </p>
      <div className="lc-card lc-tabla2">
        <div className="lc-tabla-scroll">
          <div className="lc-t2">
            <div className="lc-t2-fila head">
              <span className="fijo-izq">Jugador</span>
              {Array.from({ length: nPos }, (_, i) => (
                <span key={i} className="celda">
                  {cabecera(i)}
                </span>
              ))}
              <span className="fijo-der">Pts</span>
            </div>
            {filas.map((f, i) => (
              <div key={f.jid} className={"lc-t2-fila" + (i === 0 ? " lider" : "")}>
                <span className="fijo-izq">
                  {i === 0 && "🏆 "}
                  {i === 1 && "🥈 "}
                  {i === 2 && "🥉 "}
                  {i + 1}. {f.nombre}
                </span>
                {f.pos.map((c, j) => (
                  <span key={j} className="celda">
                    {c || "·"}
                  </span>
                ))}
                <span className="fijo-der">{f.puntos}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="lc-nota centro">
        Deslizá la tabla para ver todas las posiciones · {cerrados.length} torneo
        {cerrados.length !== 1 ? "s" : ""} jugado{cerrados.length !== 1 ? "s" : ""} · el 1º del
        año se lleva el trofeo carpincho
      </p>
    </div>
  );
}

/* ============================================================
   TAB: AJUSTES
   ============================================================ */

/* Campo numerico que se puede borrar libremente:
   aplica el valor en vivo cuando es valido y, al salir del campo,
   restaura el ultimo valido si quedo vacio. */
function CampoNum({ value, onCommit, min = 0, step }) {
  const [txt, setTxt] = useState(String(value));
  const enfocado = useRef(false);

  useEffect(() => {
    if (!enfocado.current) setTxt(String(value));
  }, [value]);

  return (
    <input
      type="number"
      inputMode="numeric"
      step={step}
      min={min}
      value={txt}
      onFocus={() => {
        enfocado.current = true;
      }}
      onChange={(e) => {
        setTxt(e.target.value);
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v) && v >= min) onCommit(v);
      }}
      onBlur={() => {
        enfocado.current = false;
        const v = parseInt(txt, 10);
        const fin = isNaN(v) ? value : Math.max(min, v);
        onCommit(fin);
        setTxt(String(fin));
      }}
    />
  );
}

function TabAjustes({ data, guardar, avisar, raiz, guardarRaiz, fuente, cambiarFuente }) {
  const cfg = data.config;
  const [nuevaTemp, setNuevaTemp] = useState("");

  const setCfg = (cambios) => guardar({ ...data, config: { ...cfg, ...cambios } });

  const cambiarTemporada = (id) => {
    guardarRaiz({ ...raiz, temporadaActualId: id });
    const t = raiz.temporadas.find((x) => x.id === id);
    avisar("Temporada " + (t ? t.nombre : "") + " activa");
  };

  const crearTemporada = () => {
    const nombre = nuevaTemp.trim() || String(new Date().getFullYear() + 1);
    if (raiz.temporadas.some((t) => t.nombre === nombre)) {
      avisar("Ya existe una temporada con ese nombre");
      return;
    }
    const t = {
      id: uid(),
      nombre,
      data: {
        config: { ...cfg },
        jugadores: [...data.jugadores],
        torneos: [],
      },
    };
    guardarRaiz({
      ...raiz,
      temporadas: [...raiz.temporadas, t],
      temporadaActualId: t.id,
    });
    setNuevaTemp("");
    avisar('Temporada "' + nombre + '" creada 🏆');
  };

  const setPunto = (i, v) => {
    const puntos = [...cfg.puntos];
    puntos[i] = v;
    setCfg({ puntos });
  };

  const setPremio = (i, v) => {
    const premios = [...cfg.premios];
    premios[i] = v;
    setCfg({ premios });
  };

  const sumaPct = cfg.premios.reduce((a, b) => a + b, 0) + cfg.casa;

  return (
    <div>
      <h2 className="lc-h2">Temporada</h2>
      <div className="lc-card lc-form">
        <label>
          Temporada actual
          <select
            value={raiz.temporadaActualId}
            onChange={(e) => cambiarTemporada(e.target.value)}
          >
            {raiz.temporadas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {t.data.torneos.filter((x) => x.cerrado).length} torneo
                {t.data.torneos.filter((x) => x.cerrado).length !== 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="lc-agregar">
          <input
            placeholder={"Nueva temporada (ej: " + (new Date().getFullYear() + 1) + ")"}
            value={nuevaTemp}
            onChange={(e) => setNuevaTemp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearTemporada()}
          />
          <button className="lc-btn primario" onClick={crearTemporada}>
            Crear
          </button>
        </div>
        <p className="lc-nota">
          Cada temporada tiene su propio ranking y sus torneos. Al crear una nueva se
          mantienen los jugadores y los ajustes, y el ranking arranca de cero. Las
          anteriores quedan guardadas: podés volver a elegirlas acá para ver sus
          resultados.
        </p>
      </div>

      <h2 className="lc-h2">Montos</h2>
      <div className="lc-card lc-form">
        <label>
          Buy-in / entrada (Gs)
          <CampoNum step={1000} value={cfg.buyIn} onCommit={(v) => setCfg({ buyIn: v })} />
        </label>
        <label>
          Add-on (Gs)
          <CampoNum step={1000} value={cfg.addOn} onCommit={(v) => setCfg({ addOn: v })} />
        </label>
        <label>
          Máx. entradas acordadas
          <CampoNum min={1} value={cfg.maxEntradas} onCommit={(v) => setCfg({ maxEntradas: v })} />
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
            <CampoNum value={p} onCommit={(v) => setPremio(i, v)} />
          </label>
        ))}
        <label>
          Casa / caja común (%)
          <CampoNum value={cfg.casa} onCommit={(v) => setCfg({ casa: v })} />
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
            <CampoNum value={p} onCommit={(v) => setPunto(i, v)} />
          </label>
        ))}
      </div>

      <p className="lc-nota">
        Al cerrar un torneo, sus montos, premios y puntos quedan guardados con él. Cambiar
        estos valores acá vale para el torneo en juego y los próximos, sin alterar el
        historial ni el ranking de los ya cerrados.
      </p>

      <h2 className="lc-h2">Datos</h2>
      <div className="lc-card lc-form">
        <label className="lc-switch-row">
          <span>📱 Local (este dispositivo)</span>
          <input
            type="radio"
            name="fuente"
            checked={fuente === "local"}
            onChange={() => cambiarFuente("local")}
          />
        </label>
        <label className="lc-switch-row">
          <span>☁️ Firebase (compartido entre todos)</span>
          <input
            type="radio"
            name="fuente"
            checked={fuente === "firebase"}
            onChange={() => cambiarFuente("firebase")}
          />
        </label>
        <p className="lc-nota">
          La nube es el modo por defecto: cualquiera que abra el link ve y edita los mismos
          datos en tiempo real. El modo local es el espacio de prueba de cada celu — ideal
          para probar cosas sin tocar los datos del grupo.
        </p>
      </div>

      <h2 className="lc-h2">Otros</h2>
      <div className="lc-card lc-form">
        <label className="lc-switch-row">
          <span>Mostrar ads antes de empezar un torneo</span>
          <input
            type="checkbox"
            checked={cfg.ads !== false}
            onChange={(e) => setCfg({ ads: e.target.checked })}
          />
        </label>
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

.lc-resumen-wrap{padding:0; overflow:hidden;}
.lc-resumen{display:flex; justify-content:space-between; align-items:center; gap:8px;
  width:100%; border:none; background:none; padding:14px; cursor:pointer;
  font-family:inherit; text-align:left; color:var(--tinta); font-size:15px;}
.lc-resumen div{display:flex; flex-direction:column;}
.lc-resumen span{font-size:12.5px; color:var(--suave);}
.lc-ganador{font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;
  color:var(--tinta) !important;}
.lc-flecha{display:inline-block; transition:transform .2s ease; color:var(--suave); font-size:14px;}
.lc-flecha.abierta{transform:rotate(180deg);}
.lc-resumen-det{border-top:1px solid var(--linea); padding:6px 14px 10px; background:#FCF9F2;}
.lc-resumen-det .fila{display:grid; grid-template-columns:34px 1fr auto auto;
  gap:8px; align-items:center; padding:7px 0; border-bottom:1px dashed var(--linea);
  font-size:14px;}
.lc-resumen-det .fila:last-child{border-bottom:none;}
.lc-resumen-det .pos{text-align:center; font-size:15px;}
.lc-resumen-det .nom{font-weight:700; display:flex; flex-direction:column; min-width:0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.lc-resumen-det .nom small{font-weight:600; color:var(--suave); font-size:11.5px;}
.lc-resumen-det .pts{color:var(--marron); font-weight:700; font-size:12.5px;}
.lc-resumen-det .premio{font-weight:800; color:var(--felt); font-size:13px;
  font-variant-numeric:tabular-nums; min-width:70px; text-align:right;}
.lc-resumen-det .fila.casa .nom{color:var(--suave);}

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
.lc-form select{border:1px solid var(--linea); border-radius:10px; padding:11px;
  font-size:16px; font-family:inherit; background:var(--papel); color:var(--tinta);}
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

/* --- ranking con scroll horizontal y columnas fijas --- */
.lc-tabla2{padding:0; overflow:hidden;}
.lc-tabla-scroll{overflow-x:auto; -webkit-overflow-scrolling:touch;}
.lc-t2{min-width:max-content;}
.lc-t2-fila{display:flex; align-items:stretch; border-bottom:1px solid var(--linea);}
.lc-t2-fila:last-child{border-bottom:none;}
.lc-t2-fila .fijo-izq{position:sticky; left:0; z-index:1; background:var(--carta);
  min-width:138px; max-width:138px; padding:11px 8px 11px 12px; font-weight:700;
  font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  box-shadow:3px 0 5px rgba(43,36,28,.07); display:flex; align-items:center;}
.lc-t2-fila .celda{min-width:42px; display:flex; align-items:center; justify-content:center;
  font-size:14px; padding:11px 0; color:var(--tinta);}
.lc-t2-fila .fijo-der{position:sticky; right:0; z-index:1; background:var(--carta);
  min-width:54px; padding:11px 10px; font-weight:800; color:var(--felt); font-size:15px;
  box-shadow:-3px 0 5px rgba(43,36,28,.07); display:flex; align-items:center;
  justify-content:center;}
.lc-t2-fila.head{font-size:11px; text-transform:uppercase; letter-spacing:.5px;
  color:var(--suave); border-bottom:2px solid var(--linea);}
.lc-t2-fila.head .fijo-izq{font-weight:800; font-size:11px; color:var(--suave);}
.lc-t2-fila.head .celda{font-size:13px; font-weight:800; color:var(--suave);}
.lc-t2-fila.head .fijo-der{font-size:11px; font-weight:800; color:var(--suave);}
.lc-t2-fila.lider{background:#FDF3E4;}
.lc-t2-fila.lider .fijo-izq,.lc-t2-fila.lider .fijo-der{background:#FDF3E4;}

/* --- "publicidad" antes del torneo --- */
.lc-ad{position:fixed; inset:0; background:rgba(5,5,5,.94); z-index:60;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:14px; padding:16px;}
.lc-ad .etiqueta{color:#999; font-size:11px; letter-spacing:3px; text-transform:uppercase;
  font-weight:800;}
.lc-ad .marco{width:100%; max-width:520px; aspect-ratio:16/9; border:none;
  border-radius:12px; background:#000; box-shadow:0 8px 30px rgba(0,0,0,.6);}
.lc-ad-cerrar{position:absolute; top:16px; right:16px; border:none; border-radius:999px;
  padding:10px 16px; font-weight:800; font-family:inherit; font-size:14px;
  cursor:pointer; background:#fff; color:#111;}
.lc-ad-cerrar:disabled{background:rgba(255,255,255,.22); color:#fff; cursor:default;}
.lc-switch-row{flex-direction:row !important; align-items:center;
  justify-content:space-between; gap:12px !important; font-size:14px !important;
  color:var(--tinta) !important;}
.lc-switch-row input{width:22px; height:22px; accent-color:var(--naranja); flex-shrink:0;}

/* --- timer de blinds --- */
.lc-timer{background:radial-gradient(ellipse at 50% 30%, #3A6E56, var(--felt) 75%);
  color:#fff; text-align:center; padding:22px 14px 18px; border-color:var(--felt-osc);}
.lc-timer.addon{box-shadow:0 0 0 3px var(--naranja);}
.lc-timer .nivel-tag{font-size:12px; font-weight:800; letter-spacing:1.5px;
  text-transform:uppercase; opacity:.85;}
.lc-timer .blinds{font-size:40px; font-weight:800; letter-spacing:1px; margin:6px 0 2px;
  font-variant-numeric:tabular-nums;}
.lc-timer .cuenta{font-size:64px; font-weight:800; line-height:1.05;
  font-variant-numeric:tabular-nums; letter-spacing:2px;}
.lc-timer .cuenta.alerta{color:#FFC46B; animation:lcpulso 1s ease-in-out infinite;}
@keyframes lcpulso{0%,100%{opacity:1;}50%{opacity:.55;}}
.lc-timer .prox{font-size:13.5px; opacity:.85; margin-top:4px; font-weight:600;}
.lc-timer .controles{display:flex; justify-content:center; gap:14px; margin-top:14px;}
.lc-timer .controles button{border:none; cursor:pointer; font-family:inherit;
  border-radius:50%; display:flex; align-items:center; justify-content:center;}
.lc-timer .controles .paso{width:52px; height:52px; font-size:20px;
  background:rgba(255,255,255,.16); color:#fff;}
.lc-timer .controles .play{width:72px; height:72px; font-size:30px;
  background:var(--naranja); color:#fff; box-shadow:0 3px 0 #C96D25;}
.lc-timer .controles .play:active{transform:translateY(2px); box-shadow:none;}
.lc-dur{display:flex; align-items:center; justify-content:center; gap:8px;}
.lc-dur button{width:52px; height:52px; border:1px solid var(--linea); border-radius:14px;
  background:var(--papel); font-size:26px; color:var(--marron); font-weight:800;
  cursor:pointer; font-family:inherit;}
.lc-dur button:disabled{opacity:.35;}
.lc-dur span{min-width:120px; text-align:center; font-size:26px; font-weight:800;}
.lc-dur small{font-size:13px; color:var(--suave); font-weight:700;}
.lc-dur-presets{display:flex; justify-content:center; gap:8px; margin-top:12px;}
.lc-dur-presets .lc-chip:disabled{opacity:.4;}
@media (prefers-reduced-motion:reduce){.lc-timer .cuenta.alerta{animation:none;}}
`;
