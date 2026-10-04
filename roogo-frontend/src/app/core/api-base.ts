/**
 * URL de base de l'API ROOGO — source de vérité unique pour TOUS les services.
 *
 * Résolution, dans l'ordre :
 * 1. <meta name="roogo-api-base"> si renseignée (override par déploiement/proxy)
 * 2. même origine si l'app est servie par l'API elle-même (port 3000)
 * 3. http://<hôte>:3000/api en développement (localhost, 127.0.0.1, IP privée LAN)
 * 4. https://roogo.onrender.com/api en production (Vercel, domaine custom…)
 *
 * Ne JAMAIS écrire « http://localhost:3000 » ailleurs : sur un front déployé,
 * cela pointerait vers le poste du visiteur.
 */
export function resolveApiBase(): string {
  const meta = document.querySelector('meta[name="roogo-api-base"]')?.getAttribute('content');
  if (meta) return meta;

  const { protocol, hostname, port, origin } = window.location;
  if (port === '3000') return `${origin}/api`;

  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

  if (isLocal) return `${protocol}//${hostname}:3000/api`;
  return 'https://roogo.onrender.com/api';
}
