export const sesion = { token: localStorage.getItem('token'), usuario: null };

export const guardarToken = token => {
  sesion.token = token;
  token ? localStorage.setItem('token', token) : localStorage.removeItem('token');
};

export async function api(ruta, cuerpo) {
  const res = await fetch('/api' + ruta, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(sesion.token && { Authorization: `Bearer ${sesion.token}` }) },
    body: cuerpo && JSON.stringify(cuerpo)
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || 'Error del servidor');
  return datos;
}
