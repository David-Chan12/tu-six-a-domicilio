// =====================================================================
//  acceso.js — Lista de correos con acceso al sistema
//  Jurisdicción Sanitaria No. 2 · Control de Equipos
//
//  Solo estas cuentas pueden entrar, y todas tienen acceso completo.
//  Cada correo también debe existir como usuario en Firebase
//  (Consola de Firebase → Authentication → Agregar usuario).
//
//  Para dar o quitar acceso: agrega o borra un correo de la lista.
//  ⚠️ Haz el MISMO cambio en firestore.rules y publícalo en la consola de
//     Firebase; si no, la cuenta verá las pantallas pero no los datos.
// =====================================================================

export const CORREOS_AUTORIZADOS = [
  "admin@six.com",
  // "jefe.jurisdiccion@salud.yucatan.gob.mx",
  // "subjefe@salud.yucatan.gob.mx",
];

export function esCorreoAutorizado(correo) {
  const c = String(correo || "").trim().toLowerCase();
  return CORREOS_AUTORIZADOS.some((a) => a.trim().toLowerCase() === c);
}
