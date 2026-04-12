# GIFS Viewer

Déploiement sur Vercel (TanStack Start + Vite SSR).

## Prérequis

- Node.js 20+ (Node 22 recommande)
- Un compte Vercel
- Le repo pousse sur GitHub

## Methode 1: via l'interface Vercel (recommande)

1. Ouvrir Vercel et cliquer sur `Add New...` -> `Project`.
2. Importer le repo `MrPatator230/gifs-viewer`.
3. Verifier les reglages:
   - Framework Preset: `Other`
   - Build Command: `npm run build`
   - Install Command: `npm install`
   - Output Directory: laisser vide
4. Cliquer sur `Deploy`.

Le fichier `vercel.json` est deja configure pour router tout le trafic vers les fonctions `api/`.

## Methode 2: via CLI Vercel

```bash
npm i -g vercel
cd /workspaces/gifs-viewer
vercel login
vercel
```

Premier deploy: suivre les questions interactives.

Deploy production ensuite:

```bash
vercel --prod
```

## Variables d'environnement

Si tu ajoutes des variables d'environnement plus tard:

1. Vercel Dashboard -> Project -> Settings -> Environment Variables
2. Ajouter les variables pour `Production` et/ou `Preview`
3. Redeloyer

## Domaine personnalise

1. Vercel Dashboard -> Project -> Settings -> Domains
2. Ajouter le domaine (ex: `gtfs-viewer.mr-patator.fr`)
3. Appliquer les enregistrements DNS proposes par Vercel

## Verification rapide

- La route `/` charge l'app
- Les routes de l'app fonctionnent en refresh navigateur
- Pas d'erreur 500 dans les logs Vercel (`Project -> Deployments -> Functions logs`)

## Notes techniques

- Le script `postbuild` (`scripts/ensure-server-entry.mjs`) garantit `dist/server/server.js`.
- Le script `vercel-build` est present pour fiabiliser le build sur Vercel.
- `api/index.ts` et `api/[...path].ts` deleguent vers le serveur TanStack Start.
